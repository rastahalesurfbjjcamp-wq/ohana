// Envio pelo WhatsApp com proteção do número: limite por hora, intervalo aleatório
// e marcação das mensagens que o próprio sistema mandou (para não responder a si mesmo).
import { evolution } from "./evolution";
import { redis } from "./queue";
import { getSettings } from "./settings";

const SENT_TTL = 60 * 60 * 6;

export async function markSent(res: unknown) {
  const id = (res as { key?: { id?: string } })?.key?.id;
  if (id) await redis().set(`tribo:sent:${id}`, "1", "EX", SENT_TTL);
}

export async function sentByBot(messageId: string) {
  return (await redis().exists(`tribo:sent:${messageId}`)) === 1;
}

function hourKey() {
  const d = new Date();
  return `tribo:rate:${d.toISOString().slice(0, 13)}`;
}

// Devolve quantos ms esperar até poder mandar de novo (0 = pode mandar agora)
export async function reserveSlot(): Promise<number> {
  const s = await getSettings();
  const key = hourKey();
  const n = await redis().incr(key);
  if (n === 1) await redis().expire(key, 3700);
  if (n > s.sending.maxPerHour) {
    await redis().decr(key);
    const now = new Date();
    return (60 - now.getUTCMinutes()) * 60_000 - now.getUTCSeconds() * 1000 + 5_000;
  }
  return 0;
}

export async function humanDelay() {
  const s = await getSettings();
  const ms = s.sending.minDelayMs + Math.random() * Math.max(0, s.sending.maxDelayMs - s.sending.minDelayMs);
  await new Promise((r) => setTimeout(r, ms));
}

export async function sendText(to: string, text: string, opts: { mentionAll?: boolean } = {}) {
  const res = await evolution.sendText(to, text, opts);
  await markSent(res);
  return res;
}

export async function sendMedia(
  to: string,
  media: { url: string; type: "image" | "video" | "document"; caption?: string; fileName?: string; mimetype?: string },
  opts: { mentionAll?: boolean } = {},
) {
  const res = await evolution.sendMedia(to, media, opts);
  await markSent(res);
  return res;
}
