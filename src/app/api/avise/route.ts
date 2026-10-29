// Botão "Avise-me quando chegar" da loja: guarda quem quer o tamanho de volta.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/segments";

export const dynamic = "force-dynamic";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(req: NextRequest) {
  let b: Record<string, string> = {};
  try {
    const type = req.headers.get("content-type") ?? "";
    b = type.includes("json") ? await req.json() : (Object.fromEntries((await req.formData()).entries()) as Record<string, string>);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: cors });
  }
  if (b.website) return NextResponse.json({ ok: true }, { headers: cors });
  const phone = normalizePhone(b.phone ?? b.whatsapp ?? b.telefone);
  const product = (b.product ?? b.produto ?? "").toString().trim().slice(0, 160);
  if (!phone || !product) return NextResponse.json({ ok: false, error: "Informe WhatsApp e produto" }, { status: 400, headers: cors });
  const variant = (b.variant ?? b.tamanho ?? "").toString().trim().slice(0, 80) || "";
  await db.waitlist.upsert({
    where: { phone_product_variant: { phone, product, variant } },
    create: { phone, product, variant, name: (b.name ?? b.nome ?? "").toString().trim().slice(0, 80) || null },
    update: { notifiedAt: null },
  });
  return NextResponse.json({ ok: true }, { headers: cors });
}
