// O próprio membro troca pontos por cupom (valor em reais ou peça do catálogo)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPrizeReward, createReward, isActiveAt } from "@/lib/club";
import { findMemberFor, memberView, verifyToken } from "@/lib/clubMember";
import { getSettings } from "@/lib/settings";
import { redis } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { t?: string; points?: number; prizeId?: string };
  if (!b.t || !verifyToken(b.t)) return NextResponse.json({ error: "Entre de novo na sua área." }, { status: 401 });
  const m = await findMemberFor({ t: b.t });
  if (!m) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  const c = (await getSettings()).club;
  if (!isActiveAt(m, new Date(), c.graceDays)) return NextResponse.json({ error: "Sua assinatura precisa estar em dia para resgatar." }, { status: 400 });
  // um resgate por vez
  const lock = await redis().set(`clube:resg:${m.id}`, "1", "EX", 30, "NX");
  if (!lock) return NextResponse.json({ error: "Já estamos gerando um cupom. Aguarde alguns segundos." }, { status: 429 });
  try {
    let code: string;
    if (b.prizeId) {
      code = (await createPrizeReward(m.id, b.prizeId, "membro")).code;
    } else {
      const pts = Math.floor(Number(b.points) / 100) * 100;
      code = (await createReward(m.id, pts, "membro")).code;
    }
    await db.clubEvent.create({ data: { memberId: m.id, kind: "resgate", text: `Resgatou pela área do membro: ${code}` } }).catch(() => null);
    return NextResponse.json({ code, view: await memberView(m.id) });
  } catch (e) {
    return NextResponse.json({ error: String(e).replace(/^Error: /, "").slice(0, 160) }, { status: 400 });
  } finally {
    await redis().del(`clube:resg:${m.id}`).catch(() => null);
  }
}
