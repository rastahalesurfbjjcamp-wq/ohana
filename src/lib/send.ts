// Envio pelo WhatsApp com proteção do número: limite por hora, intervalo aleatório
// e marcação das mensagens que o próprio sistema mandou (para não responder a si mesmo).
import { evolution } from "./evolution";
import { redis } from "./queue";
import { getSettings } from "./settings";

const SENT_TTL = 60 * 60 * 6;

export async function markSent(res: unknown) {
  const id = (res as { key?: { id?: string } })?.key?.id;
  if (id) await redis().set(`hub:sent:${id}`, "1", "EX", SENT_TTL);
}

export async function sentByBot(messageId: string) {
  return (await redis().exists(`hub:sent:${messageId}`)) === 1;
}

function hourKey() {
  const d = new Date();
  return `hub:rate:${d.toISOString().slice(0, 13)}`;
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

export async function sendText(to: string, text: string, opts: { mentionAll?: boolean; delayMs?: number } = {}) {
  const res = await evolution.sendText(to, text, opts);
  await markSent(res);
  return res;
}

export async function sendMedia(
  to: string,
  media: { url: string; type: "image" | "video" | "document"; caption?: string; fileName?: string; mimetype?: string },
  opts: { mentionAll?: boolean; delayMs?: number } = {},
) {
  const res = await evolution.sendMedia(to, media, opts);
  await markSent(res);
  return res;
}

// A comunidade em si não recebe mensagem: quem recebe é o grupo de avisos dela.
// Troca a comunidade pelo grupo de avisos e tira repetidos.
export async function sendableJids(jids: string[]): Promise<string[]> {
  const { db } = await import("./db");
  const parents = await db.group.findMany({ where: { jid: { in: jids }, kind: "comunidade" }, select: { jid: true } });
  if (!parents.length) return [...new Set(jids)];
  const ann = await db.group.findMany({ where: { parentJid: { in: parents.map((p) => p.jid) }, kind: "avisos", archived: false }, select: { jid: true, parentJid: true } });
  const map = new Map(ann.map((a) => [a.parentJid!, a.jid]));
  return [...new Set(jids.map((j) => map.get(j) ?? j))];
}

// Disparo em massa no modo seguro: limite por hora menor nos primeiros dias do número (aquecimento)
export async function broadcastCap(write = true): Promise<number> {
  const { db } = await import("./db");
  const s = await getSettings();
  const row = await db.setting.findUnique({ where: { key: "_bc_first_day" } });
  let first = (row?.value as { at?: string } | undefined)?.at;
  if (!first && !write) first = new Date().toISOString();
  if (!first) {
    first = new Date().toISOString();
    await db.setting.upsert({ where: { key: "_bc_first_day" }, create: { key: "_bc_first_day", value: { at: first } }, update: {} });
  }
  const days = (Date.now() - Date.parse(first)) / 864e5;
  const warm = days < 3 ? 30 : days < 7 ? 60 : 120;
  return Math.min(warm, s.sending.maxPerHour);
}

export async function reserveBroadcastSlot(): Promise<number> {
  const cap = await broadcastCap();
  const key = `hub:bc:${new Date().toISOString().slice(0, 13)}`;
  const n = await redis().incr(key);
  if (n === 1) await redis().expire(key, 3700);
  if (n > cap) {
    await redis().decr(key);
    const now = new Date();
    return (60 - now.getUTCMinutes()) * 60_000 - now.getUTCSeconds() * 1000 + 5_000 + Math.random() * 120_000;
  }
  return reserveSlot();
}

// "{Oi|Olá|E aí}": sorteia uma das opções para cada pessoa
export const spin = (t: string) => t.replace(/\{([^{}|]+(?:\|[^{}|]*)+)\}/g, (_, g: string) => { const o = g.split("|"); return o[Math.floor(Math.random() * o.length)]; });

// Só manda das 8h às 21h (Brasília). Fora disso devolve quantos ms esperar até as 8h
export function quietWait(): number {
  const br = new Date(Date.now() - 3 * 3600_000);
  const h = br.getUTCHours();
  if (h >= 8 && h < 21) return 0;
  const next = new Date(br);
  if (h >= 21) next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(8, Math.floor(Math.random() * 20), 0, 0);
  return next.getTime() - br.getTime();
}
