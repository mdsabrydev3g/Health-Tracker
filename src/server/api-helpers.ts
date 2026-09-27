import { NextResponse } from "next/server";
import { getDb, schema } from "@/core/db/client";

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data as object, typeof init === "number" ? { status: init } : init);
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export function serverError(e: unknown) {
  console.error("[api]", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

export async function writeAudit(entry: {
  entity: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  try {
    const db = getDb();
    await db.insert(schema.auditLogs).values({
      actor: "caregiver",
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
  } catch {
    // audit must never break the request
  }
}

export function parseBody<T>(raw: unknown): T {
  return raw as T;
}
