// Exporta os leads em planilha (CSV). Só para quem está logado.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return new NextResponse("Entre no painel primeiro", { status: 401 });
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" } });
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const q = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Captado", "Nome", "WhatsApp", "E-mail", "Aniversário", "Origem", "utm_source", "utm_medium", "utm_campaign", "Status"].join(";")];
  for (const l of leads) lines.push([fmt.format(l.createdAt), q(l.name), l.phone, q(l.email), q(l.birthday), q(l.source), q(l.utmSource), q(l.utmMedium), q(l.utmCampaign), l.status].join(";"));
  return new NextResponse("﻿" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="leads.csv"' } });
}
