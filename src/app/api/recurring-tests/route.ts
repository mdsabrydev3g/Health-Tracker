import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError } from "@/server/api-helpers";

export async function GET(req: Request) {
  try {
    const personId = new URL(req.url).searchParams.get("personId");
    const db = getDb();
    const rows = personId
      ? await db.select().from(schema.recurringTests).where(eq(schema.recurringTests.personId, personId))
      : await db.select().from(schema.recurringTests);
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
      .insert(schema.recurringTests)
      .values({
        personId: body.personId,
        name: body.name,
        interval: body.interval,
        customDays: body.customDays ? Number(body.customDays) : null,
        nextDue: body.nextDue,
        lastDone: body.lastDone || null,
        notes: body.notes || null,
      })
      .returning();
    return json(row, 201);
  } catch (e) {
    return serverError(e);
  }
}

/** PATCH { id, lastDone } — mark a test done and roll nextDue forward. */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.recurringTests)
      .where(eq(schema.recurringTests.id, body.id));
    if (!row) return json({ error: "not_found" }, 404);

    const done = body.lastDone || new Date().toISOString().slice(0, 10);
    const days: Record<string, number> = { monthly: 30, "3m": 90, "6m": 182, yearly: 365 };
    const step = row.interval === "custom" ? (row.customDays ?? 30) : days[row.interval] ?? 30;
    const [y, m, d] = done.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + step);

    const [updated] = await db
      .update(schema.recurringTests)
      .set({ lastDone: done, nextDue: dt.toISOString().slice(0, 10) })
      .where(eq(schema.recurringTests.id, body.id))
      .returning();
    return json(updated);
  } catch (e) {
    return serverError(e);
  }
}
