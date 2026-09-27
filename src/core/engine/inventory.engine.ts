/**
 * Inventory engine — PURE.
 * Balance is always derived from the append-only event ledger, never stored as a bare number.
 */

export interface InventoryEventLike {
  qty: string;
  type: string;
  atUtc: Date;
}

export interface ConsumptionScheduleLike {
  kind: string;
  times: string[];
  quantityPerDose: string;
  intervalN?: number | null;
  weekdays: number[];
  taperSteps: { from: string; to: string; quantityPerDose: string }[];
  activeFrom: Date;
  activeTo?: Date | null;
}

function n(v: string | number | null | undefined): number {
  const x = typeof v === "number" ? v : parseFloat(v ?? "0");
  return Number.isFinite(x) ? x : 0;
}

/** balance = Σ event.qty */
export function balanceFromEvents(events: InventoryEventLike[]): number {
  return events.reduce((acc, e) => acc + n(e.qty), 0);
}

/** Occurrences per local day for a schedule (fractional for everyNDays/weekdays). */
export function occurrencesPerDay(s: ConsumptionScheduleLike, localDay: string): number {
  switch (s.kind) {
    case "daily":
      return s.times.length;
    case "everyNDays":
      return s.times.length / Math.max(1, s.intervalN ?? 1);
    case "weekdays":
      return s.weekdays.length > 0 ? (s.times.length * s.weekdays.length) / 7 : 0;
    case "taper": {
      const step = s.taperSteps.find((st) => localDay >= st.from && localDay <= st.to);
      return step ? s.times.length : 0;
    }
    default:
      return 0;
  }
}

/** Expected daily consumption across all active schedules for a given local day. */
export function dailyConsumption(
  schedules: ConsumptionScheduleLike[],
  localDay: string,
  now: Date = new Date(),
): number {
  return schedules
    .filter((s) => s.kind !== "prn")
    .filter((s) => s.activeFrom.getTime() <= now.getTime() && (!s.activeTo || s.activeTo >= now))
    .reduce((acc, s) => acc + occurrencesPerDay(s, localDay) * n(s.quantityPerDose), 0);
}

export function remainingDays(balance: number, consumptionPerDay: number): number {
  if (consumptionPerDay <= 0) return Infinity;
  return balance / consumptionPerDay;
}

export function depletionDate(
  todayLocal: string,
  balance: number,
  consumptionPerDay: number,
): string | null {
  if (consumptionPerDay <= 0 || balance <= 0) return null;
  const days = Math.ceil(balance / consumptionPerDay);
  const [y, m, d] = todayLocal.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export type InventoryWarningKind =
  | "low_stock"
  | "expiry_before_depletion"
  | "expired"
  | "out_of_stock";

export interface InventoryWarning {
  kind: InventoryWarningKind;
  messageAr: string;
}

export function inventoryWarnings(input: {
  balance: number;
  consumptionPerDay: number;
  todayLocal: string;
  packExpiry?: string | null;
  lowStockThresholdDays?: number;
}): InventoryWarning[] {
  const warnings: InventoryWarning[] = [];
  const threshold = input.lowStockThresholdDays ?? 2;
  const days = remainingDays(input.balance, input.consumptionPerDay);
  const dep = depletionDate(input.todayLocal, input.balance, input.consumptionPerDay);

  if (input.balance <= 0) {
    warnings.push({ kind: "out_of_stock", messageAr: "الرصيد نفد تماماً — يلزم الشراء فوراً" });
  } else if (days <= threshold) {
    warnings.push({
      kind: "low_stock",
      messageAr: `الرصيد منخفض — يكفي حوالي ${Math.max(1, Math.floor(days))} يوم`,
    });
  }
  if (input.packExpiry && input.packExpiry <= input.todayLocal) {
    warnings.push({ kind: "expired", messageAr: "العلبة انتهت صلاحيتها" });
  } else if (input.packExpiry && dep && input.packExpiry < dep) {
    warnings.push({
      kind: "expiry_before_depletion",
      messageAr: "العلبة ستنتهي صلاحيتها قبل أن ينتهي الدواء — استخدمي علبة أحدث أو راجعي الصيدلية",
    });
  }
  return warnings;
}
