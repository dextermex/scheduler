/**
 * Starter roster for AURA Scheduler. These chatters are ensured on every boot
 * (idempotent upsert by name); creators and the weekly schedule are left empty
 * so the team builds them in the app.
 *
 * `name` is the canonical chatter/schedule name. `aliases` are alternate
 * spellings so an imported sheet maps onto the right person.
 */

export interface SeedChatter {
  fullName: string;
  name: string;
  color: string;
  aliases?: string[];
  /** Posters show the chatting alias instead of the real first name. */
  lx?: boolean;
}

export const SEED_CHATTERS: SeedChatter[] = [
  { fullName: "", name: "Mate", color: "#74c0fc" },
  { fullName: "", name: "Domonkos", color: "#9fe870" },
  { fullName: "", name: "Felipe", color: "#ffd56b" },
  { fullName: "", name: "Esteban", color: "#ff9de2" },
  { fullName: "", name: "Luka", color: "#b197fc" },
];

/** No placeholder creators — added in the app. */
export const SEED_CREATORS: string[] = [];

/** Week the placeholder schedule covers (a Monday, ISO date). */
export const SEED_WEEK_START = "2026-07-13";

/** No placeholder schedule — built in the app. */
export const SEED_SCHEDULE: Record<
  string,
  { MORNING: string[]; AFTERNOON: string[]; NIGHT: string[] }
> = {};

/** Parse a sheet cell like "Mate + Luka" into individual names. */
export function parseCell(cell: string): string[] {
  return cell
    .split("+")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toUpperCase() !== "TBD");
}
