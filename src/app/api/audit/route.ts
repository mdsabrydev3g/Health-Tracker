import { desc } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError } from "@/server/api-helpers";

export async function GET(req: Request) {
  try {
    const limit = Math.min(500, Number(new URL(req.url).searchParams.get("limit") ?? 100));
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.atUtc))
      .limit(limit);
    return json(rows);
  } catch (e) {
    return serverError(e);
  }
}
