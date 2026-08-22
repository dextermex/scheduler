import { prisma } from "./prisma";
import { autoSeedIfEmpty, reconcileRoster } from "./seed";
import { runShiftPing } from "./pings";
import { pushRosterToOpstrack } from "./rosterPush";

const g = globalThis as unknown as { __hvBooted?: boolean };

/**
 * Runs once per server process (from instrumentation.ts): seeds a brand-new
 * database and starts the minute ticker that fires the Discord shift pings at
 * 00:00 / 08:00 / 16:00 Europe/Berlin. The DB claim in runShiftPing keeps this
 * idempotent even if several instances run.
 */
export async function boot(): Promise<void> {
  if (g.__hvBooted) return;
  g.__hvBooted = true;

  try {
    await autoSeedIfEmpty(prisma);
    await reconcileRoster(prisma);
  } catch (e) {
    console.error("aura-scheduler: auto-seed failed (is DATABASE_URL set and migrated?)", e);
  }

  const tick = () => {
    runShiftPing().catch((e) => console.error("aura-scheduler: shift ping failed", e));
  };
  tick(); // catch up immediately if we restarted inside a boundary hour
  setInterval(tick, 60_000);
  console.log("aura-scheduler: shift-ping worker started (00:00/08:00/16:00 Europe/Berlin)");

  // Roster push to OpsTrack — every minute + immediately on boot (see
  // lib/rosterPush.ts for why we push instead of letting OpsTrack pull). Log
  // only when the outcome CHANGES so a broken link can't spam a line a minute.
  let lastPushError: string | null | undefined;
  const pushTick = async () => {
    const r = await pushRosterToOpstrack();
    const err = r.ok ? null : (r.error ?? "unknown");
    if (err !== lastPushError) {
      if (err) console.error(`aura-scheduler: roster push to OpsTrack failing: ${err}`);
      else console.log(`aura-scheduler: roster push to OpsTrack OK (${r.count} creators)`);
      lastPushError = err;
    }
  };
  void pushTick();
  setInterval(() => void pushTick(), 60_000);
}
