import { fromZonedTime, formatInTimeZone, toZonedTime } from "date-fns-tz";

/**
 * DST-safe time helpers. All scheduling math treats local wall-clock time
 * (e.g. "08:00" in Africa/Cairo) as the source of truth and stores UTC.
 * Never hardcode a fixed offset — Cairo reintroduced DST in 2023.
 */

/** "2026-09-27" + "08:00" + tz → absolute UTC Date */
export function localToUtc(localDate: string, localTime: string, tz: string): Date {
  return fromZonedTime(`${localDate}T${localTime}:00`, tz);
}

/** Absolute UTC instant → "YYYY-MM-DD" in the given timezone */
export function localDayOf(utc: Date, tz: string): string {
  return formatInTimeZone(utc, tz, "yyyy-MM-dd");
}

/** Absolute UTC instant → local "HH:mm" in the given timezone */
export function localTimeOf(utc: Date, tz: string): string {
  return formatInTimeZone(utc, tz, "HH:mm");
}

/** Format an instant in a timezone with an arbitrary pattern */
export function formatInZone(utc: Date, tz: string, pattern: string): string {
  return formatInTimeZone(utc, tz, pattern);
}

/** Today's local date string ("YYYY-MM-DD") in the given timezone */
export function todayLocalDay(tz: string, now: Date = new Date()): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

/** Convert an absolute instant to wall-clock parts in the given timezone */
export function zonedParts(
  utc: Date,
  tz: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const d = toZonedTime(utc, tz);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

/** "YYYY-MM-DD" → UTC instant of that local day at 00:00 */
export function startOfLocalDay(localDate: string, tz: string): Date {
  return localToUtc(localDate, "00:00", tz);
}

/** Add n days to a local date string, DST-safe (calendar-day arithmetic on strings) */
export function addLocalDays(localDate: string, n: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + n);
  return base.toISOString().slice(0, 10);
}

/** Weekday index (0=Sunday..6) of a local date string */
export function localWeekday(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Enumerate local date strings from..to inclusive */
export function localDaysBetween(fromLocal: string, toLocal: string): string[] {
  const out: string[] = [];
  let cur = fromLocal;
  let guard = 0;
  while (cur <= toLocal && guard < 4000) {
    out.push(cur);
    cur = addLocalDays(cur, 1);
    guard++;
  }
  return out;
}

/** Compare "YYYY-MM-DD" strings */
export function cmpLocalDay(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
