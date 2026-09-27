"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp, selectedPerson } from "@/lib/store";
import { api, arDate, todayStr } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Spinner, toast, fmtNum } from "@/components/ui";
import clsx from "clsx";

interface SeriesItem {
  day: string;
  pct: number;
  taken: number;
  total: number;
}

interface ReportData {
  days: number;
  stats: { taken: number; missed: number; skipped: number; counted: number; pct: number };
  streak: number;
  totalPurchaseValue: number;
  currency: string;
  series: SeriesItem[];
}

function pctColor(pct: number): { stroke: string; text: string; bar: string; badge: "green" | "amber" | "red" } {
  if (pct >= 90)
    return { stroke: "#16a34a", text: "text-green-600 dark:text-green-400", bar: "bg-green-500", badge: "green" };
  if (pct >= 70)
    return { stroke: "#d97706", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", badge: "amber" };
  return { stroke: "#dc2626", text: "text-red-600 dark:text-red-400", bar: "bg-red-500", badge: "red" };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const state = useApp();
  const person = selectedPerson(state);
  const [days, setDays] = useState(7);
  const [data, setData] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!person) return;
    try {
      const r = await api<ReportData>(`/api/reports?personId=${person.id}&days=${days}`);
      setData(r);
    } catch {
      setData(null);
      toast("تعذر تحميل التقرير", "err");
    }
  }, [person, days]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["اليوم", "نسبة الالتزام %", "تم الأخذ", "الإجمالي"],
      ...data.series.map((s) => [s.day, String(s.pct), String(s.taken), String(s.total)]),
      [],
      ["الفترة", `${data.days} يوم`],
      ["نسبة الالتزام الكلية %", String(data.stats.pct)],
      ["تم الأخذ", String(data.stats.taken)],
      ["فاتت", String(data.stats.missed)],
      ["تم التخطي", String(data.stats.skipped)],
      ["سلسلة الالتزام (يوم)", String(data.streak)],
    ];
    const csv = "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `health-tracker-report-${todayStr(0)}.csv`);
    toast("تم تنزيل ملف CSV");
  }

  async function exportJson() {
    setBusy(true);
    try {
      const dump = await api<Record<string, unknown>>("/api/backup");
      downloadBlob(
        new Blob([JSON.stringify(dump, null, 2)], { type: "application/json;charset=utf-8;" }),
        `health-tracker-backup-${todayStr(0)}.json`,
      );
      toast("تم تنزيل ملف JSON");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ", "err");
    } finally {
      setBusy(false);
    }
  }

  if (!person) return <Spinner />;
  if (!data) return <Spinner />;

  const c = pctColor(data.stats.pct);
  const R = 54;
  const C = 2 * Math.PI * R;
  const dash = (Math.min(100, Math.max(0, data.stats.pct)) / 100) * C;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">التقارير</h1>
        <p className="text-sm muted">ملخص التزام {person.nameAr} بالدواء</p>
      </div>

      {/* Days selector */}
      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            size="sm"
            variant={days === d ? "primary" : "outline"}
            onClick={() => setDays(d)}
            className="flex-1"
          >
            آخر {fmtNum(d)} يوم
          </Button>
        ))}
      </div>

      {/* Adherence summary */}
      <Card className="text-center">
        <div className="mx-auto flex max-w-xs items-center justify-center gap-4">
          <svg viewBox="0 0 128 128" className="h-32 w-32 shrink-0 -rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-200 dark:text-slate-700" />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke={c.stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C - dash}`}
            />
          </svg>
          <div>
            <p className={clsx("text-5xl font-black leading-none", c.text)}>{fmtNum(data.stats.pct)}٪</p>
            <p className="mt-2 text-sm font-semibold muted">نسبة الالتزام بالجرعات</p>
          </div>
        </div>

        <p className="mt-4 text-lg font-extrabold">
          سلسلة الالتزام: {fmtNum(data.streak)} {data.streak === 1 ? "يوم" : "يوم"}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          <Badge color="green">تم الأخذ: {fmtNum(data.stats.taken)}</Badge>
          <Badge color="red">فاتت: {fmtNum(data.stats.missed)}</Badge>
          <Badge color="gray">تم التخطي: {fmtNum(data.stats.skipped)}</Badge>
          <Badge color="blue">إجمالي المحسوب: {fmtNum(data.stats.counted)}</Badge>
        </div>
        <p className="mt-3 text-xs muted">هذا الملخص لمساعدتك على المتابعة الهادئة — كل يوم جديد بداية.</p>
      </Card>

      {/* Daily series */}
      <Card>
        <h2 className="mb-3 font-bold">الالتزام يومياً</h2>
        {data.series.length === 0 ? (
          <EmptyState title="لا توجد جرعات في هذه الفترة" hint="ستظهر الأيام هنا بعد تسجيل الجرعات" />
        ) : (
          <div className="space-y-2.5">
            {[...data.series].reverse().map((s) => {
              const sc = pctColor(s.pct);
              return (
                <div key={s.day} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-xs font-semibold muted">{arDate(s.day)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className={clsx("h-full rounded-full", sc.bar)} style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className={clsx("w-12 shrink-0 text-xs font-bold", sc.text)}>{fmtNum(s.pct)}٪</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Cost */}
      <Card className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">تكلفة الأدوية</h2>
          <p className="text-xs muted">قيمة العبوات المشتراة المسجلة</p>
        </div>
        <p className="text-2xl font-extrabold">
          {fmtNum(data.totalPurchaseValue)} <span className="text-sm font-semibold muted">{data.currency}</span>
        </p>
      </Card>

      {/* Export */}
      <div className="grid grid-cols-2 gap-2 print:hidden">
        <Button variant="outline" onClick={exportCsv}>
          تصدير CSV
        </Button>
        <Button variant="outline" disabled={busy} onClick={exportJson}>
          تصدير JSON
        </Button>
      </div>
    </div>
  );
}
