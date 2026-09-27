import { and, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError } from "@/server/api-helpers";
import { adherenceStats, adherenceStreak } from "@/core/engine/adherence.engine";
import { todayLocalDay } from "@/core/time/clock";

/**
 * GET ?personId=...&days=30 — adherence stats + streaks + cost report.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const personId = url.searchParams.get("personId");
    if (!personId) return json({ error: "personId_required" }, 400);
    const days = Math.min(365, Math.max(7, Number(url.searchParams.get("days") ?? 30)));

    const db = getDb();
    const [person] = await db.select().from(schema.persons).where(eq(schema.persons.id, personId));
    if (!person) return json({ error: "person_not_found" }, 404);
    const tz = person.timezone;

    const cutoff = new Date(Date.now() - days * 86400000);
    const doseRows = await db
      .select()
      .from(schema.doseEvents)
      .where(and(eq(schema.doseEvents.personId, personId), gte(schema.doseEvents.scheduledAtUtc, cutoff)));

    const stats = adherenceStats(
      doseRows.map((d) => ({
        scheduledAtUtc: d.scheduledAtUtc,
        status: d.status,
        localDay: d.localDay,
      })),
      new Date(),
    );
    const streak = adherenceStreak(
      doseRows.map((d) => ({ scheduledAtUtc: d.scheduledAtUtc, status: d.status, localDay: d.localDay })),
      todayLocalDay(tz),
    );

    // Cost report: purchases + dose consumption in window
    const meds = await db
      .select()
      .from(schema.medications)
      .where(and(eq(schema.medications.personId, personId), eq(schema.medications.deleted, false)));
    const purchases = meds.reduce(
      (acc, m) => acc + parseFloat(m.packagePrice ?? "0"),
      0,
    );

    // daily adherence series
    const byDay = new Map<string, { taken: number; total: number }>();
    for (const d of doseRows) {
      if (d.scheduledAtUtc > new Date()) continue;
      if (!["taken", "missed", "skipped"].includes(d.status)) continue;
      const cur = byDay.get(d.localDay) ?? { taken: 0, total: 0 };
      cur.total++;
      if (d.status === "taken") cur.taken++;
      byDay.set(d.localDay, cur);
    }
    const series = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, v]) => ({ day, pct: v.total ? Math.round((v.taken / v.total) * 100) : 0, ...v }));

    return json({
      days,
      stats,
      streak,
      totalPurchaseValue: purchases,
      currency: meds[0]?.currency ?? "EGP",
      series,
    });
  } catch (e) {
    return serverError(e);
  }
}
