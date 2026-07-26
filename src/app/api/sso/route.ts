import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { expectedToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * OpsTrack single sign-on: being logged into the OpsTrack dashboard IS the
 * login for the embedded Scheduler tab — no second password inside the iframe.
 *
 * OpsTrack's server (which holds the same SCHEDULER_SYNC_TOKEN) mints a
 * short-lived link `/api/sso?exp=<unix seconds>&sig=<hex HMAC-SHA256(token,
 * "sso:"+exp)>` and the tab navigates here; a valid signature sets the normal
 * session cookie and redirects to the app. A stale or forged link just lands
 * on /login, so the password form remains the fallback. Standalone visits to
 * the site keep the APP_PASSWORD gate — this route only trades one proven
 * OpsTrack session for one scheduler session.
 */
/**
 * Absolute base URL of THIS deployment as the browser sees it. Behind Railway's
 * TLS-terminating proxy, req.nextUrl reflects the internal http hop — redirecting
 * there sends the iframe to http://…, which the embedding dashboard's CSP
 * (frame-src https: only) blocks with Chrome's "content is blocked" page. The
 * x-forwarded-proto/host headers carry the real public scheme + host.
 */
function selfBase(req: NextRequest): string {
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    req.nextUrl.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    req.nextUrl.host;
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const syncToken = process.env.SCHEDULER_SYNC_TOKEN;
  if (!syncToken) return Response.json({ error: "sso not configured" }, { status: 503 });

  const loginUrl = NextResponse.redirect(`${selfBase(req)}/login`);

  const expRaw = req.nextUrl.searchParams.get("exp") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  const exp = Number(expRaw);
  const nowSec = Date.now() / 1000;
  // exp must be in the future but never more than 10 minutes out — a leaked
  // link goes dead almost immediately.
  if (!Number.isInteger(exp) || exp <= nowSec || exp > nowSec + 600) return loginUrl;

  const expected = crypto.createHmac("sha256", syncToken).update(`sso:${exp}`).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return loginUrl;

  const res = NextResponse.redirect(`${selfBase(req)}/`);
  const session = await expectedToken();
  // No APP_PASSWORD configured → the site is open anyway; nothing to set.
  if (session !== null) res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
  return res;
}
