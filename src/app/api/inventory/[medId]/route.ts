import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError } from "@/server/api-helpers";

/** GET — ledger events for a medication (append-only history). */
export async function GET(_req: Request, { params }: { params: { medId: string } }) {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.inventoryEvents)
      .where(eq(schema.inventoryEvents.medicationId, params.medId));
    return json(rows);
  } catch (e) {
    return serverError(e);
  }
}
