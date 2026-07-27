/**
 * Route protection (Next.js 16 "proxy" convention). One shared password gates
 * the whole site; /login, the health check, and the cron + models endpoints
 * (which do their own secret/token checks) stay reachable. With no APP_PASSWORD
 * set, the site is open — handy for local dev.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/api/health", "/api/cron", "/api/models", "/api/sso", "/api/diag"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function proxy(req: NextRequest): Promise<Response> {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSessionToken(token)) return NextResponse.next();

  return NextResponse.redirect(new URL("/login", req.nextUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
