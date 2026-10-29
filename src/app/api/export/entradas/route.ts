// Exporta as entradas e saídas em planilha (CSV). Só para quem está logado.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await getSession())) return new NextResponse("Entre no painel primeiro", { status: 401 });
  const days = Math.min(365, Number(req.nextUrl.searchParams.get("dias") ?? 30) || 30);
  const events = await db.memberEvent.findMany({
    where: { createdAt: { gte: new Date(Date.now() - days * 864e5) }, group: { isCommunity: true } },
    orderBy: { createdAt: "desc" },
    include: { contact: true, group: true },
  });
  const T: Record<string, string> = { JOIN: "entrou", RETURN: "voltou", LEAVE: "saiu" };
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [["Data", "Movimento", "Nome", "WhatsApp", "Grupo", "Removido por admin", "Mensagem de volta"].join(";")];
  for (const e of events) lines.push([fmt.format(e.createdAt), T[e.type], q(e.contact.name ?? ""), e.contact.phone, q(e.group.name), e.byAdmin ? "sim" : "não", e.winbackSent ? "sim" : "não"].join(";"));
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="entradas-e-saidas-${days}-dias.csv"` },
  });
}
