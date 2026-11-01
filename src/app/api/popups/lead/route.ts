// Cadastro feito no popup: guarda o lead, coloca na lista e devolve o cupom (ou o prêmio do jogo)
import { NextRequest, NextResponse } from "next/server";
import { popupLead } from "@/lib/popups";
import { cors } from "../cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(req: NextRequest) {
  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400, headers: cors });
  }
  if (body.website) return NextResponse.json({ ok: true }, { headers: cors });
  const r = await popupLead(String(body.id ?? ""), body);
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: cors });
}
