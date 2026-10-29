import Link from "next/link";
import { ArrowRight, Lightbulb, Package, ReceiptText, Target, Wallet } from "lucide-react";
import { DateRange } from "@/components/DateRange";
import { AreaChart, Waterfall } from "@/components/charts";
import { computeMetrics, type Metrics } from "@/lib/report";
import { daysBetween, previousPeriod, resolvePeriod } from "@/lib/periods";
import { productProfits, type ProductProfit } from "@/lib/profit";
import { ordersBetween } from "@/lib/store";
import { brl, dayRange, isoDayLocal, pct } from "@/lib/time";
import { ErrorNote, Header, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

function Delta({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  if (!before) return <span className="dim">sem base</span>;
  const d = (now - before) / Math.abs(before);
  const good = invert ? d <= 0 : d >= 0;
  return <span className={`delta ${good ? "up" : "dn"}`}>{d >= 0 ? "+" : ""}{(d * 100).toFixed(1).replace(".", ",")}%</span>;
}

async function dailyRevenue(from: string, to: string) {
  const orders = await ordersBetween(dayRange(from).start, dayRange(to).end);
  const byDay = new Map<string, number>();
  for (const o of orders) {
    if (o.cancelled) continue;
    const d = isoDayLocal(new Date(o.createdAt));
    byDay.set(d, (byDay.get(d) ?? 0) + o.subtotal);
  }
  return daysBetween(from, to).map((d) => ({ label: `${d.slice(8)}/${d.slice(5, 7)}`, value: byDay.get(d) ?? 0 }));
}

export default async function Financeiro({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string }> }) {
  const { p, de, ate } = await searchParams;
  const period = resolvePeriod(p, "mes", de, ate);
  const prev = previousPeriod(period.from, period.to);
  let m: Metrics | null = null;
  let mp: Metrics | null = null;
  let daily: { label: string; value: number }[] = [];
  let dailyPrev: { label: string; value: number }[] = [];
  let top: ProductProfit[] = [];
  let error: unknown = null;
  try {
    [m, mp, daily, dailyPrev, top] = await Promise.all([
      computeMetrics(period.from, period.to, { monthMode: period.monthMode }),
      computeMetrics(prev.from, prev.to, { monthMode: false }),
      dailyRevenue(period.from, period.to),
      dailyRevenue(prev.from, prev.to),
      productProfits(period.from, period.to),
    ]);
  } catch (e) {
    error = e;
  }
  const fixed = m && period.monthMode ? m.fixedCosts + m.variableCosts : 0;
  const profit = m ? m.profitBeforeFixed - fixed : 0;
  const prevProfit = mp ? mp.profitBeforeFixed : 0;
  const best = top.filter((t) => t.sold > 0).sort((a, b) => (b.profit ?? -1e9) - (a.profit ?? -1e9)).slice(0, 5);
  const bestMax = Math.max(1, ...best.map((b) => b.profit ?? 0));
  const adsShare = m && m.net ? (m.ads ?? 0) / m.net : 0;

  let tip: { tone: "sun" | "coral" | "lagoon"; text: string; href?: string; act?: string } | null = null;
  if (m) {
    if (m.missingCost.length) tip = { tone: "sun", text: `${m.missingCost.length} produto(s) vendidos sem custo cadastrado. Enquanto isso, o lucro aparece maior do que é.`, href: "/custos", act: "Cadastrar custo" };
    else if (adsShare > 0.35) tip = { tone: "coral", text: `Os anúncios levaram ${pct(adsShare, 0)} do faturamento. Acima de 35% o lucro some rápido. Vale cortar o que não vende.`, href: "/campanhas", act: "Ver campanhas" };
    else if (mp && m.aov < mp.aov * 0.92) tip = { tone: "sun", text: `O ticket médio caiu para ${brl(m.aov, 0)} (antes ${brl(mp.aov, 0)}). Um kit ou frete grátis a partir de um valor ajuda a subir.` };
    else if (profit > 0) tip = { tone: "lagoon", text: `Sobrou ${pct(profit / (m.net || 1), 1)} do faturamento. Bom sinal: mantenha o que está funcionando.` };
  }

  const steps = m
    ? ([
        { label: "Faturamento", value: m.net, kind: "total", sub: `${m.orders} pedidos` },
        { label: "Produtos", value: m.cogs, kind: "neg", sub: m.net ? pct(m.cogs / m.net, 0) : undefined },
        { label: "Anúncios", value: m.ads ?? 0, kind: "neg", sub: m.ads != null ? pct(adsShare, 0) : "sem Meta" },
        { label: "Taxas", value: m.taxesFees + m.packaging, kind: "neg", sub: "impostos, cartão, caixa" },
        ...(period.monthMode ? [{ label: "Custos fixos", value: fixed, kind: "neg", sub: "mês inteiro" }] : []),
        { label: period.monthMode ? "Lucro líquido" : "Lucro", value: profit, kind: "result" },
      ] as { label: string; value: number; kind: "total" | "neg" | "result"; sub?: string }[])
    : [];

  return (
    <>
      <Header title="Financeiro" lede="O dinheiro que entrou, para onde foi e quanto sobrou de verdade. No mês, os custos fixos entram sempre inteiros.">
        <DateRange current={period.key} from={period.from} to={period.to} label={period.label} />
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      {m && (
        <>
          <div className="cols c-2-1">
            <div className="pnl" style={{ padding: 26 }}>
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <span className="tile sm t-l"><Wallet size={17} /></span>
                <span className="mut">{period.monthMode ? "Lucro líquido do período" : "Lucro antes dos custos fixos"}</span>
              </div>
              <div className="row" style={{ alignItems: "baseline", gap: 14, margin: "14px 0 6px" }}>
                <span className={`hero-num ${profit < 0 ? "dn" : "up"}`}>{brl(profit, 0)}</span>
                <Delta now={profit} before={prevProfit} />
              </div>
              <div className="dim" style={{ fontSize: 13, marginBottom: 18 }}>
                {m.net ? `${pct(profit / m.net, 1)} do faturamento` : "Sem vendas no período"} · comparado com {prev.days} dia(s) antes
              </div>
              <Waterfall steps={steps} format={(v) => brl(v, 0)} />
            </div>
            <div className="stack">
              <Panel title="Contra o período anterior">
                <div className="kv"><span className="mut">Faturamento</span><span className="row" style={{ gap: 10 }}><span className="v">{brl(m.net, 0)}</span><Delta now={m.net} before={mp?.net ?? 0} /></span></div>
                <div className="kv"><span className="mut">Pedidos</span><span className="row" style={{ gap: 10 }}><span className="v">{m.orders}</span><Delta now={m.orders} before={mp?.orders ?? 0} /></span></div>
                <div className="kv"><span className="mut">Ticket médio</span><span className="row" style={{ gap: 10 }}><span className="v">{brl(m.aov, 0)}</span><Delta now={m.aov} before={mp?.aov ?? 0} /></span></div>
                <div className="kv"><span className="mut">Anúncios</span><span className="row" style={{ gap: 10 }}><span className="v">{m.ads != null ? brl(m.ads, 0) : "–"}</span>{m.ads != null && <Delta now={m.ads} before={mp?.ads ?? 0} invert />}</span></div>
                <div className="kv"><span className="mut">ROAS</span><span className="v">{m.ads ? (m.net / m.ads).toFixed(2).replace(".", ",") : "–"}</span></div>
              </Panel>
              {tip && (
                <div className={`callout ${tip.tone}`}>
                  <Lightbulb size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>{tip.text}</div>
                  {tip.href && <Link className="act" href={tip.href}>{tip.act} <ArrowRight size={14} /></Link>}
                </div>
              )}
            </div>
          </div>

          <Panel title="Faturamento por dia" sub="Linha tracejada: o período anterior, do mesmo tamanho">
            <AreaChart id="fin" data={daily} compare={dailyPrev.map((d) => d.value)} format={(v) => brl(v, 0)} height={240} />
          </Panel>

          <div className="cols c-1-1">
            <Panel title="O que mais deu lucro" right={<Link className="btn sm ghost" href="/produtos">Ver todos <ArrowRight size={14} /></Link>}>
              {best.length ? (
                best.map((b) => (
                  <div className="lrow" key={b.product.id}>
                    {b.product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.product.image} alt="" width={42} height={42} style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <span className="tile t-n"><Package size={17} /></span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.product.title}</div>
                      <div className="s">{b.sold} vendidos · {b.margin != null ? `margem ${pct(b.margin, 0)}` : "sem custo"}</div>
                      <div className="hbar" style={{ marginTop: 8 }}><i style={{ width: `${Math.max(3, ((b.profit ?? 0) / bestMax) * 100)}%` }} /></div>
                    </div>
                    <div className="end"><b className={b.profit != null && b.profit < 0 ? "dn" : "up"}>{b.profit != null ? brl(b.profit, 0) : "–"}</b></div>
                  </div>
                ))
              ) : (
                <div className="empty">Nenhuma venda no período.</div>
              )}
            </Panel>
            <Panel title="Para onde foi cada R$ 100">
              {m.net > 0 ? (
                <>
                  {[
                    ["Produtos", m.cogs, "t-k"],
                    ["Anúncios", m.ads ?? 0, "t-p"],
                    ["Impostos e taxas", m.taxesFees, "t-s"],
                    ["Embalagem", m.packaging, "t-n"],
                    ...(period.monthMode ? [["Custos fixos", fixed, "t-c"]] : []),
                    ["Sobrou para você", Math.max(0, profit), "t-l"],
                  ].map(([l, v, tone]) => (
                    <div className="lrow" key={l as string}>
                      <span className={`tile sm ${tone}`}>{l === "Sobrou para você" ? <Target size={16} /> : <ReceiptText size={16} />}</span>
                      <div style={{ flex: 1 }}>
                        <div className="t">{l}</div>
                        <div className="hbar" style={{ marginTop: 8 }}><i className={tone === "t-l" ? "" : (tone as string).slice(2)} style={{ width: `${Math.min(100, ((v as number) / m!.net) * 100)}%` }} /></div>
                      </div>
                      <div className="end">
                        <b>{brl(((v as number) / m!.net) * 100, 0)}</b>
                        <div className="dim" style={{ fontSize: 12 }}>{brl(v as number, 0)}</div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="empty">Sem faturamento no período.</div>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
