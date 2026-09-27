"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp, selectedPerson } from "@/lib/store";
import { api, todayStr } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Spinner,
  Textarea,
  fmtNum,
  toast,
} from "@/components/ui";

interface Medication {
  id: string;
  nameAr: string;
  status: string;
  balanceCache: string;
  packageSize: number | null;
  packagePrice: string | null;
  currency: string;
  packExpiry: string | null;
}

interface Schedule {
  medicationId: string;
  kind: string;
  times: string[];
  quantityPerDose: string;
  weekdays: number[];
  intervalN: number | null;
  taperSteps: { from: string; to: string; quantityPerDose: string }[];
  activeTo: string | null;
}

interface InventoryEvent {
  id: string;
  type: string;
  qty: string;
  prevBalance: string;
  newBalance: string;
  atUtc: string;
  reason: string | null;
}

const INV_TYPE_AR: Record<string, string> = {
  initial: "رصيد أولي",
  doseTaken: "جرعة مأخوذة",
  manualAdd: "إضافة يدوية",
  manualRemove: "خصم يدوي",
  purchase: "شراء",
  correction: "تصحيح",
  discontinued: "إيقاف",
};

/** Expected daily consumption for one active schedule (pure, client-side). */
function occurrencesPerDay(s: Schedule, today: string): number {
  switch (s.kind) {
    case "daily":
      return s.times.length;
    case "everyNDays":
      return s.times.length / Math.max(1, s.intervalN ?? 1);
    case "weekdays":
      return s.weekdays.length > 0 ? (s.times.length * s.weekdays.length) / 7 : 0;
    case "taper": {
      const step = s.taperSteps.find((st) => today >= st.from && today <= st.to);
      return step ? s.times.length : 0;
    }
    default:
      return 0;
  }
}

export default function InventoryPage() {
  const state = useApp();
  const person = selectedPerson(state);
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [modal, setModal] = useState<{ med: Medication; type: "purchase" | "manualAdd" | "manualRemove" } | null>(null);
  const [ledgerMed, setLedgerMed] = useState<Medication | null>(null);

  const load = useCallback(async () => {
    if (!person) return;
    try {
      const [m, s] = await Promise.all([
        api<Medication[]>(`/api/medications?personId=${person.id}`),
        api<Schedule[]>("/api/schedules"),
      ]);
      setMeds(m);
      setSchedules(s);
    } catch {
      setMeds([]);
    }
  }, [person]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!meds) return [];
    const today = todayStr(0);
    return meds
      .filter((m) => m.status === "active")
      .map((m) => {
        const active = schedules.filter((s) => s.medicationId === m.id && !s.activeTo && s.kind !== "prn");
        const consumption = active.reduce((acc, s) => acc + occurrencesPerDay(s, today) * parseFloat(s.quantityPerDose), 0);
        const balance = parseFloat(m.balanceCache ?? "0");
        const daysLeft = consumption > 0 ? balance / consumption : Infinity;
        const expired = m.packExpiry ? m.packExpiry <= today : false;
        return { med: m, consumption, balance, daysLeft, expired };
      });
  }, [meds, schedules]);

  if (!person) return <Spinner />;
  if (meds === null) return <Spinner />;

  const lowCount = rows.filter((r) => r.daysLeft <= 2 && r.consumption > 0).length;
  const expiredCount = rows.filter((r) => r.expired).length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">المخزون — {person.nameAr}</h1>

      {(lowCount > 0 || expiredCount > 0) && (
        <Card className="!py-3">
          <div className="flex flex-wrap gap-2">
            {lowCount > 0 && <Badge color="amber">{lowCount} دواء رصيده منخفض</Badge>}
            {expiredCount > 0 && <Badge color="red">{expiredCount} دواء منتهي الصلاحية</Badge>}
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState title="لا توجد أدوية نشطة" hint="أضف أدوية من شاشة الأدوية" />
      ) : (
        <div className="space-y-2">
          {rows.map(({ med, consumption, balance, daysLeft, expired }) => (
            <Card key={med.id} className="!py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{med.nameAr}</span>
                    {balance <= 0 && <Badge color="red">نفد</Badge>}
                    {balance > 0 && consumption > 0 && daysLeft <= 2 && <Badge color="amber">رصيد منخفض</Badge>}
                    {expired && <Badge color="red">منتهي الصلاحية</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm muted">
                    الرصيد: <b>{fmtNum(balance)}</b>
                    {consumption > 0
                      ? ` · يكفي ≈ ${Math.floor(daysLeft)} يوم · استهلاك ${fmtNum(consumption)} يومياً`
                      : " · لا استهلاك مجدول"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => setModal({ med, type: "purchase" })}>
                    شراء علبة
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setModal({ med, type: "manualAdd" })}>
                    إضافة
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setModal({ med, type: "manualRemove" })}>
                    خصم
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLedgerMed(med)}>
                    السجل
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <InventoryModal
          med={modal.med}
          type={modal.type}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {ledgerMed && (
        <LedgerModal
          med={ledgerMed}
          onClose={() => setLedgerMed(null)}
        />
      )}
    </div>
  );
}

function InventoryModal({
  med,
  type,
  onClose,
  onSaved,
}: {
  med: Medication;
  type: "purchase" | "manualAdd" | "manualRemove";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState(String(med.packageSize ?? 1));
  const [price, setPrice] = useState(med.packagePrice ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const title = type === "purchase" ? `شراء علبة — ${med.nameAr}` : type === "manualAdd" ? `إضافة كمية — ${med.nameAr}` : `خصم كمية — ${med.nameAr}`;

  async function submit() {
    if (!qty || Number(qty) <= 0) {
      toast("أدخل كمية صحيحة", "err");
      return;
    }
    if (type === "manualRemove" && !reason.trim()) {
      toast("السبب مطلوب عند الخصم اليدوي", "err");
      return;
    }
    setBusy(true);
    try {
      await api("/api/inventory", {
        method: "POST",
        body: {
          medicationId: med.id,
          type,
          qty: Number(qty),
          packagePrice: price || undefined,
          reason: reason || undefined,
        },
      });
      toast("تم تحديث المخزون ✅");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-3">
        <Field label="الكمية">
          <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        {type === "purchase" && (
          <Field label="سعر العلبة (اختياري)">
            <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        )}
        {type !== "purchase" && (
          <Field label="السبب" hint={type === "manualRemove" ? "مطلوب" : "اختياري"}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
        <Button className="w-full" size="lg" disabled={busy} onClick={submit}>
          تأكيد
        </Button>
      </div>
    </Modal>
  );
}

function LedgerModal({ med, onClose }: { med: Medication; onClose: () => void }) {
  const [events, setEvents] = useState<InventoryEvent[] | null>(null);

  useEffect(() => {
    api<InventoryEvent[]>(`/api/inventory/${med.id}`)
      .then((r) => setEvents(r.slice().reverse()))
      .catch(() => setEvents([]));
  }, [med.id]);

  return (
    <Modal open onClose={onClose} title={`سجل حركات — ${med.nameAr}`}>
      {events === null ? (
        <Spinner />
      ) : events.length === 0 ? (
        <EmptyState title="لا حركات بعد" />
      ) : (
        <div className="space-y-1 text-sm">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between border-b border-slate-100 py-2 dark:border-slate-700">
              <div>
                <b>{INV_TYPE_AR[e.type] ?? e.type}</b>
                {e.reason && <span className="muted"> — {e.reason}</span>}
                <p className="text-xs muted">{e.atUtc.slice(0, 16).replace("T", " ")}</p>
              </div>
              <div className="text-left">
                <span className={Number(e.qty) >= 0 ? "font-bold text-green-600" : "font-bold text-red-600"}>
                  {Number(e.qty) >= 0 ? "+" : ""}
                  {fmtNum(e.qty)}
                </span>
                <p className="text-xs muted">الرصيد: {fmtNum(e.newBalance)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
