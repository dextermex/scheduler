"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sendDiscordFile } from "@/lib/discord";
import { renderPosterPng } from "@/lib/posterImage";
import { berlinNow, formatWeekRange, isValidISODate, weekStartOf } from "@/lib/time";

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export async function addModel(formData: FormData): Promise<void> {
  const name = clean(formData.get("name"));
  if (!name) return;
  const existing = await prisma.creator.findUnique({ where: { name } });
  if (existing) redirect(`/models?err=${encodeURIComponent(`"${name}" already exists`)}`);
  const max = await prisma.creator.aggregate({ _max: { sortOrder: true } });
  await prisma.creator.create({ data: { name, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  revalidatePath("/models");
  redirect(`/models?msg=${encodeURIComponent(`${name} added`)}`);
}

export async function updateModel(formData: FormData): Promise<void> {
  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  const sortOrder = Number(formData.get("sortOrder"));
  const webhookUrl = clean(formData.get("webhookUrl"));
  if (!id || !name || !Number.isInteger(sortOrder)) return;
  const clash = await prisma.creator.findFirst({ where: { name, NOT: { id } } });
  if (clash) redirect(`/models?err=${encodeURIComponent(`"${name}" is already taken`)}`);
  // An untouched masked field comes back as the mask — keep the stored value then.
  const data: { name: string; sortOrder: number; webhookUrl?: string } = { name, sortOrder };
  if (!webhookUrl.includes("•")) data.webhookUrl = webhookUrl;
  await prisma.creator.update({ where: { id }, data });
  revalidatePath("/models");
  redirect(`/models?msg=${encodeURIComponent(`${name} saved`)}`);
}

/** Render one model's weekly poster PNG and post it to that model's Discord channel. */
export async function sendModelPoster(formData: FormData): Promise<void> {
  const id = clean(formData.get("id"));
  const rawWeek = clean(formData.get("week"));
  const weekStart =
    rawWeek && isValidISODate(rawWeek) ? weekStartOf(rawWeek) : weekStartOf(berlinNow().date);
  if (!id) return;
  const backKind = clean(formData.get("back"));
  const back =
    backKind === "schedule"
      ? `/?week=${weekStart}`
      : backKind === "poster"
        ? `/poster/${id}?week=${weekStart}`
        : `/models?week=${weekStart}`;

  const creator = await prisma.creator.findUnique({ where: { id } });
  if (!creator) return;
  if (!creator.webhookUrl) {
    redirect(`${back}&err=${encodeURIComponent(`${creator.name} has no Discord webhook yet — add it on the Creators page`)}`);
  }

  const result = await renderPosterPng(id, weekStart);
  if (!result) return;
  const sent = await sendDiscordFile(
    creator.webhookUrl,
    `${creator.name.toLowerCase()}-${weekStart}.png`,
    result.png,
    `@everyone\n**${creator.name.toUpperCase()} — SHIFT SCHEDULE · ${formatWeekRange(weekStart)}**`,
  );
  if (!sent.ok) redirect(`${back}&err=${encodeURIComponent(sent.error ?? "Send failed")}`);
  redirect(
    `${back}&msg=${encodeURIComponent(`${creator.name}'s schedule poster sent to its Discord channel`)}`,
  );
}

/** Send the weekly poster to every active model that has a webhook configured. */
export async function sendAllPosters(formData: FormData): Promise<void> {
  const rawWeek = clean(formData.get("week"));
  const weekStart =
    rawWeek && isValidISODate(rawWeek) ? weekStartOf(rawWeek) : weekStartOf(berlinNow().date);
  const creators = await prisma.creator.findMany({
    where: { active: true, NOT: { webhookUrl: "" } },
    orderBy: { sortOrder: "asc" },
  });
  if (creators.length === 0) {
    redirect(`/?week=${weekStart}&err=${encodeURIComponent("No creators have Discord webhooks yet — add them on the Creators page")}`);
  }
  const failed: string[] = [];
  let sent = 0;
  for (const c of creators) {
    const result = await renderPosterPng(c.id, weekStart);
    if (!result) continue;
    const r = await sendDiscordFile(
      c.webhookUrl,
      `${c.name.toLowerCase()}-${weekStart}.png`,
      result.png,
      `@everyone\n**${c.name.toUpperCase()} — SHIFT SCHEDULE · ${formatWeekRange(weekStart)}**`,
    );
    if (r.ok) sent += 1;
    else failed.push(c.name);
  }
  const msg =
    failed.length === 0
      ? `Sent ${sent} schedule poster${sent === 1 ? "" : "s"} to Discord`
      : `Sent ${sent}, failed for: ${failed.join(", ")}`;
  redirect(`/?week=${weekStart}&${failed.length === 0 ? "msg" : "err"}=${encodeURIComponent(msg)}`);
}

export async function toggleModelActive(formData: FormData): Promise<void> {
  const id = clean(formData.get("id"));
  if (!id) return;
  const creator = await prisma.creator.findUnique({ where: { id } });
  if (!creator) return;
  await prisma.creator.update({ where: { id }, data: { active: !creator.active } });
  revalidatePath("/models");
}

/** Full delete, on purpose: the schema cascades, so ALL of this creator's
 * scheduled shifts (past and future) go with her. The UI confirm spells that
 * out; use Deactivate to rest a creator while keeping history. */
export async function deleteModel(formData: FormData): Promise<void> {
  const id = clean(formData.get("id"));
  if (!id) return;
  const creator = await prisma.creator.findUnique({ where: { id } });
  if (!creator) return;
  await prisma.creator.delete({ where: { id } });
  revalidatePath("/models");
  redirect(`/models?msg=${encodeURIComponent(`${creator.name} deleted, including all her scheduled shifts`)}`);
}
