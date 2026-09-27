import { describe, it, expect } from "vitest";
import {
  balanceFromEvents,
  dailyConsumption,
  remainingDays,
  depletionDate,
  inventoryWarnings,
  occurrencesPerDay,
} from "@/core/engine/inventory.engine";
import { adherenceStats, adherenceStreak } from "@/core/engine/adherence.engine";

describe("inventory engine", () => {
  const mk = (qty: number) => ({ qty: String(qty), type: "x", atUtc: new Date() });

  it("balance = Σ qty", () => {
    expect(balanceFromEvents([mk(30), mk(-1), mk(-1), mk(10)])).toBe(38);
  });

  it("daily consumption for daily schedule", () => {
    const s = {
      kind: "daily",
      times: ["08:00", "20:00"],
      quantityPerDose: "1.5",
      weekdays: [],
      taperSteps: [],
      activeFrom: new Date("2020-01-01"),
      activeTo: null,
    };
    expect(dailyConsumption([s], "2026-09-27")).toBe(3);
    expect(occurrencesPerDay(s, "2026-09-27")).toBe(2);
  });

  it("everyNDays spreads consumption (2×1 per 3 days ≈ 0.667/day)", () => {
    const s = {
      kind: "everyNDays",
      times: ["09:00", "21:00"],
      quantityPerDose: "1",
      intervalN: 3,
      weekdays: [],
      taperSteps: [],
      activeFrom: new Date("2020-01-01"),
      activeTo: null,
    };
    expect(dailyConsumption([s], "2026-09-27")).toBeCloseTo(2 / 3, 5);
  });

  it("weekdays consumption uses weekday fraction", () => {
    const s = {
      kind: "weekdays",
      times: ["09:00"],
      quantityPerDose: "1",
      weekdays: [0, 6],
      taperSteps: [],
      activeFrom: new Date("2020-01-01"),
      activeTo: null,
    };
    expect(dailyConsumption([s], "2026-09-27")).toBeCloseTo(2 / 7, 5);
  });

  it("remainingDays & depletionDate", () => {
    expect(remainingDays(10, 2)).toBe(5);
    expect(depletionDate("2026-09-27", 10, 2)).toBe("2026-10-02");
    expect(depletionDate("2026-12-30", 4, 2)).toBe("2027-01-01"); // year boundary
    expect(depletionDate("2026-02-27", 2, 2)).toBe("2026-02-28"); // month boundary (Feb = 28 days)
  });

  it("low stock warning at threshold", () => {
    const w = inventoryWarnings({ balance: 4, consumptionPerDay: 2, todayLocal: "2026-09-27" });
    expect(w.some((x) => x.kind === "low_stock")).toBe(true);
  });

  it("expiry-before-depletion is a distinct warning", () => {
    const w = inventoryWarnings({
      balance: 60,
      consumptionPerDay: 2, // 30 days left → depletion 2026-10-27
      todayLocal: "2026-09-27",
      packExpiry: "2026-10-15",
    });
    expect(w.some((x) => x.kind === "expiry_before_depletion")).toBe(true);
  });

  it("expired pack warning", () => {
    const w = inventoryWarnings({
      balance: 10,
      consumptionPerDay: 2,
      todayLocal: "2026-09-27",
      packExpiry: "2026-09-01",
    });
    expect(w.some((x) => x.kind === "expired")).toBe(true);
  });

  it("out of stock", () => {
    const w = inventoryWarnings({ balance: 0, consumptionPerDay: 2, todayLocal: "2026-09-27" });
    expect(w.some((x) => x.kind === "out_of_stock")).toBe(true);
  });
});

describe("adherence engine", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const past = (day: string) => new Date(day + "T09:00:00Z");

  it("counts only past doses; future excluded", () => {
    const doses = [
      { scheduledAtUtc: past("2026-09-25"), status: "taken", localDay: "2026-09-25" },
      { scheduledAtUtc: past("2026-09-26"), status: "missed", localDay: "2026-09-26" },
      { scheduledAtUtc: new Date("2026-09-28T09:00:00Z"), status: "upcoming", localDay: "2026-09-28" },
    ];
    const s = adherenceStats(doses, now);
    expect(s.counted).toBe(2);
    expect(s.pct).toBe(50);
  });

  it("skipped counts against adherence", () => {
    const doses = [
      { scheduledAtUtc: past("2026-09-25"), status: "taken", localDay: "2026-09-25" },
      { scheduledAtUtc: past("2026-09-26"), status: "skipped", localDay: "2026-09-26" },
    ];
    expect(adherenceStats(doses, now).pct).toBe(50);
  });

  it("streak counts consecutive days without misses ending today/yesterday", () => {
    const doses = [
      { scheduledAtUtc: past("2026-09-22"), status: "missed", localDay: "2026-09-22" },
      { scheduledAtUtc: past("2026-09-23"), status: "taken", localDay: "2026-09-23" },
      { scheduledAtUtc: past("2026-09-24"), status: "taken", localDay: "2026-09-24" },
      { scheduledAtUtc: past("2026-09-25"), status: "taken", localDay: "2026-09-25" },
      { scheduledAtUtc: past("2026-09-26"), status: "taken", localDay: "2026-09-26" },
      { scheduledAtUtc: past("2026-09-27"), status: "taken", localDay: "2026-09-27" },
    ];
    expect(adherenceStreak(doses, "2026-09-27")).toBe(5);
  });
});
