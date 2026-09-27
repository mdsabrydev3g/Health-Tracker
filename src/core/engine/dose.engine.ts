import { localToUtc, localDayOf, localDaysBetween, localWeekday, cmpLocalDay } from "../time/clock";

/**
 * Dose engine — PURE, DETERMINISTIC.
 * Given schedules + timezone + range → exact dose instances with scheduledAtUtc + localDay.
 * No imports from React, DB, or frameworks. Plain data in, plain data out.
 */

export type ScheduleKind = "daily" | "everyNDays" | "weekdays" | "prn" | "taper";

export interface ScheduleInput {
  id: string;
  medicationId: string;
  personId: string;
  kind: ScheduleKind;
  /** "HH:mm" local times */
  times: string[];
  quantityPerDose: string;
  anchorDate: string; // "YYYY-MM-DD"
  endDate?: string | null;
  weekdays: number[]; // 0=Sunday..6
  intervalN?: number | null;
  prnMaxPerDay?: number | null;
  taperSteps: { from: string; to: string; quantityPerDose: string }[];
  activeFrom: Date;
  activeTo?: Date | null;
  /** medication bounds */
  medStartDate?: string | null;
  medEndDate?: string | null;
}

export interface DoseInstance {
  personId: string;
  medicationId: string;
  scheduleId: string;
  scheduledAtUtc: Date;
  localDay: string;
  quantity: string;
  idempotencyKey: string;
}

function num(v: string | number | null | undefined): number {
  const n = typeof v === "number" ? v : parseFloat(v ?? "1");
  return Number.isFinite(n) ? n : 1;
}

function effectiveWindow(
  s: ScheduleInput,
  rangeFrom: Date,
  rangeTo: Date,
): { days: string[] } | null {
  let fromMs = Math.max(rangeFrom.getTime(), s.activeFrom.getTime());
  let toMs = Math.min(rangeTo.getTime(), s.activeTo ? s.activeTo.getTime() : Infinity);
  if (s.medStartDate) {
    const sd = localToUtc(s.medStartDate, "00:00", "UTC").getTime();
    fromMs = Math.max(fromMs, sd);
  }
  if (s.medEndDate) {
    const ed = localToUtc(s.medEndDate, "23:59", "UTC").getTime();
    toMs = Math.min(toMs, ed);
  }
  if (s.endDate) {
    const ed = localToUtc(s.endDate, "23:59", "UTC").getTime();
    toMs = Math.min(toMs, ed);
  }
  if (fromMs > toMs) return null;
  // Local calendar-day window (day boundaries computed in UTC-date space is safe here
  // because fromZonedTime handles each concrete timestamp's DST offset).
  const fromDay = new Date(fromMs).toISOString().slice(0, 10);
  const toDay = new Date(toMs).toISOString().slice(0, 10);
  return { days: localDaysBetween(fromDay, toDay) };
}

function quantityForDay(s: ScheduleInput, localDay: string): string {
  if (s.kind !== "taper" || s.taperSteps.length === 0) return s.quantityPerDose;
  const step = s.taperSteps.find((st) => localDay >= st.from && localDay <= st.to);
  return step ? step.quantityPerDose : s.quantityPerDose;
}

function dayMatches(s: ScheduleInput, localDay: string): boolean {
  switch (s.kind) {
    case "daily":
    case "prn":
      return true;
    case "everyNDays": {
      const n = Math.max(1, s.intervalN ?? 1);
      const diff = dayDiff(s.anchorDate, localDay);
      return diff >= 0 && diff % n === 0;
    }
    case "weekdays":
      return s.weekdays.includes(localWeekday(localDay));
    case "taper":
      return s.times.length > 0;
    default:
      return false;
  }
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000,
  );
}

/**
 * Materialise dose instances for all schedules in [rangeFrom, rangeTo].
 * PRN schedules are intentionally NOT materialised — they are log-only
 * and are never "missed".
 */
export function materialiseDoses(
  schedules: ScheduleInput[],
  tz: string,
  rangeFrom: Date,
  rangeTo: Date,
): DoseInstance[] {
  const doses: DoseInstance[] = [];
  for (const s of schedules) {
    if (s.kind === "prn") continue;
    const win = effectiveWindow(s, rangeFrom, rangeTo);
    if (!win) continue;
    for (const day of win.days) {
      if (!dayMatches(s, day)) continue;
      const qty = quantityForDay(s, day);
      for (const time of s.times) {
        const scheduledAtUtc = localToUtc(day, time, tz);
        if (scheduledAtUtc.getTime() < Math.max(rangeFrom.getTime(), s.activeFrom.getTime()))
          continue;
        if (s.activeTo && scheduledAtUtc.getTime() > s.activeTo.getTime()) continue;
        doses.push({
          personId: s.personId,
          medicationId: s.medicationId,
          scheduleId: s.id,
          scheduledAtUtc,
          localDay: localDayOf(scheduledAtUtc, tz),
          quantity: qty,
          idempotencyKey: `${s.personId}:${s.medicationId}:${scheduledAtUtc.toISOString()}`,
        });
      }
    }
  }
  doses.sort((a, b) => a.scheduledAtUtc.getTime() - b.scheduledAtUtc.getTime());
  return doses;
}

export type DoseStatus = "upcoming" | "due" | "taken" | "missed" | "skipped" | "snoozed" | "cancelled";

/** Status of a materialised dose at `now`. Grace window in ms (default 2h). */
export function doseStatusAt(
  scheduledAtUtc: Date,
  now: Date,
  opts: { acted?: DoseStatus | null; graceMinutes?: number; snoozedUntil?: Date | null } = {},
): DoseStatus {
  if (opts.acted) return opts.acted;
  if (opts.snoozedUntil && opts.snoozedUntil.getTime() > now.getTime()) return "snoozed";
  const grace = (opts.graceMinutes ?? 120) * 60_000;
  if (scheduledAtUtc.getTime() <= now.getTime()) {
    return scheduledAtUtc.getTime() + grace > now.getTime() ? "due" : "missed";
  }
  return "upcoming";
}

/** The next not-yet-passed dose instance from a materialised list. */
export function nextDose(doses: DoseInstance[], now: Date): DoseInstance | null {
  return doses.find((d) => d.scheduledAtUtc.getTime() >= now.getTime() - 2 * 3600_000) ?? null;
}
