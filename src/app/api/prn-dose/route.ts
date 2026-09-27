import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError } from "@/server/api-helpers";
import { logPrnTake } from "@/server/dose-service";

/** POST — log a PRN (as-needed) dose take. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getDb();
    // find the prn schedule for this medication
    const [sched] = await db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.medicationId, body.medicationId));
    if (!sched) return json({ error: "schedule_not_found" }, 400);

    const r = await logPrnTake({
      personId: body.personId,
      medicationId: body.medicationId,
      scheduleId: sched.id,
      quantity: String(body.quantity ?? "1"),
      actedBy: body.actedBy === "mother" ? "mother" : "caregiver",
    });
    return json(r, 201);
  } catch (e) {
    return serverError(e);
  }
}
