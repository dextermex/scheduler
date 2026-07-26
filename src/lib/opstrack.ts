/**
 * OpsTrack app-to-app client. OpsTrack owns the mapping "which OnlyFansAPI
 * accounts (pages) belong to which scheduler creator" — assigned on its
 * Tasks → Live status list. We read that map (token-gated by the shared
 * SCHEDULER_SYNC_TOKEN) to show each creator's profile picture (served through
 * OpsTrack's public avatar proxy) and which @handles are linked. Everything
 * degrades gracefully — a missing token, an unreachable OpsTrack or an empty
 * map never breaks a page; instead the error is surfaced so the UI can SAY
 * why nothing is linked.
 */

export type LinkedAccount = { id: string; username: string | null; name: string | null };
export type CreatorMap = Record<string, LinkedAccount[]>; // scheduler creator id -> pages

export function opstrackBase(): string {
  return (process.env.OPSTRACK_URL || "https://opstrack.auramngt.com").replace(/\/+$/, "");
}

/** Pure: fold OpsTrack's /api/reminders/creator-map payload into a CreatorMap.
 *  Accepts both account shapes (plain id strings from the first rollout, or
 *  {id, username, name} objects) so mixed deploy versions can't break pages. */
export function normalizeCreatorMap(data: unknown): CreatorMap {
  const map: CreatorMap = {};
  const creators = (data as { creators?: unknown })?.creators;
  if (!Array.isArray(creators)) return map;
  for (const c of creators) {
    const id = (c as { id?: unknown })?.id;
    const accounts = (c as { accounts?: unknown })?.accounts;
    if (typeof id !== "string" || !id || !Array.isArray(accounts)) continue;
    map[id] = accounts
      .map((a): LinkedAccount | null => {
        if (typeof a === "string") return a ? { id: a, username: null, name: null } : null;
        const aid = (a as { id?: unknown })?.id;
        if (typeof aid !== "string" || !aid) return null;
        const u = (a as { username?: unknown }).username;
        const n = (a as { name?: unknown }).name;
        return {
          id: aid,
          username: typeof u === "string" && u ? u : null,
          name: typeof n === "string" && n ? n : null,
        };
      })
      .filter((a): a is LinkedAccount => a !== null);
  }
  return map;
}

const cache: { at: number; fetched: boolean; map: CreatorMap; error: string | null } = {
  at: 0,
  fetched: false,
  map: {},
  error: null,
};

export async function creatorAccountsMap(): Promise<{ map: CreatorMap; error: string | null }> {
  const token = process.env.SCHEDULER_SYNC_TOKEN;
  if (!token) return { map: {}, error: "SCHEDULER_SYNC_TOKEN is not set on this app" };
  if (cache.fetched && Date.now() - cache.at < 60_000) return { map: cache.map, error: cache.error };
  try {
    const r = await fetch(`${opstrackBase()}/api/reminders/creator-map`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`OpsTrack responded ${r.status}${r.status === 401 ? " (token mismatch?)" : ""}`);
    cache.map = normalizeCreatorMap(await r.json());
    cache.error = null;
  } catch (e) {
    // Keep the last good map (stale beats empty) but report the failure.
    cache.error = e instanceof Error ? e.message : String(e);
  }
  cache.at = Date.now();
  cache.fetched = true;
  return { map: cache.map, error: cache.error };
}

/** Avatar image candidates for a creator, via OpsTrack's public avatar proxy. */
export function avatarSources(map: CreatorMap, creatorId: string): string[] {
  return (map[creatorId] ?? []).map((a) => `${opstrackBase()}/api/reminders/avatar/${a.id}`);
}

/** Human label for a creator's linked pages: "@vip + @free", else "2 pages", else "". */
export function linkedLabel(map: CreatorMap, creatorId: string): string {
  const accounts = map[creatorId] ?? [];
  if (accounts.length === 0) return "";
  const handles = accounts.map((a) => (a.username ? `@${a.username}` : null));
  if (handles.every((h) => h !== null)) return handles.join(" + ");
  return `${accounts.length} page${accounts.length === 1 ? "" : "s"}`;
}
