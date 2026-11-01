import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCheck, Download, Eye, MessageCircle, MousePointerClick, Pencil, Send, ShoppingBag, Users } from "lucide-react";
import { db } from "@/lib/db";
import { brl } from "@/lib/time";
import { Header, Kpi, Panel } from "@/components/ui";
import { blockMeta, triggerLabel, type Flow, type Node } from "@/lib/flowTypes";

export const dynamic = "force-dynamic";

const TZ = "America/Sao_Paulo";
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "0%");
const spHour = (d: Date) => Number(d.toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false })) % 24;
const spDay = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: TZ })).getDay();
const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ });
type Log = { at: string; t: string; n?: string };

export default async function Relatorio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string; f?: string; q?: string; pg?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const a = await db.automation.findUnique({ where: { id } });
  if (!a) notFound();
  const period = sp.p ?? "30";
  const since = period === "tudo" ? new Date(0) : new Date(Date.now() - Number(period) * 864e5);
  const flow = (a.flow ?? {}) as Flow;
  const [runs, msgs, templates] = await Promise.all([
    db.automationRun.findMany({ where: { automationId: id, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 20000, select: { id: true, phone: true, name: true, status: true, clicks: true, convertedAt: true, value: true, createdAt: true, log: true, error: true } }),
    db.autoMsg.findMany({ where: { automationId: id, sentAt: { gte: since } }, select: { runId: true, nodeId: true, phone: true, status: true, sentAt: true, deliveredAt: true, readAt: true }, take: 60000 }),
    db.messageTemplate.findMany({ select: { id: true, name: true } }),
  ]);
  const tplName = new Map(templates.map((t) => [t.id, t.name]));
  const nodeTitle = (nid: string) => {
    const n = flow.nodes?.[nid] as Node | undefined;
    if (!n) return "Bloco apagado";
    if (n.title) return n.title;
    if (n.type === "send") return n.messageId ? tplName.get(n.messageId) ?? "Mensagem" : (n.parts?.find((p) => p.text)?.text ?? "Mensagem").split("\n")[0].slice(0, 50);
    return blockMeta(n.type).label;
  };

  // Respostas: cliente escreveu depois da primeira mensagem da automação
  const firstSent = new Map<string, Date>();
  for (const m of msgs) { const f = firstSent.get(m.runId); if (!f || m.sentAt < f) firstSent.set(m.runId, m.sentAt); }
  const phones = [...new Set(runs.filter((r) => firstSent.has(r.id)).map((r) => r.phone))];
  const inbound = phones.length ? await db.chatMessage.findMany({ where: { phone: { in: phones.slice(0, 5000) }, fromMe: false, createdAt: { gte: since } }, select: { phone: true, createdAt: true } }) : [];
  const repliedRun = new Set<string>();
  const replyTimes: Date[] = [];
  for (const r of runs) {
    const f = firstSent.get(r.id);
    if (!f) continue;
    const hit = inbound.find((m) => m.phone === r.phone && m.createdAt >= f && m.createdAt.getTime() - f.getTime() < 3 * 864e5);
    if (hit) { repliedRun.add(r.id); replyTimes.push(hit.createdAt); }
  }

  const sentRuns = new Set(msgs.map((m) => m.runId));
  const delivRuns = new Set(msgs.filter((m) => m.deliveredAt || m.status !== "enviada").map((m) => m.runId));
  const readRuns = new Set(msgs.filter((m) => m.readAt).map((m) => m.runId));
  const clickRuns = runs.filter((r) => r.clicks > 0);
  const conv = runs.filter((r) => r.convertedAt);
  const revenue = conv.reduce((s, r) => s + (r.value ?? 0), 0);
  const clickTimes: Date[] = [];
  const clicksByNode = new Map<string, number>();
  for (const r of runs) for (const e of (r.log ?? []) as Log[]) if (e.t === "Clique") { clickTimes.push(new Date(e.at)); if (e.n) clicksByNode.set(e.n, (clicksByNode.get(e.n) ?? 0) + 1); }

  const funnel = [
    { k: "Enviados", v: sentRuns.size, icon: <Send size={14} /> },
    { k: "Entregues", v: delivRuns.size, icon: <CheckCheck size={14} /> },
    { k: "Leram", v: readRuns.size, icon: <Eye size={14} /> },
    { k: "Clicaram", v: clickRuns.length, icon: <MousePointerClick size={14} /> },
    { k: "Responderam", v: repliedRun.size, icon: <MessageCircle size={14} /> },
    { k: "Compraram", v: conv.length, icon: <ShoppingBag size={14} /> },
  ];
  const top = Math.max(1, funnel[0].v);

  // Mapa de horário (leituras, cliques e respostas)
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const d of [...msgs.filter((m) => m.readAt).map((m) => m.readAt!), ...clickTimes, ...replyTimes]) heat[spDay(d)][spHour(d)]++;
  const heatMax = Math.max(1, ...heat.flat());

  // Por dia
  const days: string[] = [];
  const nDays = period === "tudo" ? 60 : Math.min(90, Number(period));
  for (let i = nDays - 1; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 864e5)));
  const per = new Map(days.map((d) => [d, { sent: 0, read: 0, clicks: 0, conv: 0 }]));
  for (const m of msgs) { const x = per.get(dayKey(m.sentAt)); if (x) { x.sent++; if (m.readAt) x.read++; } }
  for (const t of clickTimes) { const x = per.get(dayKey(t)); if (x) x.clicks++; }
  for (const r of conv) { const x = per.get(dayKey(r.convertedAt!)); if (x) x.conv++; }
  const dayMax = Math.max(1, ...[...per.values()].map((x) => x.sent));

  // Por bloco
  const byNode = new Map<string, { sent: number; deliv: number; read: number }>();
  for (const m of msgs) { const x = byNode.get(m.nodeId) ?? { sent: 0, deliv: 0, read: 0 }; x.sent++; if (m.deliveredAt || m.status !== "enviada") x.deliv++; if (m.readAt) x.read++; byNode.set(m.nodeId, x); }

  // Destinatários
  const f = sp.f ?? "todos";
  const q = (sp.q ?? "").toLowerCase().replace(/\D/g, "") || (sp.q ?? "").toLowerCase();
  const filters: Record<string, (r: (typeof runs)[number]) => boolean> = {
    todos: () => true, entregues: (r) => delivRuns.has(r.id), leram: (r) => readRuns.has(r.id), clicaram: (r) => r.clicks > 0, responderam: (r) => repliedRun.has(r.id), compraram: (r) => !!r.convertedAt, erro: (r) => r.status === "erro",
  };
  const rows = runs.filter((r) => (filters[f] ?? filters.todos)(r) && (!q || `${r.name ?? ""} ${r.phone}`.toLowerCase().includes(q)));
  const pg = Math.max(1, Number(sp.pg) || 1);
  const pageRows = rows.slice((pg - 1) * 30, pg * 30);
  const msgsByRun = new Map<string, typeof msgs>();
  for (const m of msgs) msgsByRun.set(m.runId, [...(msgsByRun.get(m.runId) ?? []), m]);
  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ p: sp.p, f: sp.f, q: sp.q, ...o })) if (v) p.set(k, v);
    return `/automacoes/${id}/relatorio?${p}`;
  };
  const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Header title={a.name} lede={`Relatório da automação · ${triggerLabel(a.trigger)} · ${a.active ? "ligada" : "desligada"}`}>
        <Link className="btn" href="/automacoes"><ArrowLeft size={15} /> Automações</Link>
        <a className="btn" href={`/api/automacoes/${id}/export?p=${period}`}><Download size={15} /> Exportar</a>
        <Link className="btn pri" href={`/automacoes/${id}`}><Pencil size={15} /> Editar fluxo</Link>
      </Header>
      <div className="chips" style={{ alignSelf: "flex-start" }}>
        {[["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["tudo", "Tudo"]].map(([k, l]) => <Link key={k} className={period === k ? "on" : ""} href={href({ p: k, pg: undefined })}>{l}</Link>)}
      </div>

      <div className="grid g4">
        <Kpi label="Entraram" value={runs.length.toLocaleString("pt-BR")} sub={`${runs.filter((r) => r.status === "ativo").length} no meio do fluxo agora`} icon={<Users size={15} />} tone="k" />
        <Kpi label="Mensagens enviadas" value={msgs.length.toLocaleString("pt-BR")} sub={`${sentRuns.size} pessoas alcançadas`} icon={<Send size={15} />} tone="l" />
        <Kpi label="Taxa de leitura" value={pct(readRuns.size, sentRuns.size)} sub={`${pct(delivRuns.size, sentRuns.size)} entregues`} icon={<Eye size={15} />} tone="s" />
        <Kpi label="Receita gerada" value={brl(revenue, 0)} sub={`${conv.length} vendas · ${pct(conv.length, sentRuns.size)} de conversão · ticket ${brl(conv.length ? revenue / conv.length : 0, 0)}`} icon={<ShoppingBag size={15} />} tone="l" />
      </div>

      <Panel title="Funil" sub="Do envio até a compra. Entregue e lido vêm direto do WhatsApp.">
        <div className="rp-funnel">
          {funnel.map((s, i) => (
            <div key={s.k} className="rp-step">
              <div className="rp-k">{s.icon} {s.k}</div>
              <b>{s.v.toLocaleString("pt-BR")}</b>
              <small>{pct(s.v, top)}{i > 0 && funnel[i - 1].v ? ` · ${pct(s.v, funnel[i - 1].v)} da etapa anterior` : ""}</small>
              <div className="rp-bar"><i style={{ height: `${Math.max(3, (s.v / top) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="cols" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)" }}>
        <Panel title="Por dia" sub="Envios (barra), leituras, cliques e vendas">
          <div className="rp-days">
            {[...per.entries()].map(([d, x]) => (
              <div key={d} className="rp-day" title={`${d.split("-").reverse().slice(0, 2).join("/")}: ${x.sent} envios, ${x.read} leituras, ${x.clicks} cliques, ${x.conv} vendas`}>
                <i style={{ height: `${(x.sent / dayMax) * 100}%` }} />
                <em style={{ height: `${(x.read / dayMax) * 100}%` }} />
                {x.conv > 0 && <span className="rp-conv">{x.conv}</span>}
              </div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: "space-between", fontSize: 11.5, color: "var(--ink3)", marginTop: 6 }}><span>{days[0].split("-").reverse().slice(0, 2).join("/")}</span><span className="row" style={{ gap: 10 }}><span><i className="lg l1" /> envios</span><span><i className="lg l2" /> leituras</span><span><i className="lg l3" /> vendas</span></span><span>hoje</span></div>
        </Panel>
        <Panel title="Engajamento por horário" sub="Leituras, cliques e respostas por dia da semana e hora">
          <div className="rp-heat">
            {heat.map((row, d) => (
              <div key={d} className="rp-hrow"><span>{DAYS[d]}</span>{row.map((v, h) => <i key={h} title={`${DAYS[d]} ${h}h: ${v}`} style={{ opacity: v ? 0.18 + (v / heatMax) * 0.82 : 0.06 }} />)}</div>
            ))}
            <div className="rp-hrow rp-hours"><span />{Array.from({ length: 24 }, (_, h) => <i key={h}>{h % 3 === 0 ? h : ""}</i>)}</div>
          </div>
        </Panel>
      </div>

      <Panel title="Por mensagem" sub="Como cada bloco de envio está indo" body={false}>
        <table className="tb">
          <thead><tr><th>Mensagem</th><th className="r">Envios</th><th className="r">Entregues</th><th className="r">Lidas</th><th className="r">Cliques</th></tr></thead>
          <tbody>
            {[...byNode.entries()].sort((x, y) => y[1].sent - x[1].sent).map(([nid, x]) => (
              <tr key={nid}><td><b>{nodeTitle(nid)}</b></td><td className="r">{x.sent}</td><td className="r">{x.deliv} <small className="dim">{pct(x.deliv, x.sent)}</small></td><td className="r">{x.read} <small className="dim">{pct(x.read, x.sent)}</small></td><td className="r">{clicksByNode.get(nid) ?? 0}</td></tr>
            ))}
            {!byNode.size && <tr><td colSpan={5} className="empty">Nenhuma mensagem enviada nesse período.</td></tr>}
          </tbody>
        </table>
      </Panel>

      <Panel title="Pessoas" sub="Quem entrou na automação e o que aconteceu com cada uma" right={
        <form action={`/automacoes/${id}/relatorio`} className="row" style={{ gap: 6 }}>
          <input type="hidden" name="p" value={period} /><input type="hidden" name="f" value={f} />
          <input className="in" name="q" defaultValue={sp.q ?? ""} placeholder="Nome ou telefone" style={{ height: 34, width: 200 }} />
        </form>
      } body={false}>
        <div className="chips" style={{ margin: "0 18px 12px", alignSelf: "flex-start" }}>
          {[["todos", "Todos", runs.length], ["entregues", "Entregues", delivRuns.size], ["leram", "Leram", readRuns.size], ["clicaram", "Clicaram", clickRuns.length], ["responderam", "Responderam", repliedRun.size], ["compraram", "Compraram", conv.length], ["erro", "Com erro", runs.filter((r) => r.status === "erro").length]].map(([k, l, n]) => (
            <Link key={k as string} className={f === k ? "on" : ""} href={href({ f: k as string, pg: undefined })}>{l}<b>{n}</b></Link>
          ))}
        </div>
        <div className="rp-people">
          {pageRows.map((r) => {
            const ms = (msgsByRun.get(r.id) ?? []).sort((x, y) => x.sentAt.getTime() - y.sentAt.getTime());
            const events = [{ at: r.createdAt, t: "Entrou na automação" }, ...((r.log ?? []) as Log[]).filter((e) => e.t !== "Mensagem enviada").map((e) => ({ at: new Date(e.at), t: e.n && e.t !== "Clique" ? `${e.t} · ${nodeTitle(e.n)}` : e.t === "Clique" && e.n ? `Clicou no link · ${nodeTitle(e.n)}` : e.t })), ...ms.flatMap((m) => [{ at: m.sentAt, t: `Enviada: ${nodeTitle(m.nodeId)}` }, ...(m.deliveredAt ? [{ at: m.deliveredAt, t: "Entregue" }] : []), ...(m.readAt ? [{ at: m.readAt, t: "Lida" }] : [])])].sort((x, y) => x.at.getTime() - y.at.getTime());
            return (
              <details key={r.id} className="rp-person">
                <summary>
                  <span className="rp-av">{(r.name ?? "?").replace(/[^\p{L}\s]/gu, "").split(" ").filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "•"}</span>
                  <span className="rp-who"><b>{r.name || "Sem nome"}</b><small>{r.phone}</small></span>
                  <span className="rp-tags">
                    {readRuns.has(r.id) ? <span className="chip c-k">leu</span> : delivRuns.has(r.id) ? <span className="chip c-n">entregue</span> : sentRuns.has(r.id) ? <span className="chip c-n">enviada</span> : null}
                    {r.clicks > 0 && <span className="chip c-s">clicou</span>}
                    {repliedRun.has(r.id) && <span className="chip c-l">respondeu</span>}
                    {r.convertedAt && <span className="chip c-l">comprou {brl(r.value ?? 0, 0)}</span>}
                    {r.status === "erro" && <span className="chip c-c" title={r.error ?? ""}>erro</span>}
                    {r.status === "ativo" && <span className="chip c-n">no meio</span>}
                  </span>
                  <span className="dim" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmt(r.createdAt)}</span>
                </summary>
                <ol className="rp-tl">
                  {events.map((e, i) => <li key={i}><span>{fmt(e.at)}</span>{e.t}</li>)}
                  {r.error && <li className="bad"><span>erro</span>{r.error}</li>}
                </ol>
              </details>
            );
          })}
          {!pageRows.length && <div className="empty">Ninguém por aqui.</div>}
        </div>
        {rows.length > 30 && (
          <div className="row" style={{ justifyContent: "space-between", padding: "10px 18px 16px", fontSize: 12.5 }}>
            <span className="dim">{(pg - 1) * 30 + 1} a {Math.min(rows.length, pg * 30)} de {rows.length}</span>
            <span className="row" style={{ gap: 6 }}>
              {pg > 1 && <Link className="btn sm" href={href({ pg: String(pg - 1) })}>Anterior</Link>}
              {pg * 30 < rows.length && <Link className="btn sm" href={href({ pg: String(pg + 1) })}>Próxima</Link>}
            </span>
          </div>
        )}
      </Panel>
    </>
  );
}
