// CSV com quem entrou na automação e o que aconteceu (entregue, leu, clicou, comprou)
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: "login" }, { status: 401 });
  const { id } = await params;
  const p = req.nextUrl.searchParams.get("p") ?? "30";
  const since = p === "tudo" ? new Date(0) : new Date(Date.now() - Number(p) * 864e5);
  const [runs, msgs] = await Promise.all([
    db.automationRun.findMany({ where: { automationId: id, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 50000 }),
    db.autoMsg.findMany({ where: { automationId: id, sentAt: { gte: since } }, select: { runId: true, deliveredAt: true, readAt: true, status: true } }),
  ]);
  const st = new Map<string, { n: number; d: boolean; r: boolean }>();
  for (const m of msgs) { const x = st.get(m.runId) ?? { n: 0, d: false, r: false }; x.n++; x.d ||= !!m.deliveredAt || m.status !== "enviada"; x.r ||= !!m.readAt; st.set(m.runId, x); }
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["nome", "telefone", "entrou_em", "mensagens", "entregue", "leu", "cliques", "comprou", "valor", "status"].join(";")];
  for (const r of runs) {
    const x = st.get(r.id);
    lines.push([r.name, r.phone, r.createdAt.toISOString(), x?.n ?? 0, x?.d ? "sim" : "não", x?.r ? "sim" : "não", r.clicks, r.convertedAt ? "sim" : "não", (r.value ?? 0).toFixed(2).replace(".", ","), r.status].map(esc).join(";"));
  }
  return new NextResponse("﻿" + lines.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="automacao-${id}.csv"` } });
}
