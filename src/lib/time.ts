/**
 * All schedule times live in Europe/Berlin ("CEST" as the team calls it).
 * Shifts: Morning 04:00–12:00, Afternoon 12:00–20:00, Night 20:00–04:00.
 * Weeks start on Monday; `weekStart` keys are the Monday's ISO date (YYYY-MM-DD).
 */

export type ShiftKey = "MORNING" | "AFTERNOON" | "NIGHT";

export const SHIFT_ORDER: ShiftKey[] = ["MORNING", "AFTERNOON", "NIGHT"];

export const SHIFT_INFO: Record<
  ShiftKey,
  { label: string; start: string; end: string; short: string; startHour: number }
> = {
  MORNING: { label: "Morning", start: "04:00", end: "12:00", short: "04 — 12", startHour: 4 },
  AFTERNOON: { label: "Afternoon", start: "12:00", end: "20:00", short: "12 — 20", startHour: 12 },
  NIGHT: { label: "Night", start: "20:00", end: "04:00", short: "20 — 04", startHour: 20 },
};

/** Grid-only decoration — the Discord pings and posters keep plain labels. */
export const SHIFT_EMOJI: Record<ShiftKey, string> = {
  MORNING: "⛅",
  AFTERNOON: "☀️",
  NIGHT: "🌙",
};

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface BerlinTime {
  date: string; // YYYY-MM-DD
  hour: number;
  minute: number;
}

const berlinFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function berlinNow(d: Date = new Date()): BerlinTime {
  const parts: Record<string, string> = {};
  for (const p of berlinFmt.formatToParts(d)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** Shift that STARTS exactly at this hour, or null. */
export function shiftStartingAtHour(hour: number): ShiftKey | null {
  if (hour === 4) return "MORNING";
  if (hour === 12) return "AFTERNOON";
  if (hour === 20) return "NIGHT";
  return null;
}

/** Shift whose time block CONTAINS this hour. Hours 0–3 belong to the previous day's night shift. */
export function shiftContainingHour(hour: number): { shift: ShiftKey; previousDay: boolean } {
  if (hour >= 4 && hour < 12) return { shift: "MORNING", previousDay: false };
  if (hour >= 12 && hour < 20) return { shift: "AFTERNOON", previousDay: false };
  if (hour >= 20) return { shift: "NIGHT", previousDay: false };
  return { shift: "NIGHT", previousDay: true };
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing the given date. */
export function weekStartOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return addDaysISO(iso, -dow);
}

/** 0 = Monday … 6 = Sunday. */
export function dayIndexOf(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function isoWeekNumber(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  // ISO week: Thursday of the current week decides the year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

/** "July 13 — July 19, 2026" */
export function formatWeekRange(weekStart: string): string {
  const end = addDaysISO(weekStart, 6);
  const [y1, m1, d1] = weekStart.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const left = `${MONTH_NAMES[m1 - 1]} ${d1}`;
  const right = `${MONTH_NAMES[m2 - 1]} ${d2}`;
  if (y1 === y2) return `${left} — ${right}, ${y2}`;
  return `${left}, ${y1} — ${right}, ${y2}`;
}

/** "13.07.2026" */
export function formatDayDate(weekStart: string, day: number): string {
  const iso = addDaysISO(weekStart, day);
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** "Mon 13 Jul" */
export function formatDayShort(weekStart: string, day: number): string {
  const iso = addDaysISO(weekStart, day);
  const [, m, d] = iso.split("-").map(Number);
  return `${DAY_NAMES[day].slice(0, 3)} ${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
}
