import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  berlinNow,
  dayIndexOf,
  formatDayDate,
  formatWeekRange,
  isoWeekNumber,
  isValidISODate,
  shiftContainingHour,
  shiftStartingAtHour,
  weekStartOf,
} from "./time";

describe("weekStartOf", () => {
  it("maps every day of the sheet week to Monday 2026-07-13", () => {
    for (let d = 0; d < 7; d++) {
      expect(weekStartOf(addDaysISO("2026-07-13", d))).toBe("2026-07-13");
    }
  });

  it("handles month boundaries", () => {
    expect(weekStartOf("2026-08-01")).toBe("2026-07-27");
    expect(weekStartOf("2026-01-01")).toBe("2025-12-29");
  });
});

describe("dayIndexOf", () => {
  it("is 0 for Monday and 6 for Sunday", () => {
    expect(dayIndexOf("2026-07-13")).toBe(0);
    expect(dayIndexOf("2026-07-19")).toBe(6);
  });
});

describe("shift boundaries", () => {
  it("matches the three ping hours", () => {
    expect(shiftStartingAtHour(0)).toBe("MORNING");
    expect(shiftStartingAtHour(8)).toBe("AFTERNOON");
    expect(shiftStartingAtHour(16)).toBe("NIGHT");
    expect(shiftStartingAtHour(4)).toBeNull();
    expect(shiftStartingAtHour(20)).toBeNull();
  });

  it("maps every hour to a same-day block — no shift crosses midnight", () => {
    expect(shiftContainingHour(0)).toEqual({ shift: "MORNING", previousDay: false });
    expect(shiftContainingHour(7)).toEqual({ shift: "MORNING", previousDay: false });
    expect(shiftContainingHour(8)).toEqual({ shift: "AFTERNOON", previousDay: false });
    expect(shiftContainingHour(15)).toEqual({ shift: "AFTERNOON", previousDay: false });
    expect(shiftContainingHour(16)).toEqual({ shift: "NIGHT", previousDay: false });
    expect(shiftContainingHour(23)).toEqual({ shift: "NIGHT", previousDay: false });
  });
});

describe("berlinNow", () => {
  it("converts UTC to Berlin summer time (CEST, UTC+2)", () => {
    // 02:00 UTC on 13 Jul 2026 = 04:00 in Berlin (DST, UTC+2).
    const t = berlinNow(new Date("2026-07-13T02:00:00Z"));
    expect(t).toEqual({ date: "2026-07-13", hour: 4, minute: 0 });
  });

  it("converts UTC to Berlin winter time (CET, UTC+1)", () => {
    const t = berlinNow(new Date("2026-01-13T03:00:00Z"));
    expect(t).toEqual({ date: "2026-01-13", hour: 4, minute: 0 });
  });

  it("rolls the date at Berlin midnight", () => {
    const t = berlinNow(new Date("2026-07-13T22:30:00Z"));
    expect(t.date).toBe("2026-07-14");
    expect(t.hour).toBe(0);
  });
});

describe("formatting", () => {
  it("renders the poster date range", () => {
    expect(formatWeekRange("2026-07-13")).toBe("July 13 — July 19, 2026");
  });

  it("renders day dates", () => {
    expect(formatDayDate("2026-07-13", 0)).toBe("13.07.2026");
    expect(formatDayDate("2026-07-13", 6)).toBe("19.07.2026");
  });

  it("computes the ISO week number", () => {
    expect(isoWeekNumber("2026-07-13")).toBe(29);
  });
});

describe("isValidISODate", () => {
  it("accepts real dates and rejects junk", () => {
    expect(isValidISODate("2026-07-13")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("not-a-date")).toBe(false);
  });
});
