import { eq } from "drizzle-orm";
import { getDb, schema } from "@/core/db/client";
import { json, serverError, writeAudit } from "@/server/api-helpers";

/**
 * GET — full JSON export (schema-versioned, portable).
 * POST — restore: inserts exported rows that do not exist yet (by id); never overwrites.
 */
const SCHEMA_VERSION = 1;

export async function GET() {
  try {
    const db = getDb();
    const dump = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      app: "health-tracker",
      persons: await db.select().from(schema.persons),
      medications: await db.select().from(schema.medications),
      schedules: await db.select().from(schema.schedules),
      doseEvents: await db.select().from(schema.doseEvents),
      inventoryEvents: await db.select().from(schema.inventoryEvents),
      labResults: await db.select().from(schema.labResults),
      symptoms: await db.select().from(schema.symptoms),
      foodLogs: await db.select().from(schema.foodLogs),
      recurringTests: await db.select().from(schema.recurringTests),
      auditLogs: await db.select().from(schema.auditLogs),
      settings: await db.select().from(schema.settings),
    };
    return json(dump);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const dump = await req.json();
    if (dump.schemaVersion !== SCHEMA_VERSION || dump.app !== "health-tracker") {
      return json({ error: "unsupported_schema" }, 400);
    }
    const db = getDb();
    let inserted = 0;

    for (const p of dump.persons ?? []) {
      const r = await db.insert(schema.persons).values(p).onConflictDoNothing().returning();
      inserted += r.length;
    }
    for (const m of dump.medications ?? []) {
      const r = await db.insert(schema.medications).values(m).onConflictDoNothing().returning();
      inserted += r.length;
    }
    for (const s of dump.schedules ?? []) {
      const r = await db.insert(schema.schedules).values(s).onConflictDoNothing().returning();
      inserted += r.length;
    }
    for (const d of dump.doseEvents ?? []) {
      const r = await db.insert(schema.doseEvents).values(d).onConflictDoNothing().returning();
      inserted += r.length;
    }
    for (const i of dump.inventoryEvents ?? []) {
      const r = await db.insert(schema.inventoryEvents).values(i).onConflictDoNothing().returning();
      inserted += r.length;
    }
    for (const l of dump.labResults ?? []) {
      const r = await db.insert(schema.labResults).values(l).onConflictDoNothing().returning();
      inserted += r.length;
    }
    for (const s of dump.symptoms ?? []) {
      const r = await db.insert(schema.symptoms).values(s).onConflictDoNothing().returning();
      inserted += r.length;
    }
    for (const f of dump.foodLogs ?? []) {
      const r = await db.insert(schema.foodLogs).values(f).onConflictDoNothing().returning();
      inserted += r.length;
    }
    for (const t of dump.recurringTests ?? []) {
      const r = await db.insert(schema.recurringTests).values(t).onConflictDoNothing().returning();
      inserted += r.length;
    }

    await writeAudit({ entity: "backup", entityId: "restore", action: "restore", after: { inserted } });
    return json({ ok: true, inserted });
  } catch (e) {
    return serverError(e);
  }
}
