import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError, writeAudit } from "@/server/api-helpers";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const db = getDb();
    const [med] = await db.select().from(schema.medications).where(eq(schema.medications.id, params.id));
    if (!med) return json({ error: "not_found" }, 404);
    const scheds = await db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.medicationId, params.id));
    const events = await db
      .select()
      .from(schema.inventoryEvents)
      .where(eq(schema.inventoryEvents.medicationId, params.id));
    return json({ medication: med, schedules: scheds, inventoryEvents: events });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = await req.json();
    const db = getDb();
    const [before] = await db
      .select()
      .from(schema.medications)
      .where(eq(schema.medications.id, params.id));
    if (!before) return json({ error: "not_found" }, 404);
    const [row] = await db
      .update(schema.medications)
      .set({
        nameAr: body.nameAr ?? before.nameAr,
        nameEn: body.nameEn ?? before.nameEn,
        strengthValue: body.strengthValue !== undefined ? String(body.strengthValue) : before.strengthValue,
        strengthUnit: body.strengthUnit ?? before.strengthUnit,
        form: body.form ?? before.form,
        notes: body.notes ?? before.notes,
        packExpiry: body.packExpiry ?? before.packExpiry,
        startDate: body.startDate ?? before.startDate,
        endDate: body.endDate ?? before.endDate,
        foodRule: body.foodRule ?? before.foodRule,
        foodRuleText: body.foodRuleText ?? before.foodRuleText,
        packagePrice: body.packagePrice !== undefined ? String(body.packagePrice) : before.packagePrice,
        packageSize: body.packageSize ?? before.packageSize,
        purchasedAt: body.purchasedAt ?? before.purchasedAt,
        doctor: body.doctor ?? before.doctor,
        condition: body.condition ?? before.condition,
        status: body.status ?? before.status,
        discontinuedReason: body.discontinuedReason ?? before.discontinuedReason,
        updatedAt: new Date(),
      })
      .where(eq(schema.medications.id, params.id))
      .returning();
    await writeAudit({
      entity: "medication",
      entityId: params.id,
      action: "update",
      before: before as never,
      after: row as never,
    });
    return json(row);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const db = getDb();
    const [before] = await db
      .select()
      .from(schema.medications)
      .where(eq(schema.medications.id, params.id));
    await db
      .update(schema.medications)
      .set({ deleted: true, status: "discontinued", updatedAt: new Date() })
      .where(eq(schema.medications.id, params.id));
    await writeAudit({
      entity: "medication",
      entityId: params.id,
      action: "delete",
      before: before as never,
    });
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
