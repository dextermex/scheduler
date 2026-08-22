import type { NextRequest } from "next/server";
import { runShiftPing } from "@/lib/pings";

export const dynamic = "force-dynamic";

/**
 * External-cron fallback (e.g. cron-job.org or a Railway cron service hitting
 * this every 5 minutes around 00:00/08:00/16:00 Berlin). The built-in worker
 * normally makes this unnecessary; the (date, shift) claim dedupes the two.
 * If CRON_SECRET is set, callers must present it (?secret= or Bearer).
 */
async function handle(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.nextUrl.searchParams.get("secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const result = await runShiftPing();
  return Response.json(result);
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}
