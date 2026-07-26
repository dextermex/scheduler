/**
 * Auth for the app-to-app sync API (/api/models): OpsTrack calls it with the
 * shared SCHEDULER_SYNC_TOKEN (same env var name on both Railway services).
 * Closed by default — with no token configured the endpoint is disabled. That
 * is the opposite of CRON_SECRET (where unset means open) on purpose: firing
 * the cron fallback is harmless, exposing the creator roster is not.
 */
export function checkSyncAuth(provided: string | null | undefined): {
  ok: boolean;
  status: number;
  error?: string;
} {
  const token = process.env.SCHEDULER_SYNC_TOKEN;
  if (!token) return { ok: false, status: 503, error: "sync not configured" };
  if (provided !== token) return { ok: false, status: 401, error: "unauthorized" };
  return { ok: true, status: 200 };
}
