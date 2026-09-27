"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp, selectedPerson } from "@/lib/store";
import { api, arDate, arTime, dosesWord, todayStr } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Spinner, STATUS_AR, toast, fmtNum, FOOD_RULE_AR } from "@/components/ui";
import { scheduleDoseReminders } from "@/lib/notify";
import clsx from "clsx";

interface Dose {
  id: string;
  medicationName: string;
  form: string;
  strengthValue: string | null;
  strengthUnit: string | null;
  foodRule: string;
  foodRuleText: string | null;
  scheduledAtUtc: string;
  localDay: string;
  status: string;
  quantity: string;
  actedBy: string | null;
}

export default function TodayPage() {
  const state = useApp();
  const person = selectedPerson(state);
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!person) return;
    try {
      const r = await api<{ doses: Dose[] }>(
        `/api/doses?personId=${person.id}&from=${todayStr(0)}&to=${todayStr(0)}`,
      );
      setDoses(r.doses);
      scheduleDoseReminders(r.doses);
    } catch {
      setDoses([]);
    }
  }, [person]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const next = useMemo(
    () => doses?.find((d) => ["upcoming", "due", "snoozed"].includes(d.status)) ?? null,
    [doses],
  );
  const taken = doses?.filter((d) => d.status === "taken").length ?? 0;
  const total = doses?.length ?? 0;

  async function act(dose: Dose, action: "take" | "skip" | "snooze") {
    setBusyId(dose.id);
    try {
      await api(`/api/doses/${dose.id}`, { method: "PATCH", body: { action } });
      toast(
        action === "take" ? "تم تسجيل الجرعة ✅" : action === "skip" ? "تم التخطي" : "تم التأجيل",
      );
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ", "err");
    } finally {
      setBusyId(null);
    }
  }

  if (!person) return <Spinner />;
  if (doses === null) return <Spinner />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">{arDate(todayStr(0))}</h1>
        <p className="text-sm muted">
          متابعة {person.nameAr} — {total > 0 ? `${dosesWord(taken)} تم أخذها من أصل ${total}` : "لا جرعات اليوم"}
        </p>
      </div>

      {next ? (
        <Card className="border-2 border-brand-500 !p-6 text-center">
          <p className="text-sm font-bold text-brand-700 dark:text-brand-300">الجرعة القادمة</p>
          <h2 className="mt-1 text-2xl font-extrabold">{next.medicationName}</h2>
          <p className="mt-1 text-lg">
            {fmtNum(next.quantity)} {next.form === "tablet" ? "قرص" : ""} · {arTime(next.scheduledAtUtc)}
            {next.strengthValue ? ` · ${fmtNum(next.strengthValue)} ${next.strengthUnit ?? ""}` : ""}
          </p>
          {next.foodRule !== "none" && (
            <p className="mt-1 text-sm muted">
              {FOOD_RULE_AR[next.foodRule]}
              {next.foodRuleText ? ` — ${next.foodRuleText}` : ""}
            </p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button variant="success" size="lg" disabled={busyId === next.id} onClick={() => act(next, "take")}>
              أخذت الدواء
            </Button>
            <Button variant="outline" size="lg" disabled={busyId === next.id} onClick={() => act(next, "skip")}>
              تخطي
            </Button>
            <Button variant="outline" size="lg" disabled={busyId === next.id} onClick={() => act(next, "snooze")}>
              تأجيل ١٠د
            </Button>
          </div>
        </Card>
      ) : (
        total > 0 && (
          <Card className="border-2 border-green-500 text-center !p-6">
            <p className="text-3xl" aria-hidden>
              🎉
            </p>
            <p className="mt-1 font-bold text-green-700 dark:text-green-400">
              كل جرعات اليوم تمت — لا توجد جرعات قادمة
            </p>
          </Card>
        )
      )}

      {doses.length === 0 ? (
        <EmptyState
          title="لا توجد جرعات مجدولة اليوم"
          hint="أضِف دواءً وجدول جرعات من شاشة الأدوية"
        />
      ) : (
        <div className="space-y-2">
          {doses.map((d) => (
            <Card key={d.id} className="flex items-center justify-between gap-3 !py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{arTime(d.scheduledAtUtc)}</span>
                  <StatusBadge status={d.status} />
                </div>
                <p className="mt-0.5 truncate font-semibold">{d.medicationName}</p>
                <p className="text-xs muted">
                  {fmtNum(d.quantity)} · {STATUS_AR[d.status]}
                  {d.actedBy === "mother" ? " (سجلته الوالدة)" : d.actedBy === "caregiver" ? " (سجلته أنت)" : ""}
                </p>
              </div>
              {["upcoming", "due", "snoozed", "missed"].includes(d.status) && (
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="success" disabled={busyId === d.id} onClick={() => act(d, "take")}>
                    ✓
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => act(d, "snooze")}>
                    تأجيل
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href="/calendar" className="card p-3 text-center text-sm font-bold hover:shadow-md">
          📅 التقويم
        </Link>
        <Link href="/daily" className="card p-3 text-center text-sm font-bold hover:shadow-md">
          📝 تسجيل عرض / وجبة
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "taken" ? "green" : status === "missed" ? "red" : status === "due" ? "amber" : "gray";
  return <Badge color={color}>{STATUS_AR[status] ?? status}</Badge>;
}
