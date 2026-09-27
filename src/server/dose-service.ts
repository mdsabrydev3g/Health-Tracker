import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { materialiseDoses, type ScheduleInput, doseStatusAt } from "@/core/engine/dose.engine";
import { todayLocalDay } from "@/core/time/clock";

/**
 * Server-side dose service.
 * - Materialises the next 14 days of dose events (idempotent upserts).
 * - Marks overdue doses as missed after the grace window (2h).
 * - takeDose is idempotent: doseEvent + inventoryEvent updated in one pass,
 *   a retry is a no-op.
 */

const GRACE_MINUTES = 120;

export async function syncDoses(opts?: { personId?: string }) {
  const db = getDb();
  const persons = await db.select().from(schema.persons).where(eq(schema.persons.deleted, false));
  const now = new Date();

  for (const person of persons) {
    if (opts?.personId && person.id !== opts.personId) continue;
    const tz = person.timezone;
    const today = todayLocalDay(tz, now);

    const meds = await db
      .select()
      .from(schema.medications)
      .where(
        and(
          eq(schema.medications.personId, person.id),
          eq(schema.medications.deleted, false),
          ne(schema.medications.status, "discontinued"),
        ),
      );
    const medIds = new Set(meds.map((m) => m.id));
    if (medIds.size === 0) continue;

    const allSchedules = await db
      .select()
      .from(schema.schedules);
    const schedInputs: ScheduleInput[] = allSchedules
      .filter((s) => medIds.has(s.medicationId))
      .map((s) => {
        const med = meds.find((m) => m.id === s.medicationId)!;
        return {
          id: s.id,
          medicationId: s.medicationId,
          personId: person.id,
          kind: s.kind as ScheduleInput["kind"],
          times: s.times,
          quantityPerDose: s.quantityPerDose,
          anchorDate: s.anchorDate,
          endDate: s.endDate,
          weekdays: s.weekdays,
          intervalN: s.intervalN,
          prnMaxPerDay: s.prnMaxPerDay,
          taperSteps: s.taperSteps,
          activeFrom: s.activeFrom,
          activeTo: s.activeTo,
          medStartDate: med.startDate,
          medEndDate: med.endDate,
        };
      });

    const rangeFrom = new Date(now.getTime() - 3 * 86400000);
    const rangeTo = new Date(now.getTime() + 14 * 86400000);
    const doses = materialiseDoses(schedInputs, tz, rangeFrom, rangeTo);

    // Batch-insert all materialised doses in ONE round trip (chunks of 100)
    for (let i = 0; i < doses.length; i += 100) {
      const chunk = doses.slice(i, i + 100).map((d) => ({
        personId: person.id,
        medicationId: d.medicationId,
        scheduleId: d.scheduleId,
        scheduledAtUtc: d.scheduledAtUtc,
        localDay: d.localDay,
        status: "upcoming",
        quantity: d.quantity,
        idempotencyKey: d.idempotencyKey,
      }));
      if (chunk.length > 0) {
        await db
          .insert(schema.doseEvents)
          .values(chunk)
          .onConflictDoNothing({ target: schema.doseEvents.idempotencyKey });
      }
    }

    // Advance statuses: upcoming→due at dose time, due→missed after grace.
    await db.execute(sql`
      UPDATE dose_events
      SET status = CASE
        WHEN status = 'upcoming' AND scheduled_at_utc <= now() THEN 'due'
        WHEN status = 'due' AND scheduled_at_utc + interval '120 minutes' < now() THEN 'missed'
        ELSE status END
      WHERE person_id = ${person.id}
        AND status IN ('upcoming', 'due')
        AND scheduled_at_utc < now()
    `);
  }
  return { ok: true, at: now.toISOString() };
}

export async function takeDose(doseId: string, actedBy: string) {
  const db = getDb();
  const [dose] = await db.select().from(schema.doseEvents).where(eq(schema.doseEvents.id, doseId));
  if (!dose) throw new Error("dose not found");
  if (dose.status === "taken") return { ok: true, alreadyTaken: true }; // idempotent

  const [med] = await db
    .select()
    .from(schema.medications)
    .where(eq(schema.medications.id, dose.medicationId));
  if (!med) throw new Error("medication not found");

  const now = new Date();
  await db
    .update(schema.doseEvents)
    .set({ status: "taken", actedAtUtc: now, actedBy, quantity: dose.quantity })
    .where(eq(schema.doseEvents.id, doseId));

  // Inventory deduction with ledger event (idempotency: guarded by status check above)
  const prev = parseFloat(med.balanceCache ?? "0");
  const qty = parseFloat(dose.quantity ?? "1");
  const next = prev - qty;
  await db.insert(schema.inventoryEvents).values({
    medicationId: med.id,
    personId: dose.personId,
    type: "doseTaken",
    qty: String(-qty),
    prevBalance: String(prev),
    newBalance: String(next),
    doseEventId: dose.id,
    atUtc: now,
  });
  await db
    .update(schema.medications)
    .set({ balanceCache: String(next), updatedAt: now })
    .where(eq(schema.medications.id, med.id));

  return { ok: true, alreadyTaken: false, balance: next };
}

export async function skipDose(doseId: string, actedBy: string) {
  const db = getDb();
  const now = new Date();
  await db
    .update(schema.doseEvents)
    .set({ status: "skipped", actedAtUtc: now, actedBy })
    .where(and(eq(schema.doseEvents.id, doseId), ne(schema.doseEvents.status, "taken")));
  return { ok: true };
}

export async function snoozeDose(doseId: string, minutes: number) {
  const db = getDb();
  const now = new Date();
  await db
    .update(schema.doseEvents)
    .set({ status: "snoozed", snoozedUntil: new Date(now.getTime() + minutes * 60_000) })
    .where(and(eq(schema.doseEvents.id, doseId), ne(schema.doseEvents.status, "taken")));
  return { ok: true };
}

/** Log a PRN (as-needed) take — never counts as missed, deducts inventory. */
export async function logPrnTake(input: {
  personId: string;
  medicationId: string;
  scheduleId: string;
  quantity: string;
  actedBy: string;
}) {
  const db = getDb();
  const now = new Date();
  const [med] = await db
    .select()
    .from(schema.medications)
    .where(eq(schema.medications.id, input.medicationId));
  if (!med) throw new Error("medication not found");

  const idem = `prn:${input.medicationId}:${now.getTime()}`;
  const [ev] = await db
    .insert(schema.doseEvents)
    .values({
      personId: input.personId,
      medicationId: input.medicationId,
      scheduleId: input.scheduleId,
      scheduledAtUtc: now,
      localDay: todayLocalDay("Africa/Cairo", now),
      status: "taken",
      actedAtUtc: now,
      actedBy: input.actedBy,
      quantity: input.quantity,
      idempotencyKey: idem,
    })
    .returning();

  const prev = parseFloat(med.balanceCache ?? "0");
  const qty = parseFloat(input.quantity);
  const next = prev - qty;
  await db.insert(schema.inventoryEvents).values({
    medicationId: med.id,
    personId: input.personId,
    type: "doseTaken",
    qty: String(-qty),
    prevBalance: String(prev),
    newBalance: String(next),
    doseEventId: ev.id,
    atUtc: now,
  });
  await db
    .update(schema.medications)
    .set({ balanceCache: String(next), updatedAt: now })
    .where(eq(schema.medications.id, med.id));

  return { ok: true, doseEventId: ev.id, balance: next };
}

export function doseStatusNow(scheduledAtUtc: Date, status: string): string {
  if (["taken", "skipped", "cancelled"].includes(status)) return status;
  return doseStatusAt(scheduledAtUtc, new Date(), {
    acted: null,
    graceMinutes: GRACE_MINUTES,
  });
}

export async function dosesInRange(personId: string, fromLocal: string, toLocal: string) {
  const db = getDb();
  const rows = await db
    .select({
      dose: schema.doseEvents,
      med: schema.medications,
    })
    .from(schema.doseEvents)
    .innerJoin(schema.medications, eq(schema.medications.id, schema.doseEvents.medicationId))
    .where(
      and(
        eq(schema.doseEvents.personId, personId),
        gte(schema.doseEvents.localDay, fromLocal),
        lte(schema.doseEvents.localDay, toLocal),
      ),
    )
    .orderBy(schema.doseEvents.scheduledAtUtc);
  return rows;
}
