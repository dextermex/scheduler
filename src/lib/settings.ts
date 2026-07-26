import { prisma } from "./prisma";

export const SETTING_KEYS = {
  webhookUrl: "discordWebhookUrl",
  pingsEnabled: "pingsEnabled",
  fallbackToLatestWeek: "fallbackToLatestWeek",
} as const;

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.pingsEnabled]: "1",
  [SETTING_KEYS.fallbackToLatestWeek]: "1",
};

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getBoolSetting(key: string): Promise<boolean> {
  return (await getSetting(key)) === "1";
}

/** DB value wins; DISCORD_WEBHOOK_URL env var is the fallback. */
export async function getWebhookUrl(): Promise<string> {
  const db = await getSetting(SETTING_KEYS.webhookUrl);
  return db || process.env.DISCORD_WEBHOOK_URL || "";
}
