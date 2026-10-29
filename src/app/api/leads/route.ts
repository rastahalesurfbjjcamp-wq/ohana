// Recebe o formulário do Grupo VIP (página da Shopify) e guarda o lead.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/queue";
import { normalizePhone } from "@/lib/segments";
import { redirectLink } from "@/lib/redirect";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(req: NextRequest) {
  let body: Record<string, string> = {};
  try {
    const type = req.headers.get("content-type") ?? "";
    body = type.includes("json") ? await req.json() : Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  } catch {
    return NextResponse.json({ ok: false, error: "dados inválidos" }, { status: 400, headers: cors });
  }
  if (body.website) return NextResponse.json({ ok: true, link: redirectLink() }, { headers: cors }); // robô
  const phone = normalizePhone(body.phone ?? body.whatsapp ?? body.telefone);
  if (!phone) return NextResponse.json({ ok: false, error: "WhatsApp inválido" }, { status: 400, headers: cors });
  const name = (body.name ?? body.nome ?? "").toString().trim().slice(0, 80) || null;
  const lead = await db.lead.upsert({
    where: { phone },
    create: {
      phone,
      name,
      email: (body.email ?? "").toString().trim().slice(0, 120) || null,
      birthday: (body.birthday ?? body.aniversario ?? "").toString().trim().slice(0, 10) || null,
      source: (body.source ?? "grupo-vip").toString().slice(0, 40),
      utmSource: body.utm_source?.toString().slice(0, 60) || null,
      utmMedium: body.utm_medium?.toString().slice(0, 60) || null,
      utmCampaign: body.utm_campaign?.toString().slice(0, 80) || null,
    },
    update: { name: name ?? undefined },
  });
  await import("@/lib/funnels").then((m) => m.funnelEvent("lead_novo", phone, name)).catch(() => {});
  if (!lead.welcomeSent) await enqueue("lead-welcome", { leadId: lead.id }, { jobId: `welcome-${lead.id}`, delayMs: 5000 }).catch(() => {});
  return NextResponse.json({ ok: true, link: redirectLink() }, { headers: cors });
}
