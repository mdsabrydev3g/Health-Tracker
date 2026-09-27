"use client";

import { useEffect, useState } from "react";
import { useApp, selectedPerson, type Person } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, Button, Card, Field, Input, Modal, Select, Spinner, Textarea, toast } from "@/components/ui";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const TIMEZONES = ["Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Europe/London", "America/New_York"];

interface PersonForm {
  nameAr: string;
  dob: string;
  gender: string;
  bloodType: string;
  allergies: string;
  notes: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  timezone: string;
  isManagedUser: boolean;
}

const EMPTY_FORM: PersonForm = {
  nameAr: "",
  dob: "",
  gender: "",
  bloodType: "",
  allergies: "",
  notes: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  timezone: "Africa/Cairo",
  isManagedUser: false,
};

function toForm(p: Person | null): PersonForm {
  if (!p) return { ...EMPTY_FORM };
  return {
    nameAr: p.nameAr ?? "",
    dob: p.dob ?? "",
    gender: p.gender ?? "",
    bloodType: p.bloodType ?? "",
    allergies: (p.allergies ?? []).join("، "),
    notes: p.notes ?? "",
    emergencyContactName: p.emergencyContactName ?? "",
    emergencyContactPhone: p.emergencyContactPhone ?? "",
    emergencyContactRelation: p.emergencyContactRelation ?? "",
    timezone: p.timezone ?? "Africa/Cairo",
    isManagedUser: p.isManagedUser ?? false,
  };
}

function toBody(f: PersonForm) {
  return {
    nameAr: f.nameAr.trim(),
    dob: f.dob || null,
    gender: f.gender || null,
    bloodType: f.bloodType || null,
    allergies: f.allergies
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean),
    notes: f.notes.trim() || null,
    emergencyContactName: f.emergencyContactName.trim() || null,
    emergencyContactPhone: f.emergencyContactPhone.trim() || null,
    emergencyContactRelation: f.emergencyContactRelation.trim() || null,
    timezone: f.timezone,
    isManagedUser: f.isManagedUser,
  };
}

export default function PeoplePage() {
  const state = useApp();
  const person = selectedPerson(state);
  const [editing, setEditing] = useState<Person | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (state.persons.length === 0) {
      state.loadPersons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.persons.length === 0 && state.loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">الأشخاص</h1>
          <p className="text-sm muted">ملف كل شخص — البيانات الطبية وجهات الاتصال</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ إضافة شخص</Button>
      </div>

      {state.persons.length === 0 ? (
        <Card className="text-center">
          <p className="font-bold">لا يوجد أشخاص بعد</p>
          <p className="mt-1 text-sm muted">أضِف أول شخص لبدء المتابعة</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {state.persons.map((p) => (
            <Card key={p.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{p.nameAr}</span>
                  {p.isManagedUser && <Badge color="blue">المستخدمة الأساسية</Badge>}
                </div>
                <p className="mt-1 text-xs muted">
                  {p.bloodType ? `فصيلة الدم: ${p.bloodType}` : "فصيلة الدم: —"}
                  {" · "}
                  الحساسيات: {p.allergies.length}
                </p>
                {p.allergies.length > 0 && <p className="mt-0.5 truncate text-xs muted">{p.allergies.join("، ")}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                تعديل
              </Button>
            </Card>
          ))}
        </div>
      )}

      <PersonModal
        open={addOpen}
        editing={null}
        onClose={() => setAddOpen(false)}
      />
      <PersonModal
        open={editing !== null}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function PersonModal({ open, editing, onClose }: { open: boolean; editing: Person | null; onClose: () => void }) {
  const state = useApp();
  const [form, setForm] = useState<PersonForm>(() => toForm(editing));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm(toForm(editing));
  }, [open, editing]);

  function set<K extends keyof PersonForm>(key: K, value: PersonForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.nameAr.trim()) {
      toast("الاسم مطلوب", "err");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api(`/api/persons/${editing.id}`, { method: "PATCH", body: toBody(form) });
        toast("تم حفظ التعديلات ✅");
      } else {
        await api("/api/persons", { method: "POST", body: toBody(form) });
        toast("تم إضافة الشخص ✅");
      }
      await state.loadPersons();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الحفظ", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "تعديل بيانات الشخص" : "إضافة شخص"}>
      <div className="space-y-3">
        <Field label="الاسم">
          <Input value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} placeholder="مثال: الوالدة" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاريخ الميلاد">
            <Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
          </Field>
          <Field label="الجنس">
            <Select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">— اختر —</option>
              <option value="female">أنثى</option>
              <option value="male">ذكر</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="فصيلة الدم">
            <Select value={form.bloodType} onChange={(e) => set("bloodType", e.target.value)}>
              <option value="">— اختر —</option>
              {BLOOD_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المنطقة الزمنية">
            <Select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="الحساسيات" hint="افصل بينها بفاصلة — مثال: بنسلين، مكسرات">
          <Input value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
        </Field>
        <Field label="ملاحظات">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-600">
          <p className="text-sm font-bold">جهة الاتصال في الطوارئ</p>
          <Field label="الاسم">
            <Input
              value={form.emergencyContactName}
              onChange={(e) => set("emergencyContactName", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الهاتف">
              <Input
                type="tel"
                value={form.emergencyContactPhone}
                onChange={(e) => set("emergencyContactPhone", e.target.value)}
              />
            </Field>
            <Field label="صلة القرابة">
              <Input
                value={form.emergencyContactRelation}
                onChange={(e) => set("emergencyContactRelation", e.target.value)}
              />
            </Field>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.isManagedUser}
            onChange={(e) => set("isManagedUser", e.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
          هذا الشخص هو المستخدمة الأساسية (الوالدة)
        </label>
        <div className="flex gap-2 pt-1">
          <Button onClick={submit} disabled={busy} className="flex-1">
            {busy ? "جارٍ الحفظ…" : editing ? "حفظ التعديلات" : "إضافة"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
}
