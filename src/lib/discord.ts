export interface OnShiftEntry {
  discordId?: string;
  models: string[];
  chatter: string;
  discordUsername: string;
}

/**
 * Shift-start ping format — one line per chatter, listing every model they
 * cover this shift plus their Discord username:
 *
 *   ON SHIFT :
 *
 *   MODEL NAME - Chatter name - @discordname
 *   MODEL 1, MODEL 2, MODEL 3 - Chatter name - @discordname
 *
 * The username segment is omitted when none is on file. When the stored value
 * is a numeric Discord user ID, it renders as <@id> — a real clickable
 * mention that notifies the person. Webhooks cannot resolve usernames to
 * mentions, so a plain username stays plain text.
 */
export function composeOnShiftMessage(entries: OnShiftEntry[]): string {
  const lines = entries
    .filter((e) => e.models.length > 0)
    .map((e) => {
      const models = e.models.map((m) => m.toUpperCase()).join(", ");
      const id = (e.discordId ?? "").trim();
      const raw = e.discordUsername.trim().replace(/^@/, "");
      const mention = /^\d{15,21}$/.test(id)
        ? `<@${id}>`
        : raw
          ? /^\d{15,21}$/.test(raw)
            ? `<@${raw}>`
            : `@${raw}`
          : "";
      const discord = mention ? ` - ${mention}` : "";
      return `${models} - ${e.chatter}${discord}`;
    });
  return ["ON SHIFT :", "", ...lines].join("\n");
}

/** Discord caps a message at 2000 chars; split on line boundaries if ever needed. */
export function chunkMessage(content: string, limit = 2000): string[] {
  if (content.length <= limit) return [content];
  const chunks: string[] = [];
  let current = "";
  for (const line of content.split("\n")) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > limit && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Post a file (e.g. the schedule poster PNG) to a Discord webhook.
 * Poster posts always open with an @everyone tag, so allowed_mentions
 * explicitly permits it (webhooks suppress it otherwise).
 */
export async function sendDiscordFile(
  webhookUrl: string,
  filename: string,
  data: Uint8Array,
  content?: string,
): Promise<{ ok: boolean; error?: string }> {
  const form = new FormData();
  if (content) {
    form.append(
      "payload_json",
      JSON.stringify({ content, allowed_mentions: { parse: ["everyone"] } }),
    );
  }
  form.append("files[0]", new Blob([data as BlobPart], { type: "image/png" }), filename);
  const res = await fetch(webhookUrl, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Discord responded ${res.status}: ${body.slice(0, 300)}` };
  }
  return { ok: true };
}

/** Keep enough of a webhook URL to recognize it, hide the token. */
export function maskWebhook(url: string): string {
  if (!url) return "";
  const m = /^(https:\/\/discord\.com\/api\/webhooks\/\d+\/).+$/.exec(url);
  return m ? `${m[1]}••••••••` : `${url.slice(0, 24)}••••••••`;
}

export async function sendDiscordMessage(
  webhookUrl: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  for (const chunk of chunkMessage(content)) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: chunk }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Discord responded ${res.status}: ${body.slice(0, 300)}` };
    }
  }
  return { ok: true };
}
