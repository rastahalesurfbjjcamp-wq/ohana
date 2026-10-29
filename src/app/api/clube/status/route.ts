// A página do Pix pergunta aqui se o pagamento caiu
import { NextResponse } from "next/server";
import { checkStatus } from "@/lib/clubSubscribe";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^c[a-z0-9]{20,}$/.test(id)) return NextResponse.json({ status: "nao-encontrado" }, { status: 404 });
  return NextResponse.json(await checkStatus(id), { headers: { "Cache-Control": "no-store" } });
}
