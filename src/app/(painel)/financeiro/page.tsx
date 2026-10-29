import { computeMetrics, type Metrics } from "@/lib/report";
import { daysBetween, resolvePeriod } from "@/lib/periods";
import { ordersBetween } from "@/lib/store";
import { brl, dayRange, isoDayLocal, pct } from "@/lib/time";
import { BarChart, ErrorNote, Header, Kpi, Panel, PeriodTabs } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Financeiro({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const period = resolvePeriod(p, "mes");
  let m: Metrics | null = null;
  let daily: { label: string; value: number }[] = [];
  let error: unknown = null;
  try {
    m = await computeMetrics(period.from, period.to, { monthMode: period.monthMode });
    const orders = await ordersBetween(dayRange(period.from).start, dayRange(period.to).end);
    const byDay = new Map<string, number>();
    for (const o of orders) if (!o.cancelled) byDay.set(isoDayLocal(new Date(o.createdAt)), (byDay.get(isoDayLocal(new Date(o.createdAt))) ?? 0) + o.subtotal);
    daily = daysBetween(period.from, period.to).map((d) => ({ label: `${d.slice(8)}/${d.slice(5, 7)}`, value: byDay.get(d) ?? 0 }));
  } catch (e) {
    error = e;
  }
  const real = m ? m.profitBeforeFixed - m.fixedCosts - m.variableCosts : 0;
  const lines = m
    ? [
        ["Faturamento (sem frete)", m.net, false],
        ["Custo dos produtos", -m.cogs, false],
        ["Impostos e taxas de pagamento", -m.taxesFees, false],
        ["Embalagem", -m.packaging, false],
        ["Anúncios (Meta)", -(m.ads ?? 0), false],
        ["Lucro antes dos custos fixos", m.profitBeforeFixed, true],
        ...(period.monthMode
          ? ([
              ["Custos fixos do mês (inteiro)", -m.fixedCosts, false],
              ["Outros custos do mês", -m.variableCosts, false],
              ["Lucro real", real, true],
            ] as [string, number, boolean][])
          : []),
      ]
    : [];

  return (
    <>
      <Header title="Financeiro" lede="O dinheiro que entrou, para onde foi e quanto sobrou de verdade. No mês, os custos fixos entram sempre inteiros.">
        <PeriodTabs base="/financeiro" current={period.key} keys={["7d", "30d", "mes", "mes-passado", "90d"]} />
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      {m && (
        <>
          <div className="grid g4">
            <Kpi label="Faturamento" value={brl(m.net, 0)} sub={`${m.orders} pedidos, ticket médio ${brl(m.aov, 0)}`} />
            <Kpi label="Anúncios" value={m.ads != null ? brl(m.ads, 0) : "–"} sub={m.ads ? `ROAS ${(m.net / m.ads).toFixed(2).replace(".", ",")}` : "conecte o Meta Ads"} />
            <Kpi label={period.monthMode ? "Lucro real" : "Lucro antes dos fixos"} value={<span className={(period.monthMode ? real : m.profitBeforeFixed) < 0 ? "dn" : "up"}>{brl(period.monthMode ? real : m.profitBeforeFixed, 0)}</span>} sub={m.net ? `${pct((period.monthMode ? real : m.profitBeforeFixed) / m.net, 1)} do faturamento` : undefined} />
            <Kpi label="Custos fixos" value={period.monthMode ? brl(m.fixedCosts, 0) : "–"} sub={period.monthMode ? "mês inteiro" : "aparecem na visão de mês"} />
          </div>
          <div className="grid g2" style={{ alignItems: "start" }}>
            <Panel title="Faturamento por dia">
              <BarChart data={daily} format={(v) => brl(v, 0)} />
            </Panel>
            <Panel title="Para onde foi o dinheiro" body={false}>
              <table className="tb">
                <tbody>
                  {lines.map(([label, value, strong]) => (
                    <tr key={label as string}>
                      <td style={strong ? { fontWeight: 600 } : undefined}>{label}</td>
                      <td className="r" style={strong ? { fontWeight: 600 } : undefined}>
                        <span className={(value as number) < 0 ? (strong ? "dn" : "mut") : strong ? "up" : ""}>{brl(value as number)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {m.missingCost.length > 0 && (
                <div className="note" style={{ margin: "0 22px 18px" }}>
                  {m.missingCost.length} produto(s) vendidos sem custo cadastrado. O lucro real é menor que o mostrado. Veja em Produtos e lucro.
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
