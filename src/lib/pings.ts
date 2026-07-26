import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { composeOnShiftMessage, sendDiscordMessage, type OnShiftEntry } from "./discord";
import { getBoolSetting, getWebhookUrl, SETTING_KEYS } from "./settings";
import {
  berlinNow,
  dayIndexOf,
  shiftStartingAtHour,
  weekStartOf,
  SHIFT_INFO,
  type ShiftKey,
} from "./time";

/**
 * Who is on shift for a given Berlin date + shift, grouped per CHATTER — one
 * entry per person listing every model they cover in that block (in board
 * order). If the week has no schedule yet and the fallback setting is on, the
 * most recent week that HAS a schedule is used (mirrors how the old sheet was
 * one rolling week that got reused until someone updated it).
 */
export async function getOnShiftEntries(
  dateISO: string,
  shift: ShiftKey,
): Promise<{ entries: OnShiftEntry[]; usedWeek: string }> {
  const weekStart = weekStartOf(dateISO);
  const day = dayIndexOf(dateISO);

  const query = (week: string) =>
    prisma.assignment.findMany({
      where: { weekStart: week, day, shift, creator: { active: true } },
      include: { creator: true, chatter: true },
      orderBy: [{ creator: { sortOrder: "asc" } }, { creator: { name: "asc" } }, { id: "asc" }],
    });

  let usedWeek = weekStart;
  let assignments = await query(weekStart);

  if (assignments.length === 0 && (await getBoolSetting(SETTING_KEYS.fallbackToLatestWeek))) {
    const latest = await prisma.assignment.findFirst({
      where: { weekStart: { lt: weekStart } },
      orderBy: { weekStart: "desc" },
      select: { weekStart: true },
    });
    if (latest) {
      usedWeek = latest.weekStart;
      assignments = await query(latest.weekStart);
    }
  }

  // Assignments arrive in model board order, so each chatter's entry keeps
  // that order and the Map keeps first-appearance order for the lines.
  const byChatter = new Map<string, OnShiftEntry>();
  for (const a of assignments) {
    let entry = byChatter.get(a.chatterId);
    if (!entry) {
      entry = {
        models: [],
        chatter: a.chatter.name,
        discordUsername: a.chatter.discordUsername,
        discordId: a.chatter.discordId,
      };
      byChatter.set(a.chatterId, entry);
    }
    if (!entry.models.includes(a.creator.name)) entry.models.push(a.creator.name);
  }
  return { entries: [...byChatter.values()], usedWeek };
}

export interface PingResult {
  status:
    | "sent"
    | "already-sent"
    | "no-shift-boundary"
    | "pings-disabled"
    | "nothing-scheduled"
    | "no-webhook"
    | "send-failed";
  detail?: string;
}

/**
 * Called every minute by the in-process worker (and by the external-cron
 * fallback route). Sends the "ON SHIFT :" ping when Berlin local time is inside
 * the first hour of a shift and that (date, shift) hasn't been sent yet.
 * The unique (date, shift) DB row is the claim — safe across restarts and
 * multiple instances. A failed send is retried on later ticks within the hour.
 */
export async function runShiftPing(now: Date = new Date()): Promise<PingResult> {
  const t = berlinNow(now);
  const shift = shiftStartingAtHour(t.hour);
  if (!shift) return { status: "no-shift-boundary" };

  if (!(await getBoolSetting(SETTING_KEYS.pingsEnabled))) return { status: "pings-disabled" };

  let logId: string;
  try {
    const log = await prisma.shiftPingLog.create({
      data: { date: t.date, shift, ok: false, payload: "", error: "pending" },
    });
    logId = log.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.shiftPingLog.findUnique({
        where: { date_shift: { date: t.date, shift } },
      });
      if (!existing || existing.ok) return { status: "already-sent" };
      logId = existing.id; // previous attempt failed — retry within the hour
    } else {
      throw e;
    }
  }

  const finish = async (ok: boolean, payload: string, error: string): Promise<void> => {
    await prisma.shiftPingLog.update({
      where: { id: logId },
      data: { ok, payload, error, sentAt: new Date() },
    });
  };

  const { entries } = await getOnShiftEntries(t.date, shift);
  if (entries.length === 0) {
    await finish(true, "(skipped — nothing scheduled)", "");
    return { status: "nothing-scheduled" };
  }

  const content = composeOnShiftMessage(entries);
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) {
    await finish(false, content, "No Discord webhook configured (Settings page or DISCORD_WEBHOOK_URL)");
    return { status: "no-webhook" };
  }

  const sent = await sendDiscordMessage(webhookUrl, content);
  await finish(sent.ok, content, sent.error ?? "");
  if (!sent.ok) return { status: "send-failed", detail: sent.error };
  console.log(`aura-scheduler: sent ${shift} ping for ${t.date} (${SHIFT_INFO[shift].start})`);
  return { status: "sent" };
}
