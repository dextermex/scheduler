"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { composeOnShiftMessage, sendDiscordMessage } from "@/lib/discord";
import { getOnShiftEntries } from "@/lib/pings";
import { getWebhookUrl, setSetting, SETTING_KEYS } from "@/lib/settings";
import { addDaysISO, berlinNow, shiftContainingHour, SHIFT_INFO } from "@/lib/time";

export async function saveSettings(formData: FormData): Promise<void> {
  const webhookUrl = String(formData.get("webhookUrl") ?? "").trim();
  // An untouched masked field comes back as the mask — keep the stored value then.
  if (!webhookUrl.includes("•")) {
    await setSetting(SETTING_KEYS.webhookUrl, webhookUrl);
  }
  await setSetting(SETTING_KEYS.pingsEnabled, formData.get("pingsEnabled") ? "1" : "0");
  await setSetting(
    SETTING_KEYS.fallbackToLatestWeek,
    formData.get("fallbackToLatestWeek") ? "1" : "0",
  );
  revalidatePath("/settings");
  redirect(`/settings?msg=${encodeURIComponent("Settings saved")}`);
}

export async function sendTestPing(): Promise<void> {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) {
    redirect(`/settings?err=${encodeURIComponent("No webhook configured yet — paste it above and save first")}`);
  }
  const res = await sendDiscordMessage(webhookUrl, "✅ Test ping from AURA Scheduler");
  if (!res.ok) redirect(`/settings?err=${encodeURIComponent(res.error ?? "Send failed")}`);
  redirect(`/settings?msg=${encodeURIComponent("Test message sent — check the Discord channel")}`);
}

/** Manually send the ping for the shift block we are in RIGHT now. */
export async function sendCurrentShiftPing(): Promise<void> {
  const t = berlinNow();
  const { shift, previousDay } = shiftContainingHour(t.hour);
  const date = previousDay ? addDaysISO(t.date, -1) : t.date;

  const { entries } = await getOnShiftEntries(date, shift);
  if (entries.length === 0) {
    redirect(`/settings?err=${encodeURIComponent("Nothing is scheduled for the current shift")}`);
  }
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) {
    redirect(`/settings?err=${encodeURIComponent("No webhook configured yet — paste it above and save first")}`);
  }
  const res = await sendDiscordMessage(webhookUrl, composeOnShiftMessage(entries));
  if (!res.ok) redirect(`/settings?err=${encodeURIComponent(res.error ?? "Send failed")}`);
  redirect(
    `/settings?msg=${encodeURIComponent(
      `Sent the ${SHIFT_INFO[shift].label} (${SHIFT_INFO[shift].start}) list to Discord`,
    )}`,
  );
}
