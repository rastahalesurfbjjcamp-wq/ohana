// Começa a assinatura do clube (Pix ou cartão). Os dados do cartão só passam para a Appmax.
import { NextResponse } from "next/server";
import { redis } from "@/lib/queue";
import { startCheckout, validate, type StartInput } from "@/lib/clubSubscribe";

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "0.0.0.0";
  try {
    const r = redis();
    const n = await r.incr(`clube:try:${ip}`);
    if (n === 1) await r.expire(`clube:try:${ip}`, 600);
    if (n > 20) return NextResponse.json({ error: "Muitas tentativas. Espere alguns minutos." }, { status: 429 });
  } catch {
    // sem redis segue normal
  }
  let body: StartInput;
  try {
    body = (await req.json()) as StartInput;
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const input: StartInput = { name: String(body.name ?? ""), cpf: String(body.cpf ?? ""), phone: String(body.phone ?? ""), email: String(body.email ?? ""), method: body.method === "cartao" ? "cartao" : "pix", ip, card: body.card, extra: body.extra && typeof body.extra === "object" ? Object.fromEntries(Object.entries(body.extra).map(([k, v]) => [k, String(v ?? "").slice(0, 120)])) : undefined };
  const err = validate(input);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const out = await startCheckout(input);
  return NextResponse.json(out, { status: "error" in out && out.error && !("id" in out) ? 400 : 200, headers: { "Cache-Control": "no-store" } });
}
