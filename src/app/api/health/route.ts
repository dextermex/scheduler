export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({ ok: true, service: "aura-scheduler" });
}
