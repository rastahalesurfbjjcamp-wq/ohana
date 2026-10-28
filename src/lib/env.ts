// Variáveis de ambiente. As chaves ficam no Easypanel, nunca no código.
import { createHash } from "node:crypto";

// Segredos internos: se não forem definidos, são derivados da DATABASE_URL (que já tem uma senha aleatória)
function derived(name: string): string {
  const v = process.env[name];
  if (v) return v;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error(`Defina ${name} ou DATABASE_URL`);
  return createHash("sha256").update(`${name}:${base}`).digest("hex");
}
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ${name} não configurada`);
  return v;
}
function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length ? v : undefined;
}

export const env = {
  appUrl: () => opt("APP_URL") ?? "http://localhost:3000",
  // Endereço do Hub dentro do servidor, usado pela Evolution (webhook e mídias). Se vazio, usa APP_URL.
  internalUrl: () => opt("INTERNAL_URL") ?? opt("APP_URL") ?? "http://localhost:3000",
  sessionSecret: () => derived("SESSION_SECRET"),
  redisUrl: () => opt("REDIS_URL") ?? "redis://localhost:6379",
  timezone: () => opt("TZ_LOJA") ?? "America/Sao_Paulo",
  storeName: () => opt("STORE_NAME") ?? "Minha loja",
  storeAbout: () => opt("STORE_ABOUT") ?? "uma loja online",

  evolutionUrl: () => req("EVOLUTION_URL"),
  evolutionKey: () => req("EVOLUTION_API_KEY"),
  evolutionInstance: () => opt("EVOLUTION_INSTANCE") ?? "loja",
  webhookSecret: () => derived("WEBHOOK_SECRET"),

  shopifyDomain: () => opt("SHOPIFY_STORE_DOMAIN"),
  shopifyToken: () => opt("SHOPIFY_ADMIN_TOKEN"),

  metaToken: () => opt("META_ACCESS_TOKEN"),
  metaAdAccount: () => opt("META_AD_ACCOUNT_ID"),

  anthropicKey: () => opt("ANTHROPIC_API_KEY"),
  anthropicModel: () => opt("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
  transcribeKey: () => opt("TRANSCRIBE_API_KEY"),
  transcribeUrl: () => opt("TRANSCRIBE_API_URL") ?? "https://api.openai.com/v1/audio/transcriptions",
  transcribeModel: () => opt("TRANSCRIBE_MODEL") ?? "gpt-4o-mini-transcribe",
};
