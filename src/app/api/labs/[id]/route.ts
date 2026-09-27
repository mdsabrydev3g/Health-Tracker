import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError } from "@/server/api-helpers";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    await db
      .update(schema.labResults)
      .set({ deleted: true })
      .where(eq(schema.labResults.id, params.id));
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
