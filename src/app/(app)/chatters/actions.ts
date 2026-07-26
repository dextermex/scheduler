"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export async function addChatter(formData: FormData): Promise<void> {
  const name = clean(formData.get("name"));
  const fullName = clean(formData.get("fullName"));
  const posterName = clean(formData.get("posterName"));
  const discordUsername = clean(formData.get("discordUsername")).replace(/^@/, "");
  const discordId = clean(formData.get("discordId")).replace(/\D/g, "");
  const color = clean(formData.get("color")) || "#8b7cff";
  const isLX = formData.get("isLX") === "on";
  if (!name) redirect("/chatters?err=Infloww+name+is+required");

  const existing = await prisma.chatter.findUnique({ where: { name } });
  if (existing) redirect(`/chatters?err=${encodeURIComponent(`"${name}" already exists`)}`);

  await prisma.chatter.create({
    data: { name, fullName, posterName: posterName || name, discordUsername, discordId, color, isLX },
  });
  revalidatePath("/chatters");
  redirect(`/chatters?msg=${encodeURIComponent(`${name} added to the roster`)}`);
}

/**
 * Saves roster rows from the single big roster form. A row's own Save button
 * submits with `only=<id>` and saves just that row; the "Save all changes"
 * button saves every row that actually changed.
 */
export async function saveChatters(formData: FormData): Promise<void> {
  const only = clean(formData.get("only"));
  const allIds = formData.getAll("rowId").map(String);
  const targets = only ? [only] : allIds;

  let saved = 0;
  const failed: string[] = [];
  for (const id of targets) {
    const existing = await prisma.chatter.findUnique({ where: { id } });
    if (!existing) continue;

    const name = clean(formData.get(`name__${id}`));
    if (!name) {
      failed.push(`${existing.name} (Infloww name can't be empty)`);
      continue;
    }
    const data = {
      name,
      fullName: clean(formData.get(`fullName__${id}`)),
      posterName: clean(formData.get(`posterName__${id}`)) || name,
      discordUsername: clean(formData.get(`discordUsername__${id}`)).replace(/^@/, ""),
      discordId: clean(formData.get(`discordId__${id}`)).replace(/\D/g, ""),
      color: clean(formData.get(`color__${id}`)) || "#8b7cff",
      isLX: formData.get(`isLX__${id}`) === "on",
    };
    // Color inputs lowercase hex values on submit — compare case-insensitively
    // so untouched rows don't count as changed.
    const unchanged =
      existing.name === data.name &&
      existing.fullName === data.fullName &&
      existing.posterName === data.posterName &&
      existing.discordUsername === data.discordUsername &&
      existing.discordId === data.discordId &&
      existing.color.toLowerCase() === data.color.toLowerCase() &&
      existing.isLX === data.isLX;
    if (unchanged) continue;

    try {
      await prisma.chatter.update({ where: { id }, data });
      saved += 1;
    } catch {
      failed.push(`${data.name} (name already taken)`);
    }
  }

  revalidatePath("/chatters");
  if (failed.length > 0) {
    redirect(
      `/chatters?err=${encodeURIComponent(`Saved ${saved}, failed: ${failed.join(", ")}`)}`,
    );
  }
  redirect(
    `/chatters?msg=${encodeURIComponent(
      saved === 0 ? "Nothing changed" : `Saved ${saved} chatter${saved === 1 ? "" : "s"}`,
    )}`,
  );
}

export async function toggleChatterActive(formData: FormData): Promise<void> {
  const id = clean(formData.get("id"));
  if (!id) return;
  const chatter = await prisma.chatter.findUnique({ where: { id } });
  if (!chatter) return;
  await prisma.chatter.update({ where: { id }, data: { active: !chatter.active } });
  revalidatePath("/chatters");
}

/** Delete if never scheduled; otherwise deactivate to keep history intact. */
export async function deleteChatter(formData: FormData): Promise<void> {
  const id = clean(formData.get("id"));
  if (!id) return;
  const used = await prisma.assignment.count({ where: { chatterId: id } });
  if (used > 0) {
    await prisma.chatter.update({ where: { id }, data: { active: false } });
    revalidatePath("/chatters");
    redirect(
      `/chatters?msg=${encodeURIComponent(
        "That chatter has scheduled shifts, so they were deactivated instead of deleted",
      )}`,
    );
  }
  await prisma.chatter.delete({ where: { id } });
  revalidatePath("/chatters");
  redirect(`/chatters?msg=${encodeURIComponent("Chatter deleted")}`);
}
