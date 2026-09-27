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
          .from(schema.labResults)
          .where(eq(schema.labResults.personId, personId))
          .orderBy(desc(schema.labResults.date))
      : await db.select().from(schema.labResults).orderBy(desc(schema.labResults.date));
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
      .insert(schema.labResults)
      .values({
        personId: body.personId,
        type: body.type,
        date: body.date,
        fileName: body.fileName || null,
        fileDataUrl: body.fileDataUrl || null,
        notes: body.notes || null,
      })
      .returning();
    return json(row, 201);
  } catch (e) {
    return serverError(e);
  }
}
