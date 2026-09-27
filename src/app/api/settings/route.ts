import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError } from "@/server/api-helpers";

/** App settings (theme, thresholds, numeral style, notification prefs…) */
export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(schema.settings);
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.key] = r.value;
    return json(out);
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { key: string; value: Record<string, unknown> };
    if (!body.key) return json({ error: "key_required" }, 400);
    const db = getDb();
    await db
      .insert(schema.settings)
      .values({ key: body.key, value: body.value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: body.value, updatedAt: new Date() },
      });
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
