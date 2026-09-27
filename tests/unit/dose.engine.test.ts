import { describe, it, expect } from "vitest";
import { materialiseDoses, doseStatusAt, type ScheduleInput } from "@/core/engine/dose.engine";
import { localToUtc, localDayOf } from "@/core/time/clock";

const CAIRO = "Africa/Cairo";

function base(over: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    id: "s1",
    medicationId: "m1",
    personId: "p1",
    kind: "daily",
    times: ["08:00"],
    quantityPerDose: "1",
    anchorDate: "2026-09-01",
    weekdays: [],
    taperSteps: [],
    activeFrom: new Date("2026-08-01T00:00:00Z"),
    activeTo: null,
    ...over,
  };
}

describe("dose engine — daily", () => {
  it("materialises one dose per time per day", () => {
    const doses = materialiseDoses(
      [base({ times: ["08:00", "20:00"] })],
      CAIRO,
      new Date("2026-09-27T00:00:00Z"),
      new Date("2026-09-28T23:59:00Z"),
    );
    expect(doses.length).toBe(4);
  });

  it("converts local Cairo time to correct UTC (UTC+3 in Sep 2026, DST period)", () => {
    const doses = materialiseDoses(
      [base({ times: ["08:00"] })],
      CAIRO,
      new Date("2026-09-27T00:00:00Z"),
      new Date("2026-09-27T23:59:00Z"),
    );
    // Cairo is UTC+3 during summer time 2026 → 08:00 local = 05:00 UTC
    expect(doses[0].scheduledAtUtc.toISOString()).toBe("2026-09-27T05:00:00.000Z");
    expect(doses[0].localDay).toBe("2026-09-27");
  });

  it("keeps 08:00 local on both sides of a DST change (Cairo DST ends late Oct)", () => {
    const doses = materialiseDoses(
      [base({ times: ["08:00"] })],
      CAIRO,
      new Date("2026-10-29T00:00:00Z"),
      new Date("2026-10-31T23:59:00Z"),
    );
    const offsets = doses.map((d) => d.scheduledAtUtc.getTime() - localToUtc(d.localDay, "00:00", "UTC").getTime());
    // 08:00 local = 05:00 UTC at UTC+3 (DST), = 06:00 UTC at UTC+2
    expect(offsets[0]).toBe(5 * 3600000);
    expect(offsets[offsets.length - 1]).toBe(6 * 3600000);
  });
});

describe("dose engine — everyNDays / weekdays / prn / taper", () => {
  it("everyNDays fires only on anchor + k*N days", () => {
    const doses = materialiseDoses(
      [base({ kind: "everyNDays", intervalN: 3, anchorDate: "2026-09-01" })],
      CAIRO,
      new Date("2026-09-07T00:00:00Z"),
      new Date("2026-09-13T23:59:00Z"),
    );
    // Sept 7 = anchor+6 → 6%3=0 ✓ ; Sept 10 = +9 ✓ ; others no
    expect(doses.map((d) => d.localDay)).toEqual(["2026-09-07", "2026-09-10", "2026-09-13"]);
  });

  it("weekdays fires only on listed weekdays (0=Sunday)", () => {
    const doses = materialiseDoses(
      [base({ kind: "weekdays", weekdays: [0, 6] })],
      CAIRO,
      new Date("2026-09-20T00:00:00Z"),
      new Date("2026-09-26T23:59:00Z"),
    );
    for (const d of doses) {
      const wd = new Date(d.localDay + "T00:00:00Z").getUTCDay();
      expect([0, 6]).toContain(wd);
    }
    expect(doses.length).toBe(2);
  });

  it("PRN schedules are never materialised", () => {
    const doses = materialiseDoses([base({ kind: "prn", times: [] })], CAIRO, new Date(), new Date());
    expect(doses).toHaveLength(0);
  });

  it("taper uses the step quantity covering the day", () => {
    const doses = materialiseDoses(
      [
        base({
          kind: "taper",
          times: ["09:00"],
          taperSteps: [
            { from: "2026-09-01", to: "2026-09-15", quantityPerDose: "2" },
            { from: "2026-09-16", to: "2026-09-30", quantityPerDose: "1" },
          ],
        }),
      ],
      CAIRO,
      new Date("2026-09-14T00:00:00Z"),
      new Date("2026-09-17T23:59:00Z"),
    );
    expect(doses.find((d) => d.localDay === "2026-09-14")!.quantity).toBe("2");
    expect(doses.find((d) => d.localDay === "2026-09-17")!.quantity).toBe("1");
  });

  it("respects schedule supersession (activeTo closes the old schedule)", () => {
    const old = base({
      id: "old",
      activeFrom: new Date("2026-08-01T00:00:00Z"),
      activeTo: new Date("2026-09-20T12:00:00Z"),
    });
    const doses = materialiseDoses(
      [old],
      CAIRO,
      new Date("2026-09-19T00:00:00Z"),
      new Date("2026-09-23T23:59:00Z"),
    );
    expect(doses.every((d) => d.scheduledAtUtc.getTime() <= old.activeTo!.getTime())).toBe(true);
  });

  it("idempotency key is stable per (person, med, instant)", () => {
    const doses = materialiseDoses(
      [base()],
      CAIRO,
      new Date("2026-09-27T00:00:00Z"),
      new Date("2026-09-27T23:59:00Z"),
    );
    expect(doses[0].idempotencyKey).toBe(`p1:m1:${doses[0].scheduledAtUtc.toISOString()}`);
  });
});

describe("dose status", () => {
  const now = new Date("2026-09-27T10:00:00Z");
  it("upcoming before scheduled time", () => {
    expect(doseStatusAt(new Date("2026-09-27T11:00:00Z"), now)).toBe("upcoming");
  });
  it("due within grace window", () => {
    expect(doseStatusAt(new Date("2026-09-27T09:30:00Z"), now)).toBe("due");
  });
  it("missed after grace (2h)", () => {
    expect(doseStatusAt(new Date("2026-09-27T07:00:00Z"), now)).toBe("missed");
  });
  it("snoozed until snooze expires", () => {
    expect(
      doseStatusAt(new Date("2026-09-27T09:00:00Z"), now, { snoozedUntil: new Date("2026-09-27T10:30:00Z") }),
    ).toBe("snoozed");
  });
  it("acted status wins", () => {
    expect(doseStatusAt(new Date("2026-09-27T07:00:00Z"), now, { acted: "taken" })).toBe("taken");
  });
});
