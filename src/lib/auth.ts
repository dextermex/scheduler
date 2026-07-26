/**
 * Shared-password auth. Edge-safe on purpose (only Web Crypto, no Node deps) so
 * the proxy can import it. The session cookie holds a deterministic token
 * derived from APP_PASSWORD; changing the password invalidates every session.
 */

export const SESSION_COOKIE = "hv_session";

/**
 * Session-cookie attributes, shared by the login form and the OpsTrack SSO
 * route so the two can never drift. The scheduler is embedded inside the
 * OpsTrack dashboard via a cross-site iframe; for the cookie to be sent inside
 * that frame under modern third-party cookie protections it must be
 * SameSite=None; Secure; Partitioned (CHIPS). Insecure local dev falls back to
 * Lax, since SameSite=None requires Secure.
 */
export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "none" | "lax";
  secure: boolean;
  partitioned: boolean;
  maxAge: number;
  path: string;
} {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    partitioned: isProd,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  };
}

let cached: { pw: string; token: string } | null = null;

export async function expectedToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null; // no password configured → site is open
  if (cached && cached.pw === pw) return cached.token;
  const data = new TextEncoder().encode(`aura-scheduler:${pw}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const token = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  cached = { pw, token };
  return token;
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  const expected = await expectedToken();
  if (expected === null) return true;
  return token === expected;
}
