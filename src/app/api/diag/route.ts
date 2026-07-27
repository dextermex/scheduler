import { prisma } from "@/lib/prisma";
import { creatorAccountsMap, opstrackBase } from "@/lib/opstrack";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY public diagnostic — no auth (added to PUBLIC_PREFIXES in proxy.ts).
 * Tests each thing the home page depends on, catching failures individually so
 * the exact broken dependency is visible as JSON without any server-log access.
 * Remove once the scheduler is confirmed healthy.
 */
export async function GET(): Promise<Response> {
  const out: Record<string, unknown> = {
    node: process.version,
    env: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      databaseUrlHost: (() => {
        try {
          return process.env.DATABASE_URL
            ? new URL(process.env.DATABASE_URL).host
            : null;
        } catch {
          return "unparseable";
        }
      })(),
      hasAppPassword: Boolean(process.env.APP_PASSWORD),
      hasSyncToken: Boolean(process.env.SCHEDULER_SYNC_TOKEN),
      opstrackBase: opstrackBase(),
      nodeEnv: process.env.NODE_ENV,
    },
  };

  try {
    out.creators = await prisma.creator.count();
  } catch (e) {
    out.creatorsError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  try {
    out.chatters = await prisma.chatter.count();
  } catch (e) {
    out.chattersError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  try {
    out.assignments = await prisma.assignment.count();
  } catch (e) {
    out.assignmentsError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  try {
    const m = await creatorAccountsMap();
    out.opstrack = m.error ?? "ok";
  } catch (e) {
    out.opstrackError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }

  return Response.json(out, { status: 200 });
}
