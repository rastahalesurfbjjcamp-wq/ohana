// Consulta do membro: link do WhatsApp (t) ou CPF + 4 últimos dígitos do celular
import { NextRequest, NextResponse } from "next/server";
import { findMemberFor, memberView } from "@/lib/clubMember";
import { redis } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { t?: string; cpf?: string; fim?: string };
  if (!b.t) {
    // tentativa por CPF: no máximo 12 a cada 10 minutos por endereço
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "x";
    const n = await redis().incr(`clube:meu:${ip}`).catch(() => 0);
    if (n === 1) await redis().expire(`clube:meu:${ip}`, 600).catch(() => null);
    if (n > 12) return NextResponse.json({ error: "Muitas tentativas. Espere alguns minutos." }, { status: 429 });
  }
  const m = await findMemberFor(b);
  if (!m) return NextResponse.json({ error: b.t ? "Link inválido. Entre com o CPF." : "Não encontramos. Confira o CPF e os 4 últimos números do celular cadastrado." }, { status: 404 });
  return NextResponse.json(await memberView(m.id), { headers: { "Cache-Control": "no-store" } });
}
