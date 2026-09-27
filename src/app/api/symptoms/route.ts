import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError } from "@/server/api-helpers";

export async function GET(req: Request) {
  try {
    const personId = new URL(req.url).searchParams.get("personId");
    const db = getDb();
    const rows = personId
      ? await db
          .select()
          .from(schema.symptoms)
          .where(eq(schema.symptoms.personId, personId))
          .orderBy(desc(schema.symptoms.atUtc))
      : await db.select().from(schema.symptoms).orderBy(desc(schema.symptoms.atUtc));
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
      .insert(schema.symptoms)
      .values({
        personId: body.personId,
        severity: Math.min(5, Math.max(1, Number(body.severity ?? 3))),
        note: body.note || null,
        relatedMedicationId: body.relatedMedicationId || null,
      })
      .returning();
    return json(row, 201);
  } catch (e) {
    return serverError(e);
  }
}
