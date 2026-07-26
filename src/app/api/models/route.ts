import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSyncAuth } from "@/lib/syncAuth";

export const dynamic = "force-dynamic";

/**
 * App-to-app sync: the creator (model) roster, for OpsTrack. Here a creator is
 * ONE person spanning all their pages; OpsTrack maps each of its OnlyFansAPI
 * accounts (VIP page, free page, …) onto one of these ids so both apps talk
 * about the same roster.
 *
 * Token-gated via SCHEDULER_SYNC_TOKEN (?token= or Authorization: Bearer) —
 * no session cookie involved, so /api/models sits on the proxy's public list.
 * Creators' Discord webhook URLs are secrets and are NOT exposed here.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const provided =
    req.nextUrl.searchParams.get("token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = checkSyncAuth(provided);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const models = await prisma.creator.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, sortOrder: true },
  });
  return Response.json({ models });
}
