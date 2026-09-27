import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError, writeAudit } from "@/server/api-helpers";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = await req.json();
    const db = getDb();
    const [before] = await db.select().from(schema.persons).where(eq(schema.persons.id, params.id));
    if (!before) return json({ error: "not_found" }, 404);
    const [row] = await db
      .update(schema.persons)
      .set({
        nameAr: body.nameAr ?? before.nameAr,
        dob: body.dob ?? before.dob,
        gender: body.gender ?? before.gender,
        bloodType: body.bloodType ?? before.bloodType,
        allergies: body.allergies ?? before.allergies,
        notes: body.notes ?? before.notes,
        emergencyContactName: body.emergencyContactName ?? before.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone ?? before.emergencyContactPhone,
        emergencyContactRelation: body.emergencyContactRelation ?? before.emergencyContactRelation,
        timezone: body.timezone ?? before.timezone,
        isManagedUser: body.isManagedUser ?? before.isManagedUser,
        colorTag: body.colorTag ?? before.colorTag,
        updatedAt: new Date(),
      })
      .where(eq(schema.persons.id, params.id))
      .returning();
    await writeAudit({
      entity: "person",
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
    await db
      .update(schema.persons)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(schema.persons.id, params.id));
    await writeAudit({ entity: "person", entityId: params.id, action: "delete" });
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
