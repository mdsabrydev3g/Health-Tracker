import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError, writeAudit } from "@/server/api-helpers";

/** GET ?medicationId=... — schedules of a medication (history included) */
export async function GET(req: Request) {
  try {
    const medicationId = new URL(req.url).searchParams.get("medicationId");
    const db = getDb();
    const rows = medicationId
      ? await db.select().from(schema.schedules).where(eq(schema.schedules.medicationId, medicationId))
      : await db.select().from(schema.schedules);
    return json(rows);
  } catch (e) {
    return serverError(e);
  }
}

/**
 * POST — create a schedule. If `supersedes` is provided, the old schedule is
 * closed (activeTo set, supersededBy linked) — history is never destroyed.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getDb();
    const now = new Date();

    if (body.supersedes) {
      await db
        .update(schema.schedules)
        .set({ activeTo: now, supersededBy: null })
        .where(eq(schema.schedules.id, body.supersedes));
    }

    const [row] = await db
      .insert(schema.schedules)
      .values({
        medicationId: body.medicationId,
        kind: body.kind,
        times: body.times ?? [],
        quantityPerDose: String(body.quantityPerDose ?? "1"),
        anchorDate: body.anchorDate || now.toISOString().slice(0, 10),
        endDate: body.endDate || null,
        weekdays: body.weekdays ?? [],
        intervalN: body.intervalN ?? null,
        prnMaxPerDay: body.prnMaxPerDay ?? null,
        taperSteps: (body.taperSteps ?? []).map(
          (s: { from: string; to: string; quantityPerDose: string | number }) => ({
            from: s.from,
            to: s.to,
            quantityPerDose: String(s.quantityPerDose),
          }),
        ),
      })
      .returning();

    if (body.supersedes) {
      await db
        .update(schema.schedules)
        .set({ supersededBy: row.id })
        .where(eq(schema.schedules.id, body.supersedes));
    }

    await writeAudit({ entity: "schedule", entityId: row.id, action: "create", after: row as never });
    return json(row, 201);
  } catch (e) {
    return serverError(e);
  }
}
