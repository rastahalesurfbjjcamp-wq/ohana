import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { brl } from "@/lib/time";
import type { Flow, Part } from "@/lib/flowTypes";
import { Canvas } from "./Canvas";

export const dynamic = "force-dynamic";

export default async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await db.automation.findUnique({ where: { id } });
  if (!a) notFound();
  const fl = (a.flow ?? {}) as Partial<Flow>;
  const flow: Flow = { start: fl.start, startPos: fl.startPos, nodes: fl.nodes ?? {} };
  const cfg = (a.config ?? {}) as { delayMin?: number; listId?: string; stopOnPaid?: boolean };
  const [templates, autos, users, groups] = await Promise.all([
    db.messageTemplate.findMany({ orderBy: [{ folder: "asc" }, { name: "asc" }] }),
    db.automation.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ select: { name: true } }).catch(() => [] as { name: string }[]),
    db.group.findMany({ where: { OR: [{ isResults: true }, { name: { contains: "equipe", mode: "insensitive" } }, { name: { contains: "teste", mode: "insensitive" } }] }, select: { jid: true, name: true } }),
  ]);
  const [lists, agg, clicked, recent, logs] = await Promise.all([
    db.contactList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.automationRun.aggregate({ where: { automationId: id }, _count: true, _sum: { sent: true, value: true } }),
    db.automationRun.count({ where: { automationId: id, clicks: { gt: 0 } } }),
    db.automationRun.findMany({ where: { automationId: id }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.automationRun.findMany({ where: { automationId: id }, orderBy: { createdAt: "desc" }, take: 3000, select: { log: true } }),
  ]);
  // Envios, cliques e respostas por bloco (a partir do histórico de cada pessoa)
  const stats: Record<string, { sent: number; clicks: number; replied: number }> = {};
  for (const r of logs)
    for (const e of (r.log ?? []) as { t: string; n?: string }[]) {
      if (!e.n) continue;
      const s = (stats[e.n] ??= { sent: 0, clicks: 0, replied: 0 });
      if (e.t === "Mensagem enviada") s.sent++;
      else if (e.t === "Clique") s.clicks++;
      else if (e.t === "Respondeu") s.replied++;
    }
  const people = recent.map((r) => ({ id: r.id, name: r.name || r.phone, status: r.convertedAt ? "converteu" : r.status === "ativo" ? "no meio" : r.status === "erro" ? "erro" : "terminou" }));
  return (
    <Canvas
      id={a.id}
      active={a.active}
      meta={{ name: a.name, trigger: a.trigger, config: cfg }}
      flow={flow}
      lists={lists}
      stats={stats}
      people={people}
      templates={templates.map((t) => ({ id: t.id, name: t.name, folder: t.folder, kind: t.kind, parts: (t.parts ?? []) as Part[] }))}
      automations={autos}
      users={users.map((u) => u.name).filter(Boolean)}
      groups={groups.map((g) => ({ id: g.jid, name: g.name }))}
      totals={{ entered: agg._count, sent: agg._sum.sent ?? 0, clickPct: agg._count ? Math.round((clicked / agg._count) * 100) : 0, value: `${brl(agg._sum.value ?? 0, 0)} em conversão` }}
    />
  );
}
