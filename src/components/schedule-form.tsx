"use client";

import { Button, Field, Input, Select, fmtNum } from "@/components/ui";
import { FORM_AR } from "@/components/ui";

export const WEEKDAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export interface ScheduleForm {
  kind: string;
  times: string[];
  quantityPerDose: number;
  intervalN: number | null;
  weekdays: number[];
  taperSteps: { from: string; to: string; quantityPerDose: number }[];
  prnMax?: number | null;
}

export function todayLocal(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function schedulePreviewAr(s: ScheduleForm): string {
  if (s.kind === "prn") {
    return `عند الحاجة${s.prnMax ? ` بحد أقصى ${s.prnMax} مرات يومياً` : ""}`;
  }
  const q = `${fmtNum(s.quantityPerDose)} ${FORM_AR["tablet"]}`;
  const times = s.times.length ? ` الساعة ${s.times.join(" و ")}` : "";
  switch (s.kind) {
    case "daily":
      return `${q} يومياً${times}`;
    case "everyNDays":
      return `${q} كل ${s.intervalN ?? 1} يوم${times}`;
    case "weekdays": {
      const days = s.weekdays.slice().sort().map((w) => WEEKDAY_AR[w]).join(" و");
      return `${q} في: ${days || "—"}${times}`;
    }
    case "taper": {
      const steps = s.taperSteps
        .map((st) => `من ${st.from} إلى ${st.to}: ${fmtNum(st.quantityPerDose)}`)
        .join("، ثم ");
      return `تخفيض تدريجي — ${steps || "أضف مراحل التخفيض"}`;
    }
    default:
      return "";
  }
}

export const defaultSchedule: ScheduleForm = {
  kind: "daily",
  times: ["08:00"],
  quantityPerDose: 1,
  intervalN: null,
  weekdays: [],
  taperSteps: [],
};

export function ScheduleFields({
  schedule,
  onChange,
}: {
  schedule: ScheduleForm;
  onChange: (s: ScheduleForm) => void;
}) {
  const set = (patch: Partial<ScheduleForm>) => onChange({ ...schedule, ...patch });
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-600">
      <Field label="نوع الجدول">
        <Select value={schedule.kind} onChange={(e) => set({ kind: e.target.value })}>
          <option value="daily">يومي</option>
          <option value="everyNDays">كل N يوم</option>
          <option value="weekdays">أيام محددة</option>
          <option value="prn">عند الحاجة</option>
          <option value="taper">تخفيض تدريجي</option>
        </Select>
      </Field>

      {schedule.kind !== "prn" && (
        <div className="space-y-2">
          <span className="text-sm font-semibold">مواعيد الجرعة</span>
          {schedule.times.map((t, i) => (
            <div key={i} className="flex gap-2">
              <Input
                type="time"
                value={t}
                onChange={(e) => {
                  const times = [...schedule.times];
                  times[i] = e.target.value;
                  set({ times });
                }}
              />
              <Button variant="outline" onClick={() => set({ times: schedule.times.filter((_, j) => j !== i) })}>
                حذف
              </Button>
            </div>
          ))}
          <Button variant="ghost" onClick={() => set({ times: [...schedule.times, "08:00"] })}>
            + إضافة موعد
          </Button>
        </div>
      )}

      <Field label="الكمية في الجرعة">
        <Input
          type="number"
          step="0.5"
          min="0.5"
          value={schedule.quantityPerDose}
          onChange={(e) => set({ quantityPerDose: Number(e.target.value) || 1 })}
        />
      </Field>

      {schedule.kind === "everyNDays" && (
        <Field label="عدد الأيام بين الجرعات">
          <Input
            type="number"
            min="1"
            value={schedule.intervalN ?? 1}
            onChange={(e) => set({ intervalN: Number(e.target.value) || 1 })}
          />
        </Field>
      )}

      {schedule.kind === "weekdays" && (
        <div>
          <span className="text-sm font-semibold">أيام الأسبوع</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {WEEKDAY_AR.map((day, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  set({
                    weekdays: schedule.weekdays.includes(idx)
                      ? schedule.weekdays.filter((w) => w !== idx)
                      : [...schedule.weekdays, idx],
                  })
                }
                className={`min-h-touch rounded-lg px-3 text-sm font-semibold ${
                  schedule.weekdays.includes(idx)
                    ? "bg-brand-600 text-white"
                    : "border border-slate-300 dark:border-slate-600"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {schedule.kind === "taper" && (
        <div className="space-y-2">
          <span className="text-sm font-semibold">مراحل التخفيض</span>
          {schedule.taperSteps.map((st, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Input
                type="date"
                value={st.from}
                onChange={(e) => {
                  const steps = [...schedule.taperSteps];
                  steps[i] = { ...st, from: e.target.value };
                  set({ taperSteps: steps });
                }}
                className="!w-auto"
              />
              <Input
                type="date"
                value={st.to}
                onChange={(e) => {
                  const steps = [...schedule.taperSteps];
                  steps[i] = { ...st, to: e.target.value };
                  set({ taperSteps: steps });
                }}
                className="!w-auto"
              />
              <Input
                type="number"
                step="0.5"
                value={st.quantityPerDose}
                onChange={(e) => {
                  const steps = [...schedule.taperSteps];
                  steps[i] = { ...st, quantityPerDose: Number(e.target.value) || 1 };
                  set({ taperSteps: steps });
                }}
                className="!w-24"
              />
              <Button variant="outline" onClick={() => set({ taperSteps: schedule.taperSteps.filter((_, j) => j !== i) })}>
                حذف
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() =>
              set({
                taperSteps: [
                  ...schedule.taperSteps,
                  { from: todayLocal(0), to: todayLocal(30), quantityPerDose: 1 },
                ],
              })
            }
          >
            + إضافة مرحلة
          </Button>
        </div>
      )}

      <p className="rounded-lg bg-brand-50 p-2 text-sm font-semibold text-brand-800 dark:bg-slate-700 dark:text-brand-200">
        {schedulePreviewAr(schedule)}
      </p>
    </div>
  );
}
