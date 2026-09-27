"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp, selectedPerson } from "@/lib/store";
import { api, arTime } from "@/lib/api";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Select,
  Spinner,
  Textarea,
  toast,
} from "@/components/ui";
import clsx from "clsx";

interface Symptom {
  id: string;
  atUtc: string;
  severity: number;
  note: string | null;
  relatedMedicationId: string | null;
}

interface FoodEntry {
  id: string;
  atUtc: string;
  text: string;
}

interface Medication {
  id: string;
  nameAr: string;
}

const SEVERITY_LABELS: Record<number, string> = {
  1: "خفيفة جداً",
  2: "خفيفة",
  3: "متوسطة",
  4: "شديدة",
  5: "شديدة جداً",
};

function severityColor(s: number): "green" | "amber" | "red" {
  if (s <= 2) return "green";
  if (s === 3) return "amber";
  return "red";
}

function SeverityDots({ severity }: { severity: number }) {
  const color = severityColor(severity);
  const filled =
    color === "green"
      ? "bg-green-500"
      : color === "amber"
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-1" dir="ltr" aria-label={`الشدة: ${SEVERITY_LABELS[severity] ?? severity}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={clsx("h-2.5 w-2.5 rounded-full", i <= severity ? filled : "bg-slate-200 dark:bg-slate-600")}
        />
      ))}
    </span>
  );
}

export default function DailyPage() {
  const state = useApp();
  const person = selectedPerson(state);
  const [tab, setTab] = useState<"symptoms" | "food">("symptoms");

  if (!person) return <Spinner />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">الأعراض والطعام</h1>
        <p className="text-sm muted">سجل يومي لـ {person.nameAr}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("symptoms")}
          className={clsx(
            "min-h-touch flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors",
            tab === "symptoms"
              ? "bg-brand-600 text-white"
              : "border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700",
          )}
        >
          الأعراض
        </button>
        <button
          onClick={() => setTab("food")}
          className={clsx(
            "min-h-touch flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors",
            tab === "food"
              ? "bg-brand-600 text-white"
              : "border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700",
          )}
        >
          الطعام
        </button>
      </div>

      {tab === "symptoms" ? <SymptomsTab personId={person.id} /> : <FoodTab personId={person.id} />}
    </div>
  );
}

function SymptomsTab({ personId }: { personId: string }) {
  const [items, setItems] = useState<Symptom[] | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Symptom[]>(`/api/symptoms?personId=${personId}`);
      setItems(r);
    } catch {
      setItems([]);
    }
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<Medication[]>(`/api/medications?personId=${personId}`);
        setMeds(r);
      } catch {
        setMeds([]);
      }
    })();
  }, [personId]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>+ تسجيل عرض</Button>
      </div>

      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="لا توجد أعراض مسجلة" hint="سجّل أي عرض يشعر به المريض مع شدته" />
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <Card key={s.id} className="!py-3">
              <div className="flex items-center justify-between gap-3">
                <SeverityDots severity={s.severity} />
                <span className="shrink-0 text-xs muted">{arTime(s.atUtc)}</span>
              </div>
              {s.note && <p className="mt-1.5 text-sm">{s.note}</p>}
            </Card>
          ))}
        </div>
      )}

      <p className="rounded-xl bg-amber-50 p-3 text-center text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        هذا السجل للمرجعية فقط ولا يُغني عن استشارة الطبيب.
      </p>

      <AddSymptomModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        personId={personId}
        meds={meds}
        busy={busy}
        setBusy={setBusy}
        onSaved={async () => {
          setAddOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function AddSymptomModal({
  open,
  onClose,
  personId,
  meds,
  busy,
  setBusy,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
  meds: Medication[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [severity, setSeverity] = useState(3);
  const [note, setNote] = useState("");
  const [relatedMedicationId, setRelatedMedicationId] = useState("");

  function reset() {
    setSeverity(3);
    setNote("");
    setRelatedMedicationId("");
  }

  async function submit() {
    setBusy(true);
    try {
      await api("/api/symptoms", {
        method: "POST",
        body: {
          personId,
          severity,
          note: note.trim() || null,
          relatedMedicationId: relatedMedicationId || null,
        },
      });
      toast("تم تسجيل العرض ✅");
      reset();
      await onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الحفظ", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="تسجيل عرض">
      <div className="space-y-3">
        <Field label="الشدة">
          <Select value={severity} onChange={(e) => setSeverity(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((s) => (
              <option key={s} value={s}>
                {s} — {SEVERITY_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="وصف العرض">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: دوخة خفيفة بعد جرعة الصباح" />
        </Field>
        <Field label="دواء مرتبط (اختياري)">
          <Select value={relatedMedicationId} onChange={(e) => setRelatedMedicationId(e.target.value)}>
            <option value="">— بدون —</option>
            {meds.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameAr}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2 pt-1">
          <Button onClick={submit} disabled={busy} className="flex-1">
            {busy ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FoodTab({ personId }: { personId: string }) {
  const [items, setItems] = useState<FoodEntry[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<FoodEntry[]>(`/api/food?personId=${personId}`);
      setItems(r);
    } catch {
      setItems([]);
    }
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>+ تسجيل وجبة</Button>
      </div>

      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="لا توجد وجبات مسجلة" hint="سجّل ما تناوله المريض لمتابعة العلاقة مع الدواء" />
      ) : (
        <div className="space-y-2">
          {items.map((f) => (
            <Card key={f.id} className="flex items-center justify-between gap-3 !py-3">
              <span className="min-w-0 truncate font-semibold">{f.text}</span>
              <span className="shrink-0 text-xs muted">{arTime(f.atUtc)}</span>
            </Card>
          ))}
        </div>
      )}

      <AddFoodModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        personId={personId}
        busy={busy}
        setBusy={setBusy}
        onSaved={async () => {
          setAddOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function AddFoodModal({
  open,
  onClose,
  personId,
  busy,
  setBusy,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [text, setText] = useState("");

  async function submit() {
    if (!text.trim()) {
      toast("اكتب وصف الوجبة", "err");
      return;
    }
    setBusy(true);
    try {
      await api("/api/food", { method: "POST", body: { personId, text: text.trim() } });
      toast("تم تسجيل الوجبة ✅");
      setText("");
      await onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الحفظ", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="تسجيل وجبة">
      <div className="space-y-3">
        <Field label="الوجبة">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="مثال: فطور خفيف — جبن وخیار وشاي بالحليب"
          />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button onClick={submit} disabled={busy} className="flex-1">
            {busy ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
}
