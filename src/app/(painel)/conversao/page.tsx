import { conversionByDevice, funnelByDay, hasShopify, type FunnelDay } from "@/lib/store";
import { resolvePeriod } from "@/lib/periods";
import { pct } from "@/lib/time";
import { BarChart, Header, Kpi, NeedShopify, Panel, PeriodTabs } from "@/components/ui";

export const dynamic = "force-dynamic";

const DEVICE: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tablet", other: "Outro" };

export default async function Conversao({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const period = resolvePeriod(p, "30d");
  if (!hasShopify()) {
    return (
      <>
        <Header title="Conversão" />
        <NeedShopify />
      </>
    );
  }
  const [days, devices] = await Promise.all([funnelByDay(period.from, period.to), conversionByDevice(period.from, period.to)]);
  const sum = (k: keyof FunnelDay) => (days ?? []).reduce((a, d) => a + (d[k] as number), 0);
  const visits = sum("sessions"), cart = sum("cart"), checkout = sum("checkout"), bought = sum("purchased");
  const rate = visits ? bought / visits : 0;
  const per1000 = Math.round(rate * 1000 * 10) / 10;
  const steps = [
    { label: "Entraram na loja", n: visits },
    { label: "Colocaram no carrinho", n: cart },
    { label: "Foram para o pagamento", n: checkout },
    { label: "Compraram", n: bought },
  ];
  const worst = steps.slice(1).map((s, i) => ({ from: steps[i], to: s, keep: steps[i].n ? s.n / steps[i].n : 0 })).sort((a, b) => a.keep - b.keep)[0];
  const mobile = devices?.find((d) => d.device === "mobile");
  const desktop = devices?.find((d) => d.device === "desktop");

  return (
    <>
      <Header title="Conversão" lede="De cada pessoa que entra na loja, quantas compram, e em que parte do caminho as outras desistem.">
        <PeriodTabs base="/conversao" current={period.key} keys={["7d", "30d", "mes", "mes-passado", "90d"]} />
      </Header>
      {!days && <div className="err">A Shopify não liberou os dados de visitas. Confira se a chave tem a permissão read_reports.</div>}
      {days && (
        <>
          <div className="grid g4">
            <Kpi label="Taxa de conversão" value={pct(rate)} sub={`${per1000.toLocaleString("pt-BR")} compras a cada 1.000 visitas`} />
            <Kpi label="Visitas" value={visits.toLocaleString("pt-BR")} />
            <Kpi label="Compras" value={bought.toLocaleString("pt-BR")} />
            <Kpi label="Celular x computador" value={mobile && desktop ? `${pct(mobile.rate)} / ${pct(desktop.rate)}` : "–"} sub="conversão em cada aparelho" />
          </div>
          <div className="grid g2" style={{ alignItems: "start" }}>
            <Panel title="O caminho do cliente" sub="Quantas pessoas chegam em cada etapa">
              <div className="funnel">
                {steps.map((s, i) => (
                  <div className="st" key={s.label}>
                    <span>{s.label}</span>
                    <div className="track"><div className="fill" style={{ width: `${visits ? Math.max(1, (s.n / visits) * 100) : 0}%` }} /></div>
                    <span className="r">
                      <b>{s.n.toLocaleString("pt-BR")}</b>
                      {i > 0 && steps[i - 1].n > 0 && <div className="drop">{pct(1 - s.n / steps[i - 1].n, 0)} desistem</div>}
                    </span>
                  </div>
                ))}
              </div>
              {worst && (
                <p className="explain" style={{ marginTop: 16 }}>
                  O maior vazamento está entre <b>{worst.from.label.toLowerCase()}</b> e <b>{worst.to.label.toLowerCase()}</b>: só {pct(worst.keep, 0)} seguem.
                  {worst.to.label === "Colocaram no carrinho" && " Fotos, preço e tabela de medidas na página do produto são o que mais pesa aqui."}
                  {worst.to.label === "Foram para o pagamento" && " Frete e prazo aparecendo cedo costumam ajudar."}
                  {worst.to.label === "Compraram" && " Vale olhar meios de pagamento, Pix e a recuperação de checkout."}
                </p>
              )}
            </Panel>
            <Panel title="Conversão por dia">
              <BarChart data={days.map((d) => ({ label: `${d.day.slice(8)}/${d.day.slice(5, 7)}`, value: d.rate * 100 }))} format={(v) => `${v.toFixed(2).replace(".", ",")}%`} />
            </Panel>
          </div>
          {devices && devices.length > 0 && (
            <Panel title="Por aparelho" body={false}>
              <table className="tb">
                <thead><tr><th>Aparelho</th><th className="r">Visitas</th><th className="r">Compras</th><th className="r">Conversão</th></tr></thead>
                <tbody>
                  {devices.sort((a, b) => b.sessions - a.sessions).map((d) => (
                    <tr key={d.device}>
                      <td>{DEVICE[d.device] ?? d.device}</td>
                      <td className="r">{d.sessions.toLocaleString("pt-BR")}</td>
                      <td className="r">{d.purchased}</td>
                      <td className="r"><b>{pct(d.rate)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
