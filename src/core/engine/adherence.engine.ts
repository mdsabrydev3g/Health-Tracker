/**
 * Adherence engine — PURE.
 * adherence% = taken / (taken + missed + skipped), counting only doses whose
 * scheduled time has passed. Future and PRN doses are excluded.
 */

export interface AdherenceDoseLike {
  scheduledAtUtc: Date;
  status: string; // taken|missed|skipped|upcoming|due|snoozed|cancelled
  localDay: string;
}

export interface AdherenceStats {
  taken: number;
  missed: number;
  skipped: number;
  counted: number;
  pct: number; // 0..100
}

export function adherenceStats(doses: AdherenceDoseLike[], now: Date): AdherenceStats {
  let taken = 0,
    missed = 0,
    skipped = 0;
  for (const d of doses) {
    if (d.scheduledAtUtc.getTime() > now.getTime()) continue; // future — excluded
    if (d.status === "taken") taken++;
    else if (d.status === "missed") missed++;
    else if (d.status === "skipped") skipped++;
  }
  const counted = taken + missed + skipped;
  return {
    taken,
    missed,
    skipped,
    counted,
    pct: counted === 0 ? 100 : Math.round((taken / counted) * 100),
  };
}

/**
 * Streak: consecutive local days ending today (or yesterday) with zero missed
 * scheduled doses. Neutral by design — never used for shaming.
 */
export function adherenceStreak(doses: AdherenceDoseLike[], todayLocal: string): number {
  const missedDays = new Set(doses.filter((d) => d.status === "missed").map((d) => d.localDay));
  let streak = 0;
  let cursor = todayLocal;
  // if today has no doses yet or none missed, start from today; otherwise yesterday
  const todayHasDoses = doses.some((d) => d.localDay === todayLocal);
  if (missedDays.has(todayLocal)) cursor = shiftDay(todayLocal, -1);
  else if (!todayHasDoses) cursor = shiftDay(todayLocal, -1);
  let guard = 0;
  while (!missedDays.has(cursor) && guard < 3650) {
    streak++;
    cursor = shiftDay(cursor, -1);
    guard++;
  }
  return streak;
}

function shiftDay(localDay: string, n: number): string {
  const [y, m, d] = localDay.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
