import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError, writeAudit } from "@/server/api-helpers";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(schema.persons).where(eq(schema.persons.deleted, false));
    return json(rows);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getDb();
    const [row] = await db
      .insert(schema.persons)
      .values({
        nameAr: body.nameAr,
        dob: body.dob || null,
        gender: body.gender || null,
        bloodType: body.bloodType || null,
        allergies: body.allergies ?? [],
        notes: body.notes || null,
        emergencyContactName: body.emergencyContactName || null,
        emergencyContactPhone: body.emergencyContactPhone || null,
        emergencyContactRelation: body.emergencyContactRelation || null,
        timezone: body.timezone || process.env.DEFAULT_TIMEZONE || "Africa/Cairo",
        isManagedUser: Boolean(body.isManagedUser),
        colorTag: body.colorTag || "#1d6ff0",
      })
      .returning();
    await writeAudit({ entity: "person", entityId: row.id, action: "create", after: row as never });
    return json(row, 201);
  } catch (e) {
    return serverError(e);
  }
}
