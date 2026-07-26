"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatWeekRange, isValidISODate, weekStartOf, type ShiftKey } from "@/lib/time";
import {
  parseWeekClipboard,
  serializeWeekClipboard,
  WEEK_CLIPBOARD_COOKIE,
  WEEK_CLIPBOARD_MAX_AGE,
} from "@/lib/weekClipboard";

const SHIFTS: ShiftKey[] = ["MORNING", "AFTERNOON", "NIGHT"];

function cleanWeek(raw: FormDataEntryValue | null): string | null {
  const week = String(raw ?? "");
  if (!isValidISODate(week) || weekStartOf(week) !== week) return null;
  return week;
}

function cleanSlot(formData: FormData): {
  weekStart: string;
  day: number;
  shift: ShiftKey;
  creatorId: string;
} | null {
  const weekStart = cleanWeek(formData.get("weekStart"));
  const day = Number(formData.get("day"));
  const shift = String(formData.get("shift")) as ShiftKey;
  const creatorId = String(formData.get("creatorId") ?? "");
  if (!weekStart || !Number.isInteger(day) || day < 0 || day > 6) return null;
  if (!SHIFTS.includes(shift) || !creatorId) return null;
  return { weekStart, day, shift, creatorId };
}

export async function addAssignment(formData: FormData): Promise<void> {
  const slot = cleanSlot(formData);
  const chatterId = String(formData.get("chatterId") ?? "");
  if (!slot || !chatterId) return;
  await prisma.assignment.upsert({
    where: { weekStart_day_shift_creatorId_chatterId: { ...slot, chatterId } },
    update: {},
    create: { ...slot, chatterId },
  });
  revalidatePath("/");
}

export async function removeAssignment(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.assignment.deleteMany({ where: { id } });
  revalidatePath("/");
}

/** Copy every assignment of `fromWeek` into `toWeek` (skipping ones already there). */
export async function copyWeek(formData: FormData): Promise<void> {
  const fromWeek = cleanWeek(formData.get("fromWeek"));
  const toWeek = cleanWeek(formData.get("toWeek"));
  if (!fromWeek || !toWeek || fromWeek === toWeek) return;
  const source = await prisma.assignment.findMany({ where: { weekStart: fromWeek } });
  if (source.length === 0) return;
  await prisma.assignment.createMany({
    data: source.map((a) => ({
      weekStart: toWeek,
      day: a.day,
      shift: a.shift,
      creatorId: a.creatorId,
      chatterId: a.chatterId,
    })),
    skipDuplicates: true,
  });
  revalidatePath("/");
}

/** Remember one creator's week so it can be pasted onto other creators (or weeks). */
export async function copyWeekForCreator(formData: FormData): Promise<void> {
  const weekStart = cleanWeek(formData.get("weekStart"));
  const creatorId = String(formData.get("creatorId") ?? "");
  if (!weekStart || !creatorId) return;
  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) return;
  const count = await prisma.assignment.count({ where: { weekStart, creatorId } });
  if (count === 0) {
    redirect(
      `/?week=${weekStart}&err=${encodeURIComponent(`${creator.name} has no shifts this week — nothing to copy`)}`,
    );
  }
  const store = await cookies();
  store.set(WEEK_CLIPBOARD_COOKIE, serializeWeekClipboard({ creatorId, weekStart }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WEEK_CLIPBOARD_MAX_AGE,
  });
  redirect(
    `/?week=${weekStart}&msg=${encodeURIComponent(
      `Copied ${creator.name}'s week — hit “Paste week” on any model to apply it`,
    )}`,
  );
}

/** Paste the copied week onto this creator (merging with whatever is already there). */
export async function pasteWeekForCreator(formData: FormData): Promise<void> {
  const weekStart = cleanWeek(formData.get("weekStart"));
  const creatorId = String(formData.get("creatorId") ?? "");
  if (!weekStart || !creatorId) return;
  const store = await cookies();
  const clip = parseWeekClipboard(store.get(WEEK_CLIPBOARD_COOKIE)?.value);
  if (!clip) {
    redirect(`/?week=${weekStart}&err=${encodeURIComponent("Nothing copied yet — hit “Copy week” on a model first")}`);
  }
  if (clip.creatorId === creatorId && clip.weekStart === weekStart) return;
  const [target, source, assignments] = await Promise.all([
    prisma.creator.findUnique({ where: { id: creatorId } }),
    prisma.creator.findUnique({ where: { id: clip.creatorId } }),
    prisma.assignment.findMany({ where: { weekStart: clip.weekStart, creatorId: clip.creatorId } }),
  ]);
  if (!target) return;
  if (!source || assignments.length === 0) {
    redirect(
      `/?week=${weekStart}&err=${encodeURIComponent("The copied week no longer has any shifts — copy another one")}`,
    );
  }
  const created = await prisma.assignment.createMany({
    data: assignments.map((a) => ({
      weekStart,
      day: a.day,
      shift: a.shift,
      creatorId,
      chatterId: a.chatterId,
    })),
    skipDuplicates: true,
  });
  revalidatePath("/");
  const from =
    clip.weekStart === weekStart
      ? `${source.name}'s week`
      : `${source.name}'s week of ${formatWeekRange(clip.weekStart)}`;
  const msg =
    created.count === 0
      ? `${target.name} already has every shift from ${from}`
      : `Pasted ${created.count} shift${created.count === 1 ? "" : "s"} from ${from} onto ${target.name}`;
  redirect(`/?week=${weekStart}&msg=${encodeURIComponent(msg)}`);
}

export async function clearWeekForCreator(formData: FormData): Promise<void> {
  const weekStart = cleanWeek(formData.get("weekStart"));
  const creatorId = String(formData.get("creatorId") ?? "");
  if (!weekStart || !creatorId) return;
  await prisma.assignment.deleteMany({ where: { weekStart, creatorId } });
  revalidatePath("/");
}

export async function addCreator(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const weekStart = cleanWeek(formData.get("weekStart"));
  if (!name) return;
  const max = await prisma.creator.aggregate({ _max: { sortOrder: true } });
  await prisma.creator.upsert({
    where: { name },
    update: { active: true },
    create: { name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  revalidatePath("/");
  redirect(weekStart ? `/?week=${weekStart}` : "/");
}
