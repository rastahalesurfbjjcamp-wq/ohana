// Integrações conectadas pelo painel (Shopify, Meta Ads, IA, transcrição).
// As chaves ficam no banco, criptografadas. Se não houver nada salvo, usa as variáveis do servidor.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { env } from "./env";

export type Provider = "shopify" | "meta" | "ai" | "transcribe";

export interface Creds {
  shopify: { domain?: string; token?: string };
  meta: { token?: string; adAccount?: string };
  ai: { key?: string; model?: string };
  transcribe: { key?: string; url?: string; model?: string };
}

// Campos que são segredo (guardados criptografados e nunca mostrados inteiros)
const SECRET: Record<Provider, string[]> = {
  shopify: ["token"],
  meta: ["token"],
  ai: ["key"],
  transcribe: ["key"],
};

function key() {
  const base = process.env.INTEGRATIONS_SECRET ?? process.env.DATABASE_URL ?? "";
  return createHash("sha256").update(`INTEGRATIONS:${base}`).digest();
}
function encrypt(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}
function decrypt(payload: string) {
  const [, iv, tag, data] = payload.split(":");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

let cache: { at: number; value: Creds } | null = null;

async function readStored(): Promise<Partial<Record<Provider, Record<string, string>>>> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: "_int_" } } });
  const out: Partial<Record<Provider, Record<string, string>>> = {};
  for (const r of rows) {
    const p = r.key.replace("_int_", "") as Provider;
    const v = { ...(r.value as Record<string, string>) };
    for (const f of SECRET[p] ?? []) {
      if (v[f]) {
        try {
          v[f] = decrypt(v[f]);
        } catch {
          delete v[f];
        }
      }
    }
    out[p] = v;
  }
  return out;
}

export async function creds(): Promise<Creds> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  let s: Partial<Record<Provider, Record<string, string>>> = {};
  try {
    s = await readStored();
  } catch {
    s = {};
  }
  const value: Creds = {
    shopify: { domain: s.shopify?.domain || env.shopifyDomain(), token: s.shopify?.token || env.shopifyToken() },
    meta: { token: s.meta?.token || env.metaToken(), adAccount: s.meta?.adAccount || env.metaAdAccount() },
    ai: { key: s.ai?.key || env.anthropicKey(), model: s.ai?.model || env.anthropicModel() },
    transcribe: { key: s.transcribe?.key || env.transcribeKey(), url: s.transcribe?.url || env.transcribeUrl(), model: s.transcribe?.model || env.transcribeModel() },
  };
  cache = { at: Date.now(), value };
  return value;
}

export async function saveIntegration(p: Provider, values: Record<string, string>) {
  const current = (await db.setting.findUnique({ where: { key: `_int_${p}` } }))?.value as Record<string, string> | undefined;
  const next: Record<string, string> = { ...(current ?? {}) };
  for (const [k, v] of Object.entries(values)) {
    const val = v.trim();
    if (!val) continue; // campo vazio mantém o que já estava
    next[k] = SECRET[p].includes(k) ? encrypt(val) : val;
  }
  await db.setting.upsert({ where: { key: `_int_${p}` }, create: { key: `_int_${p}`, value: next }, update: { value: next } });
  cache = null;
}

export async function removeIntegration(p: Provider) {
  await db.setting.deleteMany({ where: { key: `_int_${p}` } });
  cache = null;
}

export async function storedProviders(): Promise<Set<Provider>> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: "_int_" } }, select: { key: true } });
  return new Set(rows.map((r) => r.key.replace("_int_", "") as Provider));
}

export const mask = (s?: string) => (s ? `${s.slice(0, 6)}••••${s.slice(-4)}` : "");
