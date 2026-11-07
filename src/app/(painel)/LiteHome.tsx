// Visão geral do Hub simples (outra empresa): comunidade no WhatsApp + gasto no Meta Ads
import Link from "next/link";
import { LogIn, LogOut, Megaphone, Send, Target, Users, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { Header, Kpi, Panel, BarChart } from "@/components/ui";
import { DateRange } from "@/components/DateRange";
import { resolvePeriod } from "@/lib/periods";
import { addDays, brl, dayRange, isoDayLocal } from "@/lib/time";
import { metaCampaigns } from "@/lib/meta";
import { creds } from "@/lib/integrations";

const n = (v: number) => v.toLocaleString("pt-BR");

export async function LiteHome({ sp }: { sp: { p?: string; de?: string; ate?: string } }) {
  const period = resolvePeriod(sp.p, "7d", sp.de, sp.ate);
  const start = dayRange(period.from).start;
  const end = dayRange(period.to).end;
  const inComm = { group: { isCommunity: true } };
  const [members, joins, leaves, leads, scheduled, bcSent, joinEv, c] = await Promise.all([
    db.membership.count({ where: { leftAt: null, ...inComm } }),
    db.memberEvent.count({ where: { type: "JOIN", createdAt: { gte: start, lte: end }, ...inComm } }),
    db.memberEvent.count({ where: { type: "LEAVE", createdAt: { gte: start, lte: end }, ...inComm } }),
    db.lead.count({ where: { createdAt: { gte: start, lte: end } } }),
    db.scheduledMessage.count({ where: { status: "SENT", sendAt: { gte: start, lte: end } } }),
    db.broadcastRecipient.count({ where: { status: "enviado", sentAt: { gte: start, lte: end } } }),
    db.memberEvent.findMany({ where: { type: "JOIN", createdAt: { gte: start, lte: end }, ...inComm }, select: { createdAt: true } }),
    creds(),
  ]);
  const metaOn = !!(c.meta.token && c.meta.adAccount);
  const camps = metaOn ? await metaCampaigns(period.from, period.to).catch(() => null) : null;
  const spend = camps ? camps.reduce((a, x) => a + x.spend, 0) : null;
  const clicks = camps ? camps.reduce((a, x) => a + x.clicks, 0) : 0;
  const perJoin = spend != null && joins > 0 ? spend / joins : null;

  // entradas por dia no período
  const days: string[] = [];
  for (let d = period.from; d <= period.to && days.length < 92; d = addDays(d, 1)) days.push(d);
  const byDay = new Map<string, number>();
  for (const e of joinEv) { const k = isoDayLocal(e.createdAt); byDay.set(k, (byDay.get(k) ?? 0) + 1); }
  const chart = days.map((d) => ({ label: d.slice(8, 10) + "/" + d.slice(5, 7), value: byDay.get(d) ?? 0 }));

  return (
    <>
      <Header title="Visão geral" lede="Como está a comunidade no WhatsApp e quanto foi investido em anúncios.">
        <DateRange current={period.key} from={period.from} to={period.to} label={period.label} presets={["hoje", "ontem", "7d", "30d", "mes", "mes-passado"]} />
      </Header>
      <div className="grid g4">
        <Kpi label="Pessoas na comunidade" value={n(members)} sub="hoje, nos grupos que o Hub cuida" icon={<Users size={15} />} tone="l" />
        <Kpi label="Entraram" value={n(joins)} sub={`saíram ${n(leaves)} · saldo ${joins - leaves >= 0 ? "+" : ""}${n(joins - leaves)}`} icon={<LogIn size={15} />} tone="c" />
        <Kpi label="Gasto no Meta Ads" value={spend != null ? brl(spend) : "-"} sub={metaOn ? `${n(clicks)} cliques` : "conecte em Integrações"} icon={<Wallet size={15} />} tone="k" />
        <Kpi label="Custo por pessoa que entrou" value={perJoin != null ? brl(perJoin) : "-"} sub="gasto dividido pelas entradas" icon={<Target size={15} />} tone="p" />
      </div>
      <div className="grid g4">
        <Kpi label="Saíram" value={n(leaves)} icon={<LogOut size={15} />} tone="n" />
        <Kpi label="Leads novos" value={n(leads)} sub="números coletados" icon={<Users size={15} />} tone="n" />
        <Kpi label="Mensagens nos grupos" value={n(scheduled)} sub="agendamentos enviados" icon={<Megaphone size={15} />} tone="n" />
        <Kpi label="Disparos no privado" value={n(bcSent)} sub="mensagens entregues" icon={<Send size={15} />} tone="n" />
      </div>
      <Panel title="Entradas por dia" sub="Pessoas que entraram nos grupos da comunidade">
        <BarChart data={chart} format={(v) => n(v)} />
      </Panel>
      <Panel title="Campanhas no Meta Ads" sub={metaOn ? "Gasto e cliques no período" : "Ainda não conectado"} body={!camps?.length}>
        {!metaOn ? (
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span className="mut">Conecte a conta de anúncios para ver o gasto aqui.</span>
            <Link className="btn pri" href="/integracoes?abrir=meta">Conectar Meta Ads</Link>
          </div>
        ) : camps?.length ? (
          <table className="tb">
            <thead><tr><th>Campanha</th><th>Gasto</th><th>Cliques</th><th>Custo por clique</th></tr></thead>
            <tbody>
              {[...camps].sort((a, b) => b.spend - a.spend).map((x) => (
                <tr key={x.id}><td>{x.name}</td><td>{brl(x.spend)}</td><td>{n(x.clicks)}</td><td>{x.clicks ? brl(x.spend / x.clicks) : "-"}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <div className="mut">Nenhuma campanha com gasto no período.</div>}
      </Panel>
    </>
  );
}
