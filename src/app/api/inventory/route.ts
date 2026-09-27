import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError, writeAudit } from "@/server/api-helpers";

/**
 * POST — manual inventory mutation: purchase | manualAdd | manualRemove | correction.
 * Every mutation writes a ledger event with prev/new balance; corrections require a reason.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getDb();
    const [med] = await db
      .select()
      .from(schema.medications)
      .where(eq(schema.medications.id, body.medicationId));
    if (!med) return json({ error: "medication_not_found" }, 404);

    const type = String(body.type);
    if (!["purchase", "manualAdd", "manualRemove", "correction"].includes(type)) {
      return json({ error: "invalid_type" }, 400);
    }
    if (type === "correction" && !body.reason) {
      return json({ error: "correction_requires_reason" }, 400);
    }

    let delta = Number(body.qty);
    if (type === "manualRemove") delta = -Math.abs(delta);
    if (type === "purchase") delta = Math.abs(delta) || Number(med.packageSize ?? 0);

    const prev = parseFloat(med.balanceCache ?? "0");
    const next = prev + delta;
    const now = new Date();

    await db.insert(schema.inventoryEvents).values({
      medicationId: med.id,
      personId: med.personId,
      type,
      qty: String(delta),
      reason: body.reason || null,
      prevBalance: String(prev),
      newBalance: String(next),
      atUtc: now,
    });
    await db
      .update(schema.medications)
      .set({
        balanceCache: String(next),
        updatedAt: now,
        ...(type === "purchase"
          ? { purchasedAt: now.toISOString().slice(0, 10), packagePrice: body.packagePrice ? String(body.packagePrice) : med.packagePrice }
          : {}),
      })
      .where(eq(schema.medications.id, med.id));

    await writeAudit({
      entity: "inventory",
      entityId: med.id,
      action: type,
      after: { delta, newBalance: next, reason: body.reason },
    });
    return json({ ok: true, balance: next }, 201);
  } catch (e) {
    return serverError(e);
  }
}
