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
          .from(schema.foodLogs)
          .where(eq(schema.foodLogs.personId, personId))
          .orderBy(desc(schema.foodLogs.atUtc))
      : await db.select().from(schema.foodLogs).orderBy(desc(schema.foodLogs.atUtc));
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
      .insert(schema.foodLogs)
      .values({
        personId: body.personId,
        text: body.text,
        relatedMedicationId: body.relatedMedicationId || null,
      })
      .returning();
    return json(row, 201);
  } catch (e) {
    return serverError(e);
  }
}
