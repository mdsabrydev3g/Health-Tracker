import { json, serverError } from "@/server/api-helpers";
import { dosesInRange, syncDoses } from "@/server/dose-service";

/**
 * GET ?personId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Triggers dose materialisation (idempotent) then returns the joined view.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const personId = url.searchParams.get("personId");
    if (!personId) return json({ error: "personId_required" }, 400);
    const from = url.searchParams.get("from") ?? todayOffset(-1);
    const to = url.searchParams.get("to") ?? todayOffset(14);

    await syncDoses({ personId });
    const rows = await dosesInRange(personId, from, to);

    const doses = rows.map(({ dose, med }) => ({
      id: dose.id,
      medicationId: dose.medicationId,
      medicationName: med.nameAr,
      form: med.form,
      strengthValue: med.strengthValue,
      strengthUnit: med.strengthUnit,
      foodRule: med.foodRule,
      foodRuleText: med.foodRuleText,
      scheduleId: dose.scheduleId,
      scheduledAtUtc: dose.scheduledAtUtc,
      localDay: dose.localDay,
      status: dose.status,
      quantity: dose.quantity,
      actedAtUtc: dose.actedAtUtc,
      actedBy: dose.actedBy,
      snoozedUntil: dose.snoozedUntil,
    }));
    return json({ doses });
  } catch (e) {
    return serverError(e);
  }
}

function todayOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
