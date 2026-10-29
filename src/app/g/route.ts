// Link único dos grupos: manda a pessoa para o grupo da comunidade com vaga.
import { NextResponse } from "next/server";
import { groupWithRoom } from "@/lib/redirect";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await groupWithRoom();
  if (!g?.inviteCode) return new NextResponse("Os grupos estão lotados no momento. Tente de novo mais tarde.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return NextResponse.redirect(`https://chat.whatsapp.com/${g.inviteCode}`, 302);
}
