import Link from "next/link";
import { ArrowRight, Coins, Gift, Megaphone, TrendingUp, Wallet } from "lucide-react";
import { Header, Kpi, Panel, BarChart } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { brlc, monthLabel, monthOf, releaseOf } from "@/lib/ledger";
import { fmtDay, partnerArea } from "./data";

export const dynamic = "force-dynamic";

const shortMonth = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");

export default async function Inicio({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const sp = await searchParams;
  const { p, b, prog, pct, link, first } = await partnerArea();
  const now = new Date();
  const cur = monthOf(now);
  const curName = monthLabel(cur).split(" ")[0];
  const nextRelease = releaseOf(cur, prog.releaseDay);
  const tiers = [...prog.tiers].filter((t) => t.minCents > 0).sort((a, b) => a.minCents - b.minCents);
  const reached = [...tiers].reverse().find((t) => b.monthCents >= t.minCents);
  const next = tiers.find((t) => b.monthCents < t.minCents);
  const goal = next ?? tiers[tiers.length - 1];
  const miles = [...prog.milestones].filter((m) => m.minCents > 0).sort((a, b) => a.minCents - b.minCents);
  const mile = miles.find((m) => b.progressCents < m.minCents);
  // acordo com fixo e/ou mínimo garantido: mostra o fixo + comissão (quem não tem, não vê nada disso)
  const fixed = Math.round((p.fixedMonthly ?? 0) * 100), min = Math.round((p.minMonthly ?? 0) * 100);
  const hasFixed = fixed > 0 || min > 0;
  const monthTotal = Math.max(min, fixed + b.monthCents);
  const topUp = monthTotal - (fixed + b.monthCents);
  const deal = hasFixed ? `Seu acordo: ${fixed ? `fixo de ${brlc(fixed)} + ` : ""}${pct.toLocaleString("pt-BR")}% de comissão em cada venda${min ? `, com mínimo garantido de ${brlc(min)} por mês` : ""}.` : `Seu acordo: ${pct.toLocaleString("pt-BR")}% de comissão em cada venda.`;
  const canWithdraw = b.requestedCents === 0 && b.availableCents >= prog.minWithdrawCents;
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15)).toISOString().slice(0, 7));
  const chart = months.map((m) => { const x = b.months.find((y) => y.month === m); return { label: shortMonth(m), value: x ? (x.cents + x.bonusCents) / 100 : 0 }; });

  return (
    <>
      <Header title={`Fala, ${first}`} lede={deal}>
        <Link className="btn pri" href="/parceiro/saques"><Wallet size={15} /> Pedir saque</Link>
      </Header>
      {sp.bemvindo && <div className="ok">Conta criada. Aqui você acompanha sua comissão e pede seus saques.</div>}

      <div className="grid g4">
        <Kpi label="Saldo disponível" value={brlc(Math.max(0, b.availableCents))} sub={b.requestedCents ? `Saque de ${brlc(b.requestedCents)} em análise` : canWithdraw ? "Pronto para sacar" : `Saque a partir de ${brlc(prog.minWithdrawCents)}`} icon={<Wallet size={15} />} tone="k" />
        <Kpi label="A liberar" value={brlc(b.pendingCents)} sub={`Entra no saldo em ${fmtDay(nextRelease)}`} icon={<Coins size={15} />} tone="l" />
        {hasFixed
          ? <Kpi label={`A receber de ${curName}`} value={brlc(monthTotal)} sub={`${fixed ? `Fixo ${brlc(fixed)} + ` : ""}comissão ${brlc(b.monthCents)}${topUp > 0 ? ` + ${brlc(topUp)} até o mínimo` : ""}`} icon={<TrendingUp size={15} />} tone="c" />
          : <Kpi label={`Comissão em ${curName}`} value={brlc(b.monthCents)} sub={reached ? `Meta batida: +${brlc(reached.bonusCents)}` : next ? `Faltam ${brlc(next.minCents - b.monthCents)} para o bônus` : "Siga divulgando"} icon={<TrendingUp size={15} />} tone="c" />}
        <Kpi label="Já recebido" value={brlc(b.paidCents)} sub={`Total ganho: ${brlc(b.lifetimeCents)}`} icon={<Gift size={15} />} tone="p" />
      </div>

      <div className="grid g2">
        <Panel title="Meta do mês" sub={`Bônus entra no saldo em ${fmtDay(nextRelease)}`}>
          {goal ? (
            <div className="stack" style={{ gap: 10 }}>
              <div style={{ fontSize: 15, lineHeight: 1.5 }}>{next ? <>Chegue a <b>{brlc(next.minCents)}</b> de comissão em {curName} e ganhe <b className="pt-g">+{brlc(next.bonusCents)}</b> de bônus.</> : <>Você bateu a maior meta do mês. Bônus de <b className="pt-g">{brlc(reached!.bonusCents)}</b> garantido.</>}</div>
              <div className="pt-bar"><i style={{ width: `${Math.min(100, (b.monthCents / goal.minCents) * 100)}%` }} /></div>
              <div className="dim" style={{ fontSize: 12.5 }}>{brlc(b.monthCents)} de {brlc(goal.minCents)}</div>
            </div>
          ) : <div className="mut">Sem meta de bônus no momento.</div>}
          {mile && (
            <div className="stack" style={{ gap: 10, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <small className="pt-lab">Premiação em dinheiro</small>
              <div style={{ fontSize: 15, lineHeight: 1.5 }}>Ao chegar em <b>{brlc(mile.minCents)}</b> ganhos com a Rasta, você ganha <b className="pt-y">+{brlc(mile.prizeCents)}</b> extra.</div>
              <div className="pt-bar y"><i style={{ width: `${Math.min(100, (b.progressCents / mile.minCents) * 100)}%` }} /></div>
              <div className="dim" style={{ fontSize: 12.5 }}>{brlc(b.progressCents)} de {brlc(mile.minCents)}</div>
            </div>
          )}
        </Panel>
        <Panel title="Seu cupom" sub="Quanto mais você divulgar, mais você ganha" right={<Link className="btn sm" href="/parceiro/divulgar"><Megaphone size={14} /> Divulgar</Link>}>
          <div className="pt-code">{p.code}</div>
          {link && <div className="pt-link"><code>{link}</code><CopyButton text={link} label="Copiar link" className="btn sm pri" /></div>}
          <Link href="/parceiro/divulgar" className="pt-more">Ver como colocar no seu perfil <ArrowRight size={14} /></Link>
        </Panel>
      </div>

      <Panel title="Comissão por mês" sub="Comissão e bônus dos últimos 6 meses">
        <BarChart data={chart} format={(v) => brlc(Math.round(v * 100))} />
      </Panel>
    </>
  );
}
