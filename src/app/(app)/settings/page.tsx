import { prisma } from "@/lib/prisma";
import { getBoolSetting, getWebhookUrl, SETTING_KEYS } from "@/lib/settings";
import { SHIFT_INFO, SHIFT_ORDER } from "@/lib/time";
import { saveSettings, sendCurrentShiftPing, sendTestPing } from "./actions";

export const dynamic = "force-dynamic";

function maskWebhook(url: string): string {
  if (!url) return "";
  // Keep enough to recognize it, hide the token.
  const m = /^(https:\/\/discord\.com\/api\/webhooks\/\d+\/).+$/.exec(url);
  return m ? `${m[1]}••••••••` : `${url.slice(0, 24)}••••••••`;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;
  const [webhookUrl, pingsEnabled, fallback, logs] = await Promise.all([
    getWebhookUrl(),
    getBoolSetting(SETTING_KEYS.pingsEnabled),
    getBoolSetting(SETTING_KEYS.fallbackToLatestWeek),
    prisma.shiftPingLog.findMany({ orderBy: { sentAt: "desc" }, take: 12 }),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">
            Discord connection and ping behaviour. Pings go out at{" "}
            {SHIFT_ORDER.map((s) => SHIFT_INFO[s].start).join(", ")} Europe/Berlin time — one line
            per chatter: their models, name, and Discord username.
          </p>
        </div>
      </div>

      {msg ? <div className="notice">{msg}</div> : null}
      {err ? <div className="notice err">{err}</div> : null}

      <div className="card">
        <div className="card-title">Discord</div>
        <form action={saveSettings}>
          <div className="inline-form" style={{ marginBottom: 14, width: "100%" }}>
            <input
              className="input"
              name="webhookUrl"
              defaultValue={maskWebhook(webhookUrl)}
              placeholder="https://discord.com/api/webhooks/…"
              style={{ flex: 1, minWidth: 320 }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <label className="inline-form" style={{ cursor: "pointer" }}>
              <input type="checkbox" name="pingsEnabled" defaultChecked={pingsEnabled} />
              Send automatic pings at shift start (04:00 / 12:00 / 20:00)
            </label>
            <label className="inline-form" style={{ cursor: "pointer" }}>
              <input type="checkbox" name="fallbackToLatestWeek" defaultChecked={fallback} />
              If the current week has no schedule yet, reuse the most recent scheduled week
            </label>
          </div>
          <button className="btn btn-primary" type="submit">
            Save settings
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">Try it</div>
        <div className="inline-form">
          <form action={sendTestPing}>
            <button className="btn" type="submit">
              Send test message
            </button>
          </form>
          <form action={sendCurrentShiftPing}>
            <button className="btn" type="submit">
              Send current shift list now
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Recent automatic pings</div>
        {logs.length === 0 ? (
          <p className="muted">
            Nothing yet — the first ping goes out at the next shift boundary (04:00, 12:00 or 20:00
            Berlin time).
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shift</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{l.date}</td>
                    <td>
                      {SHIFT_INFO[l.shift].label}{" "}
                      <span className="faint mono">{SHIFT_INFO[l.shift].start}</span>
                    </td>
                    <td style={{ color: l.ok ? "var(--ok)" : "var(--danger)" }}>
                      {l.ok ? "sent" : "failed"}
                    </td>
                    <td className="muted" style={{ whiteSpace: "pre-wrap", maxWidth: 420 }}>
                      {l.ok ? l.payload : l.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
