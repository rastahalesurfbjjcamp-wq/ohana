// O membro troca pontos pela entrada num evento do club
import { NextRequest, NextResponse } from "next/server";
import { findMemberFor, memberView, verifyToken } from "@/lib/clubMember";
import { joinMeet } from "@/lib/clubPlus";
import { redis } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { t?: string; meetId?: string };
  if (!b.t || !verifyToken(b.t) || !b.meetId) return NextResponse.json({ error: "Entre de novo na sua área." }, { status: 401 });
  const m = await findMemberFor({ t: b.t });
  if (!m) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  const lock = await redis().set(`clube:ev:${m.id}`, "1", "EX", 15, "NX").catch(() => "OK");
  if (!lock) return NextResponse.json({ error: "Aguarde alguns segundos." }, { status: 429 });
  try {
    await joinMeet(m.id, b.meetId);
    return NextResponse.json({ ok: true, view: await memberView(m.id) });
  } catch (e) {
    return NextResponse.json({ error: String(e).replace(/^Error: /, "").slice(0, 160) }, { status: 400 });
  } finally {
    await redis().del(`clube:ev:${m.id}`).catch(() => null);
  }
}
