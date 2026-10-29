// Link único dos grupos: manda a pessoa para o grupo da comunidade com vaga.
import { NextResponse } from "next/server";
import { groupWithRoom } from "@/lib/redirect";
import { redis } from "@/lib/queue";
import { isoDayLocal } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const k = `hub:gclicks:${isoDayLocal()}`;
    await redis().incr(k);
    await redis().expire(k, 100 * 86400);
    await redis().incr("hub:gclicks:total");
  } catch {}
  const g = await groupWithRoom();
  if (!g?.inviteCode) return new NextResponse("Os grupos estão lotados no momento. Tente de novo mais tarde.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return NextResponse.redirect(`https://chat.whatsapp.com/${g.inviteCode}`, 302);
}
