import { isValidISODate, weekStartOf } from "@/lib/time";

/**
 * "Copy week / Paste week" clipboard: which creator+week was copied, stored in
 * a cookie so it survives navigation between weeks. Assignments are re-read
 * from the DB at paste time, so the cookie only needs the two keys.
 */

export const WEEK_CLIPBOARD_COOKIE = "hv_week_clipboard";

/** Keep a copied week around for a day; after that it's stale anyway. */
export const WEEK_CLIPBOARD_MAX_AGE = 60 * 60 * 24;

export interface WeekClipboard {
  creatorId: string;
  weekStart: string;
}

export function serializeWeekClipboard(clip: WeekClipboard): string {
  return JSON.stringify(clip);
}

export function parseWeekClipboard(raw: string | undefined): WeekClipboard | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { creatorId, weekStart } = parsed as Record<string, unknown>;
  if (typeof creatorId !== "string" || creatorId === "") return null;
  if (typeof weekStart !== "string" || !isValidISODate(weekStart)) return null;
  if (weekStartOf(weekStart) !== weekStart) return null;
  return { creatorId, weekStart };
}
