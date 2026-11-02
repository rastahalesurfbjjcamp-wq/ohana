// Link do parceiro: conta o clique e manda para a loja com o cupom aplicado e a indicação marcada.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const s = await getSettings();
  const store = s.postsale.storeUrl.replace(/\/$/, "");
  const ref = await db.referral.findFirst({ where: { code: { equals: code, mode: "insensitive" } } }).catch(() => null);
  if (!ref) return NextResponse.redirect(store, 302);
  await db.referral.update({ where: { id: ref.id }, data: { clicks: { increment: 1 } } }).catch(() => null);
  const c = encodeURIComponent(ref.code);
  // cupom aplicado + marca da indicação (a loja guarda num cookie e grava no carrinho)
  const path = new URL(req.url).searchParams.get("p") ?? "/";
  const base = /^\/[^/\\]/.test(path) || path === "/" ? path : "/";
  const land = `${base}${base.includes("?") ? "&" : "?"}ref=${c}&utm_source=atleta&utm_medium=link&utm_campaign=${c}`;
  return NextResponse.redirect(`${store}/discount/${c}?redirect=${encodeURIComponent(land)}`, 302);
}
