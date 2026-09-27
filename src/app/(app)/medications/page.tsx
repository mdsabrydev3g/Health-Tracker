"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApp, selectedPerson } from "@/lib/store";
import { api, todayStr } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
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

interface Medication {
  id: string;
  nameAr: string;
  nameEn: string | null;
  strengthValue: string | null;
  strengthUnit: string | null;
  form: string;
  status: string;
  balanceCache: string;
  foodRule: string;
  packExpiry: string | null;
  doctor: string | null;
  condition: string | null;
  notes: string | null;
  isPrescription: boolean;
  isControlled: boolean;
  packagePrice: string | null;
  currency: string;
  packageSize: number | null;
}

export default function MedicationsPage() {
  const state = useApp();
  const person = selectedPerson(state);
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    if (!person) return;
    try {
      setMeds(await api<Medication[]>(`/api/medications?personId=${person.id}`));
    } catch {
      setMeds([]);
    }
  }, [person]);

  useEffect(() => {
    load();
  }, [load]);

  if (!person) return <Spinner />;
  if (meds === null) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">الأدوية — {person.nameAr}</h1>
        <Button onClick={() => setAddOpen(true)}>+ إضافة دواء</Button>
      </div>

      {meds.length === 0 ? (
        <EmptyState title="لا توجد أدوية بعد" hint="أضف أول دواء بجدول جرعاته" />
      ) : (
        <div className="space-y-2">
          {meds.map((m) => (
            <Link key={m.id} href={`/medications/${m.id}`} className="block">
              <Card className="flex items-center justify-between !py-3 hover:shadow-md">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{m.nameAr}</span>
                    <Badge color={m.status === "active" ? "green" : "gray"}>{STATUS_AR[m.status]}</Badge>
                    {m.isControlled && <Badge color="red">مراقب</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm muted">
                    {FORM_AR[m.form]}
                    {m.strengthValue ? ` · ${fmtNum(m.strengthValue)} ${m.strengthUnit ?? ""}` : ""}
                    {m.foodRule !== "none" ? ` · ${FOOD_RULE_AR[m.foodRule]}` : ""}
                    {` · الرصيد: ${fmtNum(m.balanceCache)}`}
                  </p>
                </div>
                <span className="muted">←</span>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <AddMedicationModal open={addOpen} onClose={() => setAddOpen(false)} personId={person.id} onSaved={load} />
    </div>
  );
}

function AddMedicationModal({
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
  const [f, setF] = useState({
    nameAr: "",
    nameEn: "",
    form: "tablet",
    strengthValue: "",
    strengthUnit: "mg",
    foodRule: "none",
    foodRuleText: "",
    doctor: "",
    condition: "",
    notes: "",
    isPrescription: false,
    packExpiry: "",
    packageSize: "",
    packagePrice: "",
    initialQuantity: "",
  });
  const [schedule, setSchedule] = useState<ScheduleForm>({ ...defaultSchedule });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!f.nameAr.trim()) {
      toast("اسم الدواء مطلوب", "err");
      return;
    }
    setBusy(true);
    try {
      await api("/api/medications", {
        method: "POST",
        body: {
          personId,
          nameAr: f.nameAr,
          nameEn: f.nameEn || null,
          form: f.form,
          strengthValue: f.strengthValue || null,
          strengthUnit: f.strengthUnit,
          foodRule: f.foodRule,
          foodRuleText: f.foodRuleText || null,
          doctor: f.doctor || null,
          condition: f.condition || null,
          notes: f.notes || null,
          isPrescription: f.isPrescription,
          packExpiry: f.packExpiry || null,
          packageSize: f.packageSize ? Number(f.packageSize) : null,
          packagePrice: f.packagePrice || null,
          initialQuantity: f.initialQuantity || f.packageSize || 0,
          schedule:
            schedule.kind !== "prn" || schedule.times.length
              ? {
                  kind: schedule.kind,
                  times: schedule.times,
                  quantityPerDose: schedule.quantityPerDose,
                  intervalN: schedule.intervalN,
                  weekdays: schedule.weekdays,
                  taperSteps: schedule.taperSteps,
                  anchorDate: todayStr(0),
                }
              : null,
        },
      });
      toast("تمت إضافة الدواء ✅");
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الحفظ", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إضافة دواء جديد">
      <div className="space-y-3">
        <Field label="اسم الدواء (بالعربية) *">
          <Input value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="الاسم الإنجليزي">
            <Input value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} />
          </Field>
          <Field label="الشكل">
            <Select value={f.form} onChange={(e) => setF({ ...f, form: e.target.value })}>
              {Object.entries(FORM_AR).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="التركيز">
            <Input
              type="number"
              step="any"
              value={f.strengthValue}
              onChange={(e) => setF({ ...f, strengthValue: e.target.value })}
            />
          </Field>
          <Field label="وحدة التركيز">
            <Select value={f.strengthUnit} onChange={(e) => setF({ ...f, strengthUnit: e.target.value })}>
              {["mg", "mcg", "IU", "ml", "g"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </Field>
          <Field label="قاعدة الطعام">
            <Select value={f.foodRule} onChange={(e) => setF({ ...f, foodRule: e.target.value })}>
              {Object.entries(FOOD_RULE_AR).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="تفاصيل الطعام (اختياري)">
            <Input value={f.foodRuleText} onChange={(e) => setF({ ...f, foodRuleText: e.target.value })} />
          </Field>
          <Field label="الطبيب">
            <Input value={f.doctor} onChange={(e) => setF({ ...f, doctor: e.target.value })} />
          </Field>
          <Field label="الحالة المرضية">
            <Input value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} />
          </Field>
          <Field label="تاريخ انتهاء العلبة">
            <Input type="date" value={f.packExpiry} onChange={(e) => setF({ ...f, packExpiry: e.target.value })} />
          </Field>
          <Field label="حجم العلبة (عدد الوحدات)">
            <Input
              type="number"
              value={f.packageSize}
              onChange={(e) => setF({ ...f, packageSize: e.target.value })}
            />
          </Field>
          <Field label="سعر العلبة">
            <Input
              type="number"
              step="any"
              value={f.packagePrice}
              onChange={(e) => setF({ ...f, packagePrice: e.target.value })}
            />
          </Field>
          <Field label="الكمية الحالية" hint="اتركها فارغة لتساوي حجم العلبة">
            <Input
              type="number"
              value={f.initialQuantity}
              onChange={(e) => setF({ ...f, initialQuantity: e.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={f.isPrescription}
            onChange={(e) => setF({ ...f, isPrescription: e.target.checked })}
          />
          دواء بوصفة طبية
        </label>
        <Field label="ملاحظات">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>

        <p className="pt-2 font-bold">جدول الجرعات</p>
        <ScheduleFields schedule={schedule} onChange={setSchedule} />

        <Button className="w-full" size="lg" disabled={busy} onClick={submit}>
          {busy ? "جارٍ الحفظ…" : "حفظ الدواء"}
        </Button>
        <p className="text-center text-xs muted">راجع البيانات قبل الحفظ — يمكن تعديل الجدول لاحقاً دون فقدان السجل</p>
      </div>
    </Modal>
  );
}
