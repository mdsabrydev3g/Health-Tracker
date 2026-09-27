"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp, selectedPerson } from "@/lib/store";
import { api, arTime, todayStr } from "@/lib/api";
import { Button, Modal, Field, Input, toast, fmtNum, FOOD_RULE_AR } from "@/components/ui";
import { hashPasswordClient } from "@/lib/pin";

/**
 * Mother Mode — the managed person's screen: one giant next-dose card,
 * one-tap take, snooze, today's progress. Exit requires the caregiver PIN.
 */

interface Dose {
  id: string;
  medicationName: string;
  scheduledAtUtc: string;
  status: string;
  quantity: string;
  foodRule: string;
  foodRuleText: string | null;
  strengthValue: string | null;
  strengthUnit: string | null;
}

export default function MotherModePage() {
  const state = useApp();
  const person = selectedPerson(state);
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");

  const load = useCallback(async () => {
    if (!person) return;
    try {
      const r = await api<{ doses: Dose[] }>(
        `/api/doses?personId=${person.id}&from=${todayStr(0)}&to=${todayStr(0)}`,
      );
      setDoses(r.doses);
    } catch {
      setDoses([]);
    }
  }, [person]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const next = useMemo(
    () => doses?.find((d) => ["upcoming", "due", "snoozed"].includes(d.status)) ?? null,
    [doses],
  );
  const taken = doses?.filter((d) => d.status === "taken").length ?? 0;
  const total = doses?.length ?? 0;

  async function act(action: "take" | "snooze") {
    if (!next) return;
    try {
      await api(`/api/doses/${next.id}`, {
        method: "PATCH",
        body: { action, actedBy: "mother" },
      });
      toast(action === "take" ? "أحسنتِ! تم التسجيل ✅" : "حسناً، سنذكّرك بعد قليل");
      await load();
    } catch {
      toast("تعذر التسجيل، حاولي مرة أخرى", "err");
    }
  }

  async function unlock() {
    const stored = localStorage.getItem("ht_caregiver_pin");
    if (stored && hashPasswordClient(pin) === stored) {
      localStorage.removeItem("ht_mother_mode");
      window.location.href = "/";
      return;
    }
    toast("رمز غير صحيح", "err");
  }

  if (doses === null) {
    return (
      <div className="flex min-h-screen items-center justify-center mother-mode">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="mother-mode mx-auto flex min-h-screen max-w-2xl flex-col justify-between p-6">
      <header className="text-center">
        <h1 className="text-3xl font-extrabold">❤️‍🩹 Health Tracker</h1>
        {person && <p className="mt-1 text-lg muted">{person.nameAr}</p>}
      </header>

      {next ? (
        <div className="card my-6 border-4 border-brand-500 p-8 text-center">
          <p className="text-2xl font-bold text-brand-700 dark:text-brand-300">حان موعد جرعة</p>
          <h2 className="mt-2 text-4xl font-extrabold leading-tight">{next.medicationName}</h2>
          <p className="mt-3 text-2xl">
            {fmtNum(next.quantity)}
            {next.strengthValue ? ` · ${fmtNum(next.strengthValue)} ${next.strengthUnit ?? ""}` : ""}
          </p>
          <p className="mt-1 text-2xl muted">{arTime(next.scheduledAtUtc)}</p>
          {next.foodRule !== "none" && (
            <p className="mt-2 text-xl font-bold text-amber-600">
              {FOOD_RULE_AR[next.foodRule]}
              {next.foodRuleText ? ` — ${next.foodRuleText}` : ""}
            </p>
          )}
          <div className="mt-8 space-y-4">
            <Button
              variant="success"
              className="mother-btn w-full"
              onClick={() => act("take")}
            >
              ✅ أخذت الدواء
            </Button>
            <Button variant="outline" className="mother-btn w-full" onClick={() => act("snooze")}>
              ⏰ تأجيل
            </Button>
          </div>
        </div>
      ) : (
        <div className="card my-6 border-4 border-green-500 p-8 text-center">
          <p className="text-6xl" aria-hidden>
            🌟
          </p>
          <p className="mt-3 text-3xl font-extrabold text-green-700 dark:text-green-400">
            لا توجد جرعات الآن
          </p>
          <p className="mt-2 text-xl muted">
            {total > 0 ? `تم أخذ ${taken} من ${total} جرعات اليوم` : "اليوم بلا جرعات مجدولة"}
          </p>
        </div>
      )}

      {/* Progress dots */}
      <div className="mb-6 flex justify-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full ${i < taken ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"}`}
          />
        ))}
      </div>

      {/* Hidden exit gesture: tap version text 3 times */}
      <button
        className="self-center text-xs opacity-30"
        onClick={() => {
          const el = document.getElementById("exit-tap");
          const n = (parseInt(el?.dataset.n ?? "0") ?? 0) + 1;
          if (el) el.dataset.n = String(n);
          if (n >= 3) setPinOpen(true);
        }}
        id="exit-tap"
        data-n="0"
        aria-label="خروج مخفي"
      >
        Health Tracker v1.0
      </button>

      <Modal open={pinOpen} onClose={() => setPinOpen(false)} title="رمز مقدم الرعاية">
        <div className="space-y-4">
          <Field label="أدخل الرمز للخروج من وضع الأم" hint="الرمز يُضبط من شاشة الإعدادات في وضع مقدم الرعاية">
            <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
          </Field>
          <Button className="w-full" onClick={unlock}>
            فتح
          </Button>
          <Link href="/" className="block text-center text-sm muted">
            إلغاء
          </Link>
        </div>
      </Modal>
    </div>
  );
}
