/**
 * Placeholder starter data for a fresh AURA Scheduler install.
 *
 * The original agency roster/schedule was NOT carried over (it was another
 * operator's real staff data). Replace these examples with AURA's own chatters,
 * creators, and shifts on the Chatters / Models / Schedule pages — or edit this
 * file and re-run `npm run db:seed`.
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
  { fullName: "", name: "Chatter A", color: "#FF6FA3" },
  { fullName: "", name: "Chatter B", color: "#74c0fc" },
  { fullName: "", name: "Chatter C", color: "#9fe870" },
  { fullName: "", name: "Chatter D", color: "#f4b14a" },
];

export const SEED_CREATORS = ["Creator One", "Creator Two"];

/** Week the placeholder schedule covers (a Monday, ISO date). */
export const SEED_WEEK_START = "2026-07-13";

/**
 * Placeholder weekly schedule (Mon…Sun) per creator. "A + B" = two chatters on
 * one slot. Empty string = nothing scheduled. Replace on the Schedule page.
 */
export const SEED_SCHEDULE: Record<
  string,
  { MORNING: string[]; AFTERNOON: string[]; NIGHT: string[] }
> = {
  "Creator One": {
    MORNING: ["Chatter A", "Chatter A", "Chatter A", "Chatter A", "Chatter A", "", ""],
    AFTERNOON: ["Chatter B", "Chatter B", "Chatter B", "Chatter B", "Chatter B", "Chatter B", "Chatter B"],
    NIGHT: ["Chatter C", "Chatter C", "Chatter C", "Chatter C", "Chatter C", "Chatter C", "Chatter C"],
  },
  "Creator Two": {
    MORNING: ["Chatter D", "Chatter D", "Chatter D", "Chatter D", "Chatter D", "", ""],
    AFTERNOON: ["Chatter A", "Chatter A", "Chatter A", "Chatter A", "Chatter A", "", ""],
    NIGHT: ["Chatter B", "Chatter B", "Chatter B", "Chatter B", "Chatter B", "", ""],
  },
};

/** Parse a sheet cell like "Chatter A + Chatter B" into individual names. */
export function parseCell(cell: string): string[] {
  return cell
    .split("+")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toUpperCase() !== "TBD");
}
