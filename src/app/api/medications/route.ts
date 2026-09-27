import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError, writeAudit } from "@/server/api-helpers";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const personId = url.searchParams.get("personId");
    const db = getDb();
    const where = personId
      ? and(eq(schema.medications.personId, personId), eq(schema.medications.deleted, false))
      : eq(schema.medications.deleted, false);
    const rows = await db.select().from(schema.medications).where(where);
    return json(rows);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getDb();
    const now = new Date();
    const [row] = await db
      .insert(schema.medications)
      .values({
        personId: body.personId,
        nameAr: body.nameAr,
        nameEn: body.nameEn || null,
        activeIngredients: body.activeIngredients ?? [],
        strengthValue: body.strengthValue ? String(body.strengthValue) : null,
        strengthUnit: body.strengthUnit || null,
        form: body.form || "tablet",
        manufacturer: body.manufacturer || null,
        notes: body.notes || null,
        isPrescription: Boolean(body.isPrescription),
        isControlled: Boolean(body.isControlled),
        packExpiry: body.packExpiry || null,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        foodRule: body.foodRule || "none",
        foodRuleText: body.foodRuleText || null,
        packagePrice: body.packagePrice ? String(body.packagePrice) : null,
        currency: body.currency || "EGP",
        packageSize: body.packageSize ? Number(body.packageSize) : null,
        purchasedAt: body.purchasedAt || null,
        doctor: body.doctor || null,
        condition: body.condition || null,
        status: "active",
        balanceCache: "0",
      })
      .returning();

    // Initial stock event if a package was purchased
    const initialQty = Number(body.initialQuantity ?? body.packageSize ?? 0);
    if (initialQty > 0) {
      await db.insert(schema.inventoryEvents).values({
        medicationId: row.id,
        personId: body.personId,
        type: "initial",
        qty: String(initialQty),
        prevBalance: "0",
        newBalance: String(initialQty),
        atUtc: now,
      });
      await db
        .update(schema.medications)
        .set({ balanceCache: String(initialQty) })
        .where(eq(schema.medications.id, row.id));
      row.balanceCache = String(initialQty);
    }

    // First schedule if provided inline
    if (body.schedule) {
      await db.insert(schema.schedules).values({
        medicationId: row.id,
        kind: body.schedule.kind,
        times: body.schedule.times ?? [],
        quantityPerDose: String(body.schedule.quantityPerDose ?? "1"),
        anchorDate: body.schedule.anchorDate || new Date().toISOString().slice(0, 10),
        endDate: body.schedule.endDate || null,
        weekdays: body.schedule.weekdays ?? [],
        intervalN: body.schedule.intervalN ?? null,
        prnMaxPerDay: body.schedule.prnMaxPerDay ?? null,
        taperSteps: body.schedule.taperSteps ?? [],
      });
    }

    await writeAudit({ entity: "medication", entityId: row.id, action: "create", after: row as never });
    return json(row, 201);
  } catch (e) {
    return serverError(e);
  }
}
