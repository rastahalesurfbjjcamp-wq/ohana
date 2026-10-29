// Exporta os pedidos do período em planilha (CSV). Só para quem está logado.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ordersBetween } from "@/lib/store";
import { addDays, dayRange, isoDayLocal } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await getSession())) return new NextResponse("Entre no painel primeiro", { status: 401 });
  const dias = Math.min(90, Number(req.nextUrl.searchParams.get("dias") ?? 30) || 30);
  const today = isoDayLocal();
  const orders = await ordersBetween(dayRange(addDays(today, -(dias - 1))).start, dayRange(today).end);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const q = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const lines = [["Pedido", "Data", "Cliente", "Telefone", "E-mail", "Cidade", "UF", "Itens", "Pagamento", "Status pagamento", "Envio", "Rastreio", "Subtotal", "Total", "Cancelado"].join(";")];
  for (const o of orders) lines.push([o.name, fmt.format(new Date(o.createdAt)), q(o.customer), q(o.phone), q(o.email), q(o.city), o.state ?? "", q(o.lines.map((l) => `${l.quantity}x ${l.title}${l.variant ? ` (${l.variant})` : ""}`).join(", ")), q(o.gateway), o.financial, o.shipStatus ?? o.fulfillment, o.tracking?.number ?? "", num(o.subtotal), num(o.total), o.cancelled ? "sim" : "não"].join(";"));
  return new NextResponse("﻿" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pedidos-${dias}-dias.csv"` } });
}
