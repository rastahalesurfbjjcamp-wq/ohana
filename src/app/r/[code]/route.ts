// Link do parceiro: conta o clique e manda para a loja já com o cupom aplicado.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const s = await getSettings();
  const store = s.postsale.storeUrl.replace(/\/$/, "");
  const ref = await db.referral.findFirst({ where: { code: { equals: code, mode: "insensitive" } } }).catch(() => null);
  if (!ref) return NextResponse.redirect(store, 302);
  await db.referral.update({ where: { id: ref.id }, data: { clicks: { increment: 1 } } }).catch(() => null);
  return NextResponse.redirect(`${store}/discount/${encodeURIComponent(ref.code)}?redirect=/`, 302);
}
