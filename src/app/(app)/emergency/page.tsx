"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp, selectedPerson } from "@/lib/store";
import { api } from "@/lib/api";
import { Button, Card, EmptyState, Spinner, FORM_AR, toast } from "@/components/ui";

interface Medication {
  id: string;
  nameAr: string;
  strengthValue: string | null;
  strengthUnit: string | null;
  form: string;
  status: string;
}

const PRINT_CSS = `
@media print {
  header, nav, .print\\:hidden { display: none !important; }
  body { background: #fff !important; }
  .emergency-print { box-shadow: none !important; border: 2px solid #000 !important; }
}
`;

export default function EmergencyPage() {
  const state = useApp();
  const person = selectedPerson(state);
  const [meds, setMeds] = useState<Medication[] | null>(null);

  const load = useCallback(async () => {
    if (!person) return;
    try {
      const rows = await api<Medication[]>(`/api/medications?personId=${person.id}`);
      setMeds(rows.filter((m) => m.status === "active"));
    } catch {
      setMeds([]);
    }
  }, [person]);

  useEffect(() => {
    load();
  }, [load]);

  if (!person) return <Spinner />;
  if (meds === null) return <Spinner />;

  async function share() {
    if (!person) return;
    const text = [
      `بطاقة طوارئ — ${person.nameAr}`,
      person.bloodType ? `فصيلة الدم: ${person.bloodType}` : null,
      person.allergies.length ? `الحساسية: ${person.allergies.join("، ")}` : null,
      person.emergencyContactName
        ? `جهة الاتصال: ${person.emergencyContactName} (${person.emergencyContactRelation ?? "—"}) ${person.emergencyContactPhone ?? ""}`
        : null,
      meds && meds.length > 0
        ? `الأدوية الحالية: ${meds.map((m) => `${m.nameAr} ${m.strengthValue ? `${m.strengthValue}${m.strengthUnit ?? ""}` : ""}`).join("؛ ")}`
        : null,
      "هذه البطاقة لأغراض الطوارئ فقط",
    ]
      .filter(Boolean)
      .join("\n");

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "بطاقة الطوارئ", text });
        return;
      } catch {
        /* user cancelled — fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("تم نسخ بطاقة الطوارئ إلى الحافظة");
    } catch {
      toast("تعذر النسخ", "err");
    }
  }

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-extrabold">بطاقة الطوارئ</h1>
          <p className="text-sm muted">اعرضيها للطبيب أو المُسعف عند الحاجة</p>
        </div>
      </div>

      <Card className="emergency-print space-y-4 border-2 border-red-500 !p-6">
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-red-600 dark:text-red-400">بطاقة طوارئ طبية</p>
          <h2 className="mt-1 text-3xl font-black">{person.nameAr}</h2>
        </div>

        <div className="flex items-center justify-center gap-3 rounded-xl bg-red-50 py-3 text-center dark:bg-red-900/30 print:bg-white">
          <span className="text-sm font-bold muted">فصيلة الدم</span>
          <span className="text-4xl font-black text-red-600 dark:text-red-400">{person.bloodType ?? "—"}</span>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-red-700 dark:text-red-300">الحساسية</h3>
          {person.allergies.length > 0 ? (
            <ul className="mt-1 list-inside list-disc space-y-1 text-lg font-bold text-red-600 dark:text-red-400">
              {person.allergies.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-base muted">لا توجد حساسية مسجلة</p>
          )}
        </div>

        <div>
          <h3 className="text-lg font-extrabold">جهة الاتصال للطوارئ</h3>
          {person.emergencyContactName ? (
            <p className="mt-1 text-lg">
              <span className="font-bold">{person.emergencyContactName}</span>
              {person.emergencyContactRelation ? ` (${person.emergencyContactRelation})` : ""}
              {person.emergencyContactPhone ? (
                <>
                  {" — "}
                  <a href={`tel:${person.emergencyContactPhone}`} className="font-bold text-brand-700 dark:text-brand-300" dir="ltr">
                    {person.emergencyContactPhone}
                  </a>
                </>
              ) : null}
            </p>
          ) : (
            <p className="mt-1 text-base muted">لم تُضف بعد</p>
          )}
        </div>

        <div>
          <h3 className="text-lg font-extrabold">الأدوية الحالية</h3>
          {meds.length === 0 ? (
            <EmptyState title="لا توجد أدوية نشطة" />
          ) : (
            <ul className="mt-1 space-y-1.5 text-base">
              {meds.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-200 pb-1.5 dark:border-slate-700">
                  <span className="font-bold">{m.nameAr}</span>
                  <span className="muted">
                    {m.strengthValue ? `${m.strengthValue}${m.strengthUnit ?? ""} · ` : ""}
                    {FORM_AR[m.form] ?? m.form}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="border-t border-slate-200 pt-3 text-center text-xs muted dark:border-slate-700">
          هذه البطاقة لأغراض الطوارئ فقط
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-2 print:hidden">
        <Button size="lg" onClick={() => window.print()}>
          طباعة
        </Button>
        <Button size="lg" variant="outline" onClick={share}>
          مشاركة
        </Button>
      </div>
    </div>
  );
}
