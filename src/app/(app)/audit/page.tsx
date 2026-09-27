"use client";

import { useEffect, useState } from "react";
import { api, arDate, arTime } from "@/lib/api";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui";

interface AuditRow {
  id: string;
  actor: string | null;
  entity: string;
  entityId: string | null;
  action: string;
  atUtc: string;
}

const ENTITY_AR: Record<string, string> = {
  person: "شخص",
  medication: "دواء",
  schedule: "جدول",
  dose: "جرعة",
  inventory: "مخزون",
  backup: "نسخ احتياطي",
};

const ACTION_AR: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  take: "أخذ جرعة",
  skip: "تخطي",
  snooze: "تأجيل",
  restore: "استعادة",
  purchase: "شراء",
  manualAdd: "إضافة",
  manualRemove: "خصم",
  correction: "تصحيح",
};

function actionColor(action: string): "green" | "red" | "gray" {
  if (action === "create" || action === "restore" || action === "manualAdd") return "green";
  if (action === "delete" || action === "manualRemove") return "red";
  return "gray";
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    api<AuditRow[]>("/api/audit?limit=200")
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  if (rows === null) return <Spinner />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">سجل التغييرات</h1>
        <p className="text-sm muted">كل ما حدث في التطبيق مرتّب من الأحدث إلى الأقدم</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="لا توجد تغييرات مسجلة بعد" hint="ستظهر هنا كل الإضافات والتعديلات" />
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge color={actionColor(r.action)}>{ACTION_AR[r.action] ?? r.action}</Badge>
                    <span className="text-xs muted">{ENTITY_AR[r.entity] ?? r.entity}</span>
                  </div>
                  <p className="mt-1 text-xs muted">
                    {arDate(r.atUtc.slice(0, 10))} · {arTime(r.atUtc)}
                    {r.actor ? ` · بواسطة: ${r.actor}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
