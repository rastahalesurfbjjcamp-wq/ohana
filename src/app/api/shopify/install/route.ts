import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";
import { creds } from "@/lib/integrations";
import { SHOPIFY_SCOPES, callbackUrl, normalizeShop } from "@/lib/shopifyOauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") return NextResponse.redirect(new URL("/login", req.url));
  const c = (await creds()).shopify;
  const shop = normalizeShop(req.nextUrl.searchParams.get("shop") ?? c.domain ?? "");
  if (!shop || !c.clientId || !c.clientSecret) return NextResponse.redirect(new URL("/integracoes?shopify=faltam-dados", req.url));
  const state = randomBytes(16).toString("hex");
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", c.clientId);
  url.searchParams.set("scope", SHOPIFY_SCOPES);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url.toString());
  res.cookies.set("shopify_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
