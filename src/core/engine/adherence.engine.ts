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
 * Streak: consecutive local days that had scheduled doses and zero misses,
 * ending today (or the most recent such day). Days with no doses break the
 * streak rather than counting toward it.
 */
export function adherenceStreak(doses: AdherenceDoseLike[], todayLocal: string): number {
  const byDay = new Map<string, { missed: number; total: number }>();
  for (const d of doses) {
    const cur = byDay.get(d.localDay) ?? { missed: 0, total: 0 };
    cur.total++;
    if (d.status === "missed") cur.missed++;
    byDay.set(d.localDay, cur);
  }
  let streak = 0;
  let cursor = todayLocal;
  let guard = 0;
  while (guard < 3650) {
    const day = byDay.get(cursor);
    if (!day || day.total === 0) {
      if (streak > 0 || cursor < todayLocal) break;
      // today has no doses yet — start counting from yesterday
    } else if (day.missed > 0) {
      break;
    } else {
      streak++;
    }
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
