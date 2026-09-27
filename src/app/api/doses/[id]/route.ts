import { json, serverError, writeAudit } from "@/server/api-helpers";
import { skipDose, snoozeDose, takeDose } from "@/server/dose-service";

type Params = { params: { id: string } };

/** PATCH { action: "take" | "skip" | "snooze", minutes? } */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = await req.json();
    const actedBy = body.actedBy === "mother" ? "mother" : "caregiver";
    switch (body.action) {
      case "take": {
        const r = await takeDose(params.id, actedBy);
        if (!r.alreadyTaken) {
          await writeAudit({ entity: "dose", entityId: params.id, action: "take", after: { actedBy } });
        }
        return json(r);
      }
      case "skip": {
        await skipDose(params.id, actedBy);
        await writeAudit({ entity: "dose", entityId: params.id, action: "skip", after: { actedBy } });
        return json({ ok: true });
      }
      case "snooze": {
        const minutes = Math.min(240, Math.max(5, Number(body.minutes ?? 10)));
        await snoozeDose(params.id, minutes);
        await writeAudit({
          entity: "dose",
          entityId: params.id,
          action: "snooze",
          after: { minutes },
        });
        return json({ ok: true });
      }
      default:
        return json({ error: "invalid_action" }, 400);
    }
  } catch (e) {
    return serverError(e);
  }
}
