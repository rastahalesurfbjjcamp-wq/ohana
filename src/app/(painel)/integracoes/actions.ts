"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { creds, removeIntegration, saveIntegration, type Provider } from "@/lib/integrations";
import { gql } from "@/lib/store";

async function admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "ADMIN") throw new Error("Só o administrador pode mudar integrações");
}

async function setStatus(p: Provider, ok: boolean, msg: string) {
  const cur = ((await db.setting.findUnique({ where: { key: "_int_status" } }))?.value as Record<string, unknown>) ?? {};
  const value = { ...cur, [p]: { ok, msg, at: new Date().toISOString() } } as object;
  await db.setting.upsert({ where: { key: "_int_status" }, create: { key: "_int_status", value }, update: { value } });
}

export async function testIntegration(p: Provider) {
  const c = await creds();
  try {
    if (p === "shopify") {
      const d = await gql<{ shop: { name: string } }>(`{ shop { name } }`);
      await setStatus(p, true, `Conectado à loja ${d.shop.name}`);
    }
    if (p === "meta") {
      if (!c.meta.token || !c.meta.adAccount) throw new Error("Falta o token ou a conta de anúncios");
      const act = c.meta.adAccount.startsWith("act_") ? c.meta.adAccount : `act_${c.meta.adAccount}`;
      const r = await fetch(`https://graph.facebook.com/v23.0/${act}?fields=name,account_status&access_token=${encodeURIComponent(c.meta.token)}`, { cache: "no-store" });
      const j = (await r.json()) as { name?: string; error?: { message: string } };
      if (!r.ok) throw new Error(j.error?.message ?? `Meta respondeu ${r.status}`);
      await setStatus(p, true, `Conectado à conta ${j.name}`);
    }
    if (p === "ai") {
      if (!c.ai.key) throw new Error("Falta a chave");
      const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": c.ai.key, "anthropic-version": "2023-06-01" }, cache: "no-store" });
      if (!r.ok) throw new Error(`A chave foi recusada (${r.status})`);
      await setStatus(p, true, "Chave válida");
    }
    if (p === "transcribe") {
      if (!c.transcribe.key) throw new Error("Falta a chave");
      const base = new URL(c.transcribe.url ?? "https://api.openai.com/v1/audio/transcriptions");
      const r = await fetch(`${base.origin}/v1/models`, { headers: { Authorization: `Bearer ${c.transcribe.key}` }, cache: "no-store" });
      if (!r.ok) throw new Error(`A chave foi recusada (${r.status})`);
      await setStatus(p, true, "Chave válida");
    }
  } catch (e) {
    const msg = String(e).replace(/^Error: /, "").replace("SHOPIFY_NAO_CONFIGURADA", "Falta o domínio ou o token");
    await setStatus(p, false, msg.slice(0, 200));
  }
}

export async function saveProvider(f: FormData) {
  await admin();
  const p = String(f.get("provider")) as Provider;
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k !== "provider" && !k.startsWith("$")) values[k] = String(v);
  if (p === "shopify" && values.domain) {
    values.domain = values.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
    if (!values.domain.includes(".")) values.domain = `${values.domain}.myshopify.com`;
  }
  if (p === "meta" && values.adAccount) values.adAccount = values.adAccount.replace(/\D/g, "");
  await saveIntegration(p, values);
  await testIntegration(p);
  revalidatePath("/integracoes");
}

export async function retest(f: FormData) {
  await admin();
  await testIntegration(String(f.get("provider")) as Provider);
  revalidatePath("/integracoes");
}

export async function disconnect(f: FormData) {
  await admin();
  const p = String(f.get("provider")) as Provider;
  await removeIntegration(p);
  await setStatus(p, false, "Desconectado");
  revalidatePath("/integracoes");
}
