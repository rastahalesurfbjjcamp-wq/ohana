import Link from "next/link";
import { AtSign, Flag, Plus, Radio, Rocket, X } from "lucide-react";
import { db } from "@/lib/db";
import { ordersBetween } from "@/lib/store";
import { addDays, brl, isoDayLocal } from "@/lib/time";
import { Header, Panel } from "@/components/ui";
import { GoalBars } from "@/components/charts";
import { Countdown } from "@/components/Countdown";
import { ConfirmButton } from "@/components/ConfirmButton";
import { DateTimeField, GroupPicker } from "@/components/fields";
import { NumberInput } from "@/components/NumberInput";
import { createLaunch, goLive } from "../acoes3";

export const dynamic = "force-dynamic";

const STEPS: [string, string, string][] = [
  ["warm7", "7 dias antes", "Pessoal, daqui a 7 dias chega o {drop}. Só quem está aqui no grupo vai ver primeiro."],
  ["warm3", "3 dias antes", "Faltam 3 dias para o {drop}. Já escolheu o seu tamanho?"],
  ["warm1", "1 dia antes", "Amanhã abre o {drop}. Ativa as notificações do grupo para não perder."],
  ["h1", "1 hora antes", "Em 1 hora o {drop} abre aqui primeiro. Fica de olho!"],
  ["open", "Na abertura", "ABRIU! O {drop} está liberado para o grupo: https://rastahale.com.br"],
  ["last", "1 dia depois", "Últimas peças do {drop} em alguns tamanhos. Corre que está acabando."],
];
const tz = "America/Sao_Paulo";
const dm = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" });

export default async function Lancamento({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; id?: string; novo?: string; live?: string }> }) {
  const sp = await searchParams;
  const [launches, groups] = await Promise.all([
    db.launch.findMany({ orderBy: { opensAt: "desc" }, take: 20 }),
    db.group.findMany({ where: { archived: false, isCommunity: true }, orderBy: { name: "asc" } }),
  ]);
  const upcoming = [...launches].filter((l) => (l.closesAt ?? new Date(l.opensAt.getTime() + 3 * 864e5)) > new Date()).sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime())[0];
  const cur = launches.find((l) => l.id === sp.id) ?? upcoming ?? launches[0];
  const showForm = !!sp.novo || !launches.length;

  let body = null;
  if (cur) {
    const msgs = await db.scheduledMessage.findMany({ where: { launchId: cur.id }, orderBy: { sendAt: "asc" } });
    const jids = cur.groupJids;
    const gs = await db.group.findMany({ where: { jid: { in: jids } } });
    const start = cur.createdAt;
    const joins = await db.memberEvent.findMany({ where: { type: { in: ["JOIN", "RETURN"] }, createdAt: { gte: start }, groupId: { in: gs.map((g) => g.id) } }, select: { createdAt: true } });
    const members = gs.reduce((a, g) => a + g.size, 0);
    const goal = cur.goal ?? 0;
    const progress = goal ? Math.min(1, members / goal) : 0;
    const open = cur.opensAt;
    const close = cur.closesAt ?? new Date(open.getTime() + 2 * 864e5);
    const now = new Date();
    const phases = [
      { k: "cap", t: "Captação", from: start, to: new Date(open.getTime() - 7 * 864e5), d: "Anúncios e página do Grupo VIP" },
      { k: "aq", t: "Aquecimento", from: new Date(open.getTime() - 7 * 864e5), to: new Date(open.getTime() - 864e5), d: "Bastidores, peças e atletas" },
      { k: "lem", t: "Lembretes", from: new Date(open.getTime() - 864e5), to: open, d: "Véspera e 1 hora antes" },
      { k: "live", t: "Abertura", from: open, to: new Date(open.getTime() + 3 * 36e5), d: "Link para os grupos" },
      { k: "cart", t: "Carrinho aberto", from: new Date(open.getTime() + 3 * 36e5), to: close, d: "Peças exclusivas do grupo" },
      { k: "last", t: "Última chamada", from: close, to: new Date(close.getTime() + 864e5), d: "Encerramento do lote" },
    ].map((p) => ({ ...p, msgs: msgs.filter((m) => m.sendAt >= p.from && m.sendAt < p.to).length, state: now >= p.to ? "done" : now >= p.from ? "now" : "next" }));
    const today = isoDayLocal();
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const perDay = days.map((d) => ({ label: `${d.slice(8)}/${d.slice(5, 7)}`, value: joins.filter((j) => isoDayLocal(j.createdAt) === d).length }));
    const daysLeft = Math.max(1, Math.ceil((open.getTime() - Date.now()) / 864e5));
    const dailyGoal = goal ? Math.max(1, Math.ceil(Math.max(0, goal - members) / daysLeft)) : Math.max(1, Math.round(perDay.reduce((a, x) => a + x.value, 0) / 14));
    let sales: { n: number; v: number } | null = null;
    if (open <= now) {
      try {
        const orders = await ordersBetween(open, close < now ? close : now);
        let n = 0, v = 0;
        for (const o of orders) if (!o.cancelled) for (const li of o.lines) if (!cur.productKey || li.title.toLowerCase().includes(cur.productKey)) { n += li.quantity; v += li.revenue; }
        sales = { n, v };
      } catch { sales = null; }
    }
    const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" });
    const fmtH = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });

    body = (
      <>
        <div className="cols c-3-1">
          <section className="pnl" style={{ padding: 24 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="row" style={{ gap: 16, alignItems: "baseline" }}>
                <span className="hero-num">{members.toLocaleString("pt-BR")}</span>
                <div className="mut" style={{ fontSize: 14, lineHeight: 1.5 }}>pessoas nos grupos do lançamento<br />{goal ? <>A meta é <b style={{ color: "#fff" }}>{goal.toLocaleString("pt-BR")}</b> até {fmt.format(open)}</> : "Sem meta definida"}</div>
              </div>
              {sales ? (
                <div style={{ textAlign: "right" }}><div className="mid-num up" style={{ fontSize: 28 }}>{brl(sales.v, 0)}</div><small className="dim">{sales.n} peças vendidas desde a abertura</small></div>
              ) : (
                <div style={{ textAlign: "right" }}><div className="mid-num" style={{ fontSize: 28 }}>+{joins.length.toLocaleString("pt-BR")}</div><small className="dim">entraram desde {fmt.format(start)}</small></div>
              )}
            </div>
            {goal > 0 && (
              <div style={{ margin: "22px 0 6px" }}>
                <div className="lprog"><i style={{ width: `${progress * 100}%` }} /><span style={{ left: `${progress * 100}%` }} /></div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12, marginTop: 6 }}><span className="dim">{fmt.format(start)}</span><span className="dim">{Math.round(progress * 100)}% da meta</span><span className="dim">{fmt.format(open)}</span></div>
              </div>
            )}
            <div className="ltime">
              {phases.map((p) => (
                <div key={p.k} className={`lph ${p.state}`}>
                  <span className="dot" />
                  <b>{p.t}</b>
                  <small>{dm(p.from)}{p.k === "live" ? `, ${fmtH.format(open)}` : ` a ${dm(p.to)}`}</small>
                  <p>{p.d}</p>
                  <span className={`chip ${p.state === "now" ? "c-l" : "c-n"}`}>{p.state === "now" ? "agora" : `${p.msgs} msg${p.msgs === 1 ? "" : "s"}`}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="pnl" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{open > now ? "Faltam" : "Abriu há"}</h3>
            {open > now ? <Countdown to={open.toISOString()} /> : <div className="mid-num">{Math.floor((now.getTime() - open.getTime()) / 864e5)} dias</div>}
            <div className="kv" style={{ marginTop: 10 }}><span className="mut">Mensagens programadas</span><b>{msgs.filter((m) => m.status === "SCHEDULED").length}</b></div>
            <div className="kv"><span className="mut">Grupos do lançamento</span><b>{jids.length}</b></div>
            <div className="kv"><span className="mut">Marca todos em cada envio</span><b className="up">sim</b></div>
            <div className="live-box">
              <b>Botão &quot;Estamos ao vivo&quot;</b>
              <p>Na hora, um toque manda o link {cur.liveUrl ? "da live" : "do drop"} para os {jids.length} grupos, marcando todo mundo.</p>
              <form action={goLive}>
                <input type="hidden" name="id" value={cur.id} />
                <input type="hidden" name="text" value={`Estamos ao vivo! O ${cur.name} começou agora. ${cur.liveUrl ?? ""}`.trim()} />
                <ConfirmButton className="btn live-btn" message={`Mandar agora para os ${jids.length} grupos, marcando todos?`}><Radio size={16} /> Estamos ao vivo</ConfirmButton>
              </form>
            </div>
          </section>
        </div>
        <div className="cols c-1-1">
          <Panel title="Captação por dia" sub="Entradas nos grupos do lançamento, últimos 14 dias" right={<span className="chip c-s"><Flag size={12} /> Meta {dailyGoal} por dia</span>}>
            <GoalBars items={perDay} goal={dailyGoal} format={(v) => String(Math.round(v))} />
          </Panel>
          <Panel title="Mensagens do lançamento" sub="Todas com marcação de todos os membros" right={<Link className="btn sm ghost" href="/agendamentos">Ver na agenda</Link>}>
            {msgs.slice(0, 8).map((m) => (
              <div className="lrow" key={m.id}>
                <div style={{ width: 64, flexShrink: 0 }}><b style={{ fontSize: 13 }}>{fmt.format(m.sendAt)}</b><div className="dim" style={{ fontSize: 12 }}>{fmtH.format(m.sendAt)}</div></div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>{m.text.length > 110 ? `${m.text.slice(0, 110)}…` : m.text}</div>
                <span className={`chip ${m.status === "SENT" ? "c-l" : m.status === "FAILED" ? "c-c" : "c-s"}`}>{m.status === "SENT" ? "enviada" : m.status === "FAILED" ? "falhou" : <><AtSign size={11} /> todos</>}</span>
              </div>
            ))}
            {!msgs.length && <div className="empty">Nenhuma mensagem neste lançamento.</div>}
          </Panel>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={cur && !showForm ? cur.name : "Lançamento"} lede={cur && !showForm ? (cur.about ?? `Abre em ${cur.opensAt.toLocaleString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}, só para quem está nos grupos.`) : "Monte o drop uma vez: o Hub agenda o aquecimento nos grupos e mostra a captação e as vendas."}>
        {launches.length > 1 && <div className="seg">{launches.slice(0, 4).map((l) => <Link key={l.id} href={`/lancamento?id=${l.id}`} className={cur?.id === l.id && !showForm ? "on" : ""}>{l.name.slice(0, 18)}</Link>)}</div>}
        <Link className="btn pri" href={showForm && launches.length ? "/lancamento" : "/lancamento?novo=1"}><Plus size={16} /> Novo lançamento</Link>
      </Header>
      {sp.ok && <div className="ok">Lançamento criado e mensagens agendadas. Elas aparecem também em Agendamentos.</div>}
      {sp.live && <div className="ok">Mensagem de ao vivo enviada para os grupos.</div>}
      {sp.erro && <div className="err">Preencha nome, data de abertura e escolha os grupos.</div>}
      {showForm && (
        <Panel title="Novo lançamento" right={launches.length ? <Link className="menu-b" href="/lancamento"><X size={16} /></Link> : undefined}>
          <form action={createLaunch} className="stack">
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 1, minWidth: 220 }}><label>Nome do drop</label><input className="in" name="name" required placeholder="King of the Backyard Trials" /></div>
              <div className="field" style={{ minWidth: 280 }}><label>Abre em</label><DateTimeField name="opensAt" /></div>
              <div className="field"><label>Meta de pessoas no grupo</label><NumberInput name="goal" step={100} placeholder="3000" width={190} /></div>
            </div>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Link da live ou da coleção</label><input className="in" name="liveUrl" placeholder="https://..." /></div>
              <div className="field" style={{ width: 220 }}><label>Palavra do produto (vendas)</label><input className="in" name="productKey" placeholder="kotb" /></div>
            </div>
            <div className="field"><label>Frase do lançamento</label><input className="in" name="about" placeholder="Live shop com as peças exclusivas liberadas só para o Grupo VIP" /></div>
            <div className="field"><label>Grupos</label><GroupPicker name="groups" groups={groups.map((g) => ({ jid: g.jid, name: g.name, size: g.size, checked: true }))} /></div>
            <div className="g2f">
              {STEPS.map(([k, label, text]) => (
                <div className="field" key={k}><label>{label}</label><textarea className="in" name={`msg_${k}`} defaultValue={text} style={{ minHeight: 70 }} /></div>
              ))}
            </div>
            <span className="hint">{"{drop}"} vira o nome do drop. Deixe uma mensagem vazia para pular. Todas marcam todos do grupo.</span>
            <div><button className="btn pri" type="submit"><Rocket size={15} /> Criar lançamento</button></div>
          </form>
        </Panel>
      )}
      {!showForm && body}
    </>
  );
}
