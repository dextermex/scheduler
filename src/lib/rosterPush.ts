import { prisma } from "./prisma";
import { opstrackBase } from "./opstrack";
import { getBoolSetting, SETTING_KEYS } from "./settings";
import {
  addDaysISO,
  berlinNow,
  dayIndexOf,
  shiftContainingHour,
  weekStartOf,
} from "./time";

/** Who is on shift RIGHT NOW, per creator id: [{name, discordUsername}]. Uses the
 * shift containing the current Berlin hour (night rolls back to the previous
 * day's row) and the same latest-week fallback the "ON SHIFT" pings use. */
async function onShiftByCreator(): Promise<
  Record<string, { name: string; discordUsername: string; discordId: string; office: boolean }[]>
> {
  const t = berlinNow();
  const cur = shiftContainingHour(t.hour);
  const dateISO = cur.previousDay ? addDaysISO(t.date, -1) : t.date;
  const weekStart = weekStartOf(dateISO);
  const day = dayIndexOf(dateISO);

  const query = (week: string) =>
    prisma.assignment.findMany({
      where: { weekStart: week, day, shift: cur.shift, creator: { active: true } },
      include: { chatter: true },
    });

  let assignments = await query(weekStart);
  if (assignments.length === 0 && (await getBoolSetting(SETTING_KEYS.fallbackToLatestWeek))) {
    const latest = await prisma.assignment.findFirst({
      where: { weekStart: { lt: weekStart } },
      orderBy: { weekStart: "desc" },
      select: { weekStart: true },
    });
    if (latest) assignments = await query(latest.weekStart);
  }

  const map: Record<string, { name: string; discordUsername: string; discordId: string; office: boolean }[]> = {};
  for (const a of assignments) {
    (map[a.creatorId] ??= []).push({
      name: a.chatter.name,
      discordUsername: a.chatter.discordUsername,
      discordId: a.chatter.discordId,
      // LX = the in-office chatters (they are not in the creators' Discord
      // groups): OpsTrack routes their overdue alerts to the office group.
      office: a.chatter.isLX,
    });
  }
  return map;
}

/**
 * Roster push: this app SENDS its creator list to OpsTrack (POST
 * /api/reminders/scheduler-roster, shared SCHEDULER_SYNC_TOKEN) once a minute
 * from the boot worker. This direction exists because OpsTrack's own outbound
 * fetch to this app's domain hits a TLS certificate mismatch inside Railway
 * (ERR_TLS_CERT_ALTNAME_INVALID) — while scheduler→OpsTrack traffic is proven
 * good (it already carries the avatar/creator map). Pushing over the working
 * leg makes OpsTrack's GET /api/models pull a rarely-needed fallback.
 */
export async function pushRosterToOpstrack(): Promise<{ ok: boolean; count?: number; error?: string }> {
  const token = process.env.SCHEDULER_SYNC_TOKEN;
  if (!token) return { ok: false, error: "SCHEDULER_SYNC_TOKEN not set" };
  try {
    const [creators, onShift] = await Promise.all([
      prisma.creator.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, active: true, sortOrder: true },
      }),
      onShiftByCreator(),
    ]);
    // onShift rides along so OpsTrack can TAG the responsible chatter in the
    // creator's Discord group when a chat goes overdue.
    const models = creators.map((c) => ({ ...c, onShift: onShift[c.id] ?? [] }));
    const r = await fetch(`${opstrackBase()}/api/reminders/scheduler-roster`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ models }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`OpsTrack responded ${r.status}`);
    return { ok: true, count: models.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
