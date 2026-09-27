"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, todayStr } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  Field,
  FORM_AR,
  FOOD_RULE_AR,
  Input,
  Modal,
  Select,
  Spinner,
  STATUS_AR,
  Textarea,
  fmtNum,
  toast,
} from "@/components/ui";
import { ScheduleFields, defaultSchedule, type ScheduleForm } from "@/components/schedule-form";
import { QrGenerateModal } from "@/components/qr-generate";
import { encodeMedQr } from "@/lib/med-qr";

interface Medication {
  id: string;
  personId: string;
  nameAr: string;
  nameEn: string | null;
  strengthValue: string | null;
  strengthUnit: string | null;
  form: string;
  status: string;
  balanceCache: string;
  foodRule: string;
  foodRuleText: string | null;
  packExpiry: string | null;
  startDate: string | null;
  doctor: string | null;
  condition: string | null;
  notes: string | null;
  isPrescription: boolean;
  isControlled: boolean;
  packagePrice: string | null;
  currency: string;
  packageSize: number | null;
  discontinuedReason: string | null;
}

interface Schedule {
  id: string;
  kind: string;
  times: string[];
  quantityPerDose: string;
  anchorDate: string;
  endDate: string | null;
  weekdays: number[];
  intervalN: number | null;
  prnMaxPerDay: number | null;
  taperSteps: { from: string; to: string; quantityPerDose: string }[];
  activeFrom: string;
  activeTo: string | null;
}

interface InventoryEvent {
  id: string;
  type: string;
  qty: string;
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

const KIND_AR: Record<string, string> = {
  daily: "يومي",
  everyNDays: "كل N يوم",
  weekdays: "أيام محددة",
  prn: "عند الحاجة",
  taper: "تخفيض تدريجي",
};

const WEEKDAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function MedicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [med, setMed] = useState<Medication | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [events, setEvents] = useState<InventoryEvent[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ medication: Medication; schedules: Schedule[]; inventoryEvents: InventoryEvent[] }>(
        `/api/medications/${id}`,
      );
      setMed(r.medication);
      setSchedules(r.schedules.sort((a, b) => (a.activeTo ? 1 : -1)));
      setEvents(r.inventoryEvents);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ", "err");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(status: string) {
    await api(`/api/medications/${id}`, { method: "PATCH", body: { status } });
    toast("تم التحديث");
    load();
  }

  async function remove() {
    if (!confirm("حذف هذا الدواء؟ سيبقى سجل الجرعات القديمة محفوظاً.")) return;
    await api(`/api/medications/${id}`, { method: "DELETE" });
    toast("تم الحذف");
    router.push("/medications");
  }

  async function logPrn() {
    const cur = schedules.find((s) => !s.activeTo);
    if (!cur) return;
    await api("/api/prn-dose", {
      method: "POST",
      body: { personId: med!.personId, medicationId: med!.id, quantity: cur.quantityPerDose },
    });
    toast("تم تسجيل الجرعة ✅");
    load();
  }

  if (!med) return <Spinner />;

  const current = schedules.find((s) => !s.activeTo) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-extrabold">{med.nameAr}</h1>
          <Badge color={med.status === "active" ? "green" : med.status === "paused" ? "amber" : "gray"}>
            {STATUS_AR[med.status]}
          </Badge>
          {med.isPrescription && <Badge color="blue">بوصفة</Badge>}
          {med.isControlled && <Badge color="red">دواء مراقب</Badge>}
        </div>
        <p className="mt-1 muted">
          {FORM_AR[med.form]}
          {med.strengthValue ? ` · ${fmtNum(med.strengthValue)} ${med.strengthUnit ?? ""}` : ""}
          {med.nameEn ? ` · ${med.nameEn}` : ""}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <p>الرصيد الحالي: <b>{fmtNum(med.balanceCache)}</b></p>
          <p>قاعدة الطعام: <b>{FOOD_RULE_AR[med.foodRule]}{med.foodRuleText ? ` — ${med.foodRuleText}` : ""}</b></p>
          {med.doctor && <p>الطبيب: <b>{med.doctor}</b></p>}
          {med.condition && <p>الحالة: <b>{med.condition}</b></p>}
          {med.startDate && <p>بداية التعاطي: <b>{med.startDate}</b></p>}
          {med.packExpiry && <p>انتهاء العلبة: <b>{med.packExpiry}</b></p>}
          {med.packageSize && <p>حجم العلبة: <b>{med.packageSize}</b></p>}
          {med.packagePrice && <p>سعر العلبة: <b>{fmtNum(med.packagePrice)} {med.currency}</b></p>}
        </div>
        {med.notes && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-700">{med.notes}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            تعديل البيانات
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
            🔳 إنشاء QR
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSchedOpen(true)}>
            + جدول جديد (يغلق القديم)
          </Button>
          {current?.kind === "prn" && med.status === "active" && (
            <Button variant="success" size="sm" onClick={logPrn}>
              تسجيل جرعة عند الحاجة
            </Button>
          )}
          {med.status === "active" ? (
            <Button variant="outline" size="sm" onClick={() => setStatus("paused")}>
              إيقاف مؤقت
            </Button>
          ) : med.status === "paused" ? (
            <Button variant="success" size="sm" onClick={() => setStatus("active")}>
              استئناف
            </Button>
          ) : null}
          <Button variant="danger" size="sm" onClick={remove}>
            حذف
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-bold">الجداول (السجل كامل)</h2>
        <div className="mt-2 space-y-2">
          {schedules.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border p-3 text-sm ${
                s.activeTo ? "border-slate-200 opacity-70 dark:border-slate-700" : "border-green-400"
              }`}
            >
              <div className="flex items-center gap-2">
                <b>{KIND_AR[s.kind]}</b>
                {!s.activeTo ? <Badge color="green">الحالي</Badge> : <Badge color="gray">مغلق</Badge>}
              </div>
              <p className="mt-1 muted">
                {s.times.length ? `المواعيد: ${s.times.join("، ")}` : "بلا مواعيد ثابتة"}
                {s.kind === "everyNDays" ? ` · كل ${s.intervalN} يوم` : ""}
                {s.kind === "weekdays" && s.weekdays.length
                  ? ` · ${s.weekdays.slice().sort().map((w) => WEEKDAY_AR[w]).join("، ")}`
                  : ""}
                {` · الكمية: ${fmtNum(s.quantityPerDose)}`}
                {s.prnMaxPerDay ? ` · بحد أقصى ${s.prnMaxPerDay} يومياً` : ""}
              </p>
              {s.taperSteps.length > 0 && (
                <p className="mt-1 text-xs muted">
                  {s.taperSteps.map((st) => `${st.from}→${st.to}: ${st.quantityPerDose}`).join(" | ")}
                </p>
              )}
              <p className="mt-1 text-xs muted">فعّال من {s.activeFrom.slice(0, 10)}{s.activeTo ? ` إلى ${s.activeTo.slice(0, 10)}` : ""}</p>
            </div>
          ))}
          {schedules.length === 0 && <p className="text-sm muted">لا يوجد جدول — أضف جدول جرعات</p>}
        </div>
      </Card>

      <Card>
        <h2 className="font-bold">آخر حركات المخزون</h2>
        <div className="mt-2 space-y-1 text-sm">
          {events
            .slice()
            .reverse()
            .slice(-10)
            .map((e) => (
              <div key={e.id} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-700">
                <span>
                  {INV_TYPE_AR[e.type] ?? e.type}
                  {e.reason ? ` (${e.reason})` : ""}
                </span>
                <span className="muted">
                  {Number(e.qty) > 0 ? "+" : ""}
                  {fmtNum(e.qty)} ← {fmtNum(e.newBalance)} · {e.atUtc.slice(0, 16).replace("T", " ")}
                </span>
              </div>
            ))}
          {events.length === 0 && <p className="muted">لا حركات بعد</p>}
        </div>
      </Card>

      <EditModal open={editOpen} onClose={() => setEditOpen(false)} med={med} onSaved={load} />
      {qrOpen && (
        <QrGenerateModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          title={`QR — ${med.nameAr}`}
          payload={encodeMedQr({
            nameAr: med.nameAr,
            nameEn: med.nameEn,
            strengthValue: med.strengthValue,
            strengthUnit: med.strengthUnit,
            form: med.form,
            quantityPerDose: current ? Number(current.quantityPerDose) : 1,
            times: current?.times ?? [],
            foodRule: med.foodRule,
            doctor: med.doctor,
          })}
        />
      )}
      <NewScheduleModal
        open={schedOpen}
        onClose={() => setSchedOpen(false)}
        medicationId={med.id}
        supersedes={current?.id ?? null}
        onSaved={load}
      />
    </div>
  );
}

function EditModal({
  open,
  onClose,
  med,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  med: Medication;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    nameAr: med.nameAr,
    nameEn: med.nameEn ?? "",
    strengthValue: med.strengthValue ?? "",
    strengthUnit: med.strengthUnit ?? "mg",
    form: med.form,
    foodRule: med.foodRule,
    foodRuleText: med.foodRuleText ?? "",
    doctor: med.doctor ?? "",
    condition: med.condition ?? "",
    notes: med.notes ?? "",
    packExpiry: med.packExpiry ?? "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF({
        nameAr: med.nameAr,
        nameEn: med.nameEn ?? "",
        strengthValue: med.strengthValue ?? "",
        strengthUnit: med.strengthUnit ?? "mg",
        form: med.form,
        foodRule: med.foodRule,
        foodRuleText: med.foodRuleText ?? "",
        doctor: med.doctor ?? "",
        condition: med.condition ?? "",
        notes: med.notes ?? "",
        packExpiry: med.packExpiry ?? "",
      });
    }
  }, [open, med]);

  async function submit() {
    setBusy(true);
    try {
      await api(`/api/medications/${med.id}`, {
        method: "PATCH",
        body: {
          nameAr: f.nameAr,
          nameEn: f.nameEn || null,
          strengthValue: f.strengthValue || null,
          strengthUnit: f.strengthUnit,
          form: f.form,
          foodRule: f.foodRule,
          foodRuleText: f.foodRuleText || null,
          doctor: f.doctor || null,
          condition: f.condition || null,
          notes: f.notes || null,
          packExpiry: f.packExpiry || null,
        },
      });
      toast("تم الحفظ ✅");
      onSaved();
      onClose();
    } catch {
      toast("خطأ في الحفظ", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="تعديل بيانات الدواء">
      <div className="space-y-3">
        <Field label="الاسم">
          <Input value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="التركيز">
            <Input type="number" step="any" value={f.strengthValue} onChange={(e) => setF({ ...f, strengthValue: e.target.value })} />
          </Field>
          <Field label="الوحدة">
            <Select value={f.strengthUnit} onChange={(e) => setF({ ...f, strengthUnit: e.target.value })}>
              {["mg", "mcg", "IU", "ml", "g"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </Field>
          <Field label="قاعدة الطعام">
            <Select value={f.foodRule} onChange={(e) => setF({ ...f, foodRule: e.target.value })}>
              {Object.entries(FOOD_RULE_AR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="انتهاء العلبة">
            <Input type="date" value={f.packExpiry} onChange={(e) => setF({ ...f, packExpiry: e.target.value })} />
          </Field>
        </div>
        <Field label="ملاحظات">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <Button className="w-full" disabled={busy} onClick={submit}>
          حفظ
        </Button>
      </div>
    </Modal>
  );
}

function NewScheduleModal({
  open,
  onClose,
  medicationId,
  supersedes,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  medicationId: string;
  supersedes: string | null;
  onSaved: () => void;
}) {
  const [schedule, setSchedule] = useState<ScheduleForm>({ ...defaultSchedule });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api("/api/schedules", {
        method: "POST",
        body: {
          medicationId,
          supersedes,
          kind: schedule.kind,
          times: schedule.times,
          quantityPerDose: schedule.quantityPerDose,
          intervalN: schedule.intervalN,
          weekdays: schedule.weekdays,
          taperSteps: schedule.taperSteps,
          anchorDate: todayStr(0),
        },
      });
      toast("تم إنشاء الجدول الجديد — الجرعات القادمة ستتبعه ✅");
      onSaved();
      onClose();
    } catch {
      toast("خطأ في الحفظ", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="جدول جرعات جديد">
      <div className="space-y-3">
        {supersedes && (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            سيتم إغلاق الجدول الحالي والاحتفاظ بسجل الجرعات القديمة كما هو.
          </p>
        )}
        <ScheduleFields schedule={schedule} onChange={setSchedule} />
        <Button className="w-full" size="lg" disabled={busy} onClick={submit}>
          {busy ? "جارٍ الحفظ…" : "إنشاء الجدول"}
        </Button>
      </div>
    </Modal>
  );
}
