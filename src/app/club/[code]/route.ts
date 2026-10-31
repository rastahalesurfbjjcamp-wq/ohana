// Link de indicação do club: leva para a assinatura guardando quem indicou
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ref = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20);
  return NextResponse.redirect(`${env.appUrl().replace(/\/$/, "")}/assinar${ref ? `?ref=${ref}` : ""}`, 302);
}
