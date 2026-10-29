// Avisos da Appmax (Pix pago, cobrança mensal, cancelamento). Responde rápido e é seguro repetir.
import { NextResponse } from "next/server";
import { handleAppmaxEvent } from "@/lib/clubSubscribe";

export async function POST(req: Request) {
  let body: { event?: string; data?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const r = await handleAppmaxEvent(body);
    return NextResponse.json({ ok: true, r });
  } catch (e) {
    console.error("[appmax webhook]", body.event, String(e).slice(0, 200));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
