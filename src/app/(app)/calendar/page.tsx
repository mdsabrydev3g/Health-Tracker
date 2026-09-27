"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp, selectedPerson } from "@/lib/store";
import { api, arDate, arTime, todayStr } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  STATUS_AR,
  toast,
} from "@/components/ui";

interface Dose {
  id: string;
  medicationName: string;
  scheduledAtUtc: string;
  localDay: string;
  status: string;
  quantity: string;
}

interface RecurringTest {
  id: string;
  name: string;
  interval: string;
  nextDue: string;
  lastDone: string | null;
}

const INTERVAL_AR: Record<string, string> = {
  monthly: "شهري",
  "3m": "كل 3 أشهر",
  "6m": "كل 6 أشهر",
  yearly: "سنوي",
  custom: "مخصص",
};

function weekStart(offsetWeeks = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetWeeks * 7);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const state = useApp();
  const person = selectedPerson(state);
  const [weekOffset, setWeekOffset] = useState(0);
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [tests, setTests] = useState<RecurringTest[]>([]);
  const [addTest, setAddTest] = useState(false);

  const from = weekStart(weekOffset);
  const to = useMemo(() => {
    const [y, m, d] = from.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 6);
    return dt.toISOString().slice(0, 10);
  }, [from]);

  const loadDoses = useCallback(async () => {
    if (!person) return;
    try {
      const r = await api<{ doses: Dose[] }>(`/api/doses?personId=${person.id}&from=${from}&to=${to}`);
      setDoses(r.doses);
    } catch {
      setDoses([]);
    }
  }, [person, from, to]);

  const loadTests = useCallback(async () => {
    if (!person) return;
    try {
      setTests(await api<RecurringTest[]>(`/api/recurring-tests?personId=${person.id}`));
    } catch {
      setTests([]);
    }
  }, [person]);

  useEffect(() => {
    loadDoses();
  }, [loadDoses]);
  useEffect(() => {
    loadTests();
  }, [loadTests]);

  async function markDone(t: RecurringTest) {
    await api("/api/recurring-tests", { method: "PATCH", body: { id: t.id } });
    toast("تم تسجيل الفحص وتحديث الموعد القادم ✅");
    loadTests();
  }

  const byDay = useMemo(() => {
    if (!doses) return new Map<string, Dose[]>();
    const map = new Map<string, Dose[]>();
    for (const d of doses) {
      const arr = map.get(d.localDay) ?? [];
      arr.push(d);
      map.set(d.localDay, arr);
    }
    return map;
  }, [doses]);

  if (!person) return <Spinner />;
  if (doses === null) return <Spinner />;

  const days = Array.from({ length: 7 }, (_, i) => {
    const [y, m, d] = from.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + i);
    return dt.toISOString().slice(0, 10);
  });
  const today = todayStr(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">التقويم</h1>
        <Button onClick={() => setAddTest(true)}>+ فحص دوري</Button>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
          ← الأسبوع السابق
        </Button>
        <span className="text-sm font-bold">
          {arDate(from)} — {arDate(to)}
        </span>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
          الأسبوع التالي →
        </Button>
      </div>

      <div className="space-y-3">
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          return (
            <Card key={day} className={day === today ? "border-2 border-brand-500" : ""}>
              <div className="flex items-center gap-2">
                <b>{arDate(day)}</b>
                {day === today && <Badge color="blue">اليوم</Badge>}
                {list.length > 0 && <span className="text-xs muted">{list.length} جرعة</span>}
              </div>
              {list.length === 0 ? (
                <p className="mt-1 text-sm muted">لا جرعات</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {list.map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-sm">
                      <span>
                        {arTime(d.scheduledAtUtc)} — <b>{d.medicationName}</b>
                      </span>
                      <Badge
                        color={
                          d.status === "taken"
                            ? "green"
                            : d.status === "missed"
                              ? "red"
                              : d.status === "due"
                                ? "amber"
                                : "gray"
                        }
                      >
                        {STATUS_AR[d.status] ?? d.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <h2 className="font-bold">الفحوصات الدورية</h2>
        <div className="mt-2 space-y-2">
          {tests.length === 0 && <p className="text-sm muted">لا فحوصات دورية — أضف فحصاً مثل تحليل الدم الشهري</p>}
          {tests.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
              <div>
                <b>{t.name}</b>
                <p className="text-xs muted">
                  {INTERVAL_AR[t.interval] ?? t.interval} · القادم: {t.nextDue}
                  {t.lastDone ? ` · آخر مرة: ${t.lastDone}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {t.nextDue <= today && <Badge color="red">مستحق</Badge>}
                <Button size="sm" variant="outline" onClick={() => markDone(t)}>
                  تم الفحص
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <AddTestModal
        open={addTest}
        onClose={() => setAddTest(false)}
        personId={person.id}
        onSaved={() => {
          setAddTest(false);
          loadTests();
        }}
      />
    </div>
  );
}

function AddTestModal({
  open,
  onClose,
  personId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
  onSaved: () => void;
}) {
  const [f, setF] = useState({ name: "", interval: "monthly", customDays: "", nextDue: todayStr(7) });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!f.name.trim()) {
      toast("اسم الفحص مطلوب", "err");
      return;
    }
    setBusy(true);
    try {
      await api("/api/recurring-tests", {
        method: "POST",
        body: {
          personId,
          name: f.name,
          interval: f.interval,
          customDays: f.interval === "custom" && f.customDays ? Number(f.customDays) : null,
          nextDue: f.nextDue,
        },
      });
      toast("تمت الإضافة ✅");
      onSaved();
    } catch {
      toast("خطأ في الحفظ", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="فحص دوري جديد">
      <div className="space-y-3">
        <Field label="اسم الفحص *">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="تحليل دم شامل" />
        </Field>
        <Field label="التكرار">
          <Select value={f.interval} onChange={(e) => setF({ ...f, interval: e.target.value })}>
            {Object.entries(INTERVAL_AR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        {f.interval === "custom" && (
          <Field label="عدد الأيام">
            <Input
              type="number"
              value={f.customDays}
              onChange={(e) => setF({ ...f, customDays: e.target.value })}
            />
          </Field>
        )}
        <Field label="الموعد القادم">
          <Input type="date" value={f.nextDue} onChange={(e) => setF({ ...f, nextDue: e.target.value })} />
        </Field>
        <Button className="w-full" disabled={busy} onClick={submit}>
          حفظ
        </Button>
      </div>
    </Modal>
  );
}
