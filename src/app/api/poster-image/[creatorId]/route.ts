import type { NextRequest } from "next/server";
import { renderPosterPng, type PosterVariant } from "@/lib/posterImage";
import { berlinNow, isValidISODate, weekStartOf } from "@/lib/time";

export const dynamic = "force-dynamic";

/** PNG of a model's weekly schedule poster (auth-gated by the proxy). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> },
): Promise<Response> {
  const { creatorId } = await params;
  const week = req.nextUrl.searchParams.get("week");
  const weekStart =
    week && isValidISODate(week) ? weekStartOf(week) : weekStartOf(berlinNow().date);

  const rawVariant = req.nextUrl.searchParams.get("variant");
  const variant: PosterVariant =
    rawVariant === "timeline" || rawVariant === "rails" ? rawVariant : "grid";

  const result = await renderPosterPng(creatorId, weekStart, variant);
  if (!result) return Response.json({ error: "unknown model" }, { status: 404 });

  return new Response(result.png as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${result.creatorName}-${weekStart}.png"`,
    },
  });
}
