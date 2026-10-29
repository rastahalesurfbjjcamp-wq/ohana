import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { creds, saveIntegration } from "@/lib/integrations";
import { normalizeShop, validHmac } from "@/lib/shopifyOauth";
import { testIntegration } from "@/app/(painel)/integracoes/actions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/integracoes?shopify=${q}`, req.url));
  const s = await getSession();
  if (!s || s.role !== "ADMIN") return NextResponse.redirect(new URL("/login", req.url));
  const p = req.nextUrl.searchParams;
  const c = (await creds()).shopify;
  const shop = normalizeShop(p.get("shop") ?? "");
  if (!shop || !c.clientId || !c.clientSecret) return back("faltam-dados");
  if (!p.get("state") || p.get("state") !== req.cookies.get("shopify_state")?.value) return back("sessao-expirou");
  if (!validHmac(p, c.clientSecret)) return back("assinatura-invalida");
  const r = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret, code: p.get("code") }),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; scope?: string };
  if (!r.ok || !j.access_token) return back("falhou");
  await saveIntegration("shopify", { domain: shop, token: j.access_token });
  await testIntegration("shopify");
  const res = back("conectada");
  res.cookies.delete("shopify_state");
  return res;
}
