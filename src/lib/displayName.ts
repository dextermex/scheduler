/**
 * What a chatter is called ON POSTERS: the explicit `posterName` field.
 *
 * When it's blank (e.g. a freshly added chatter where the field was left
 * empty), fall back to the naming rule the field was seeded from:
 *  - LX people → their chatting name (alias), e.g. Jelena Kovacevic → "Helena"
 *  - everyone else → the first word of their real name, e.g. a full name like "Alex Smith" →
 *    "Alex" (never the surname)
 *  - no real name on file → the chatting name (Alex, Milz, …)
 *
 * The schedule editor, roster page, and "ON SHIFT" pings keep using the
 * Infloww/chatting `name`.
 */
export function posterName(c: {
  name: string;
  fullName: string;
  isLX: boolean;
  posterName: string;
}): string {
  const explicit = c.posterName.trim();
  if (explicit) return explicit;
  if (c.isLX) return c.name;
  const first = c.fullName.trim().split(/\s+/)[0];
  return first || c.name;
}
