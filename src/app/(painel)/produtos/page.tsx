import { productProfits, type ProductProfit } from "@/lib/profit";
import { resolvePeriod } from "@/lib/periods";
import { getSettings } from "@/lib/settings";
import { brl, pct } from "@/lib/time";
import { ErrorNote, Header, Kpi, Panel, PeriodTabs } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Produtos({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const period = resolvePeriod(p, "30d");
  const s = await getSettings();
  let rows: ProductProfit[] = [];
  let error: unknown = null;
  try {
    rows = await productProfits(period.from, period.to);
  } catch (e) {
    error = e;
  }
  const missing = rows.filter((r) => r.cost == null);
  const totalProfit = rows.reduce((a, r) => a + (r.profit ?? 0), 0);
  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
  const best = [...rows].filter((r) => r.profit != null).sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0))[0];

  return (
    <>
      <Header
        title="Produtos e lucro"
        lede={`Quanto sobra de cada peça depois do custo, ${pct(s.costs.taxRate, 1)} de imposto, ${pct(s.costs.paymentFeeRate, 1)} de taxas e ${brl(s.costs.packagingPerItem)} de embalagem. Anúncios e custos fixos entram no Financeiro.`}
      >
        <PeriodTabs base="/produtos" current={period.key} keys={["7d", "30d", "mes", "mes-passado", "90d"]} />
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      <div className="grid g4">
        <Kpi label={`Faturamento (${period.label.toLowerCase()})`} value={brl(totalRevenue, 0)} />
        <Kpi label="Lucro dos produtos" value={brl(totalProfit, 0)} sub="só dos produtos com custo cadastrado" />
        <Kpi label="Mais lucrativo" value={best ? best.product.title.slice(0, 22) : "–"} sub={best ? brl(best.profit ?? 0, 0) : undefined} />
        <Kpi label="Sem custo cadastrado" value={missing.length} sub={missing.length ? "o lucro deles não entra na conta" : "tudo certo"} />
      </div>
      {missing.length > 0 && (
        <div className="note">
          Sem custo: {missing.slice(0, 6).map((r) => r.product.title).join(", ")}
          {missing.length > 6 ? ` e mais ${missing.length - 6}` : ""}. Cadastre o custo na Shopify (campo “Custo por item”) ou lance um lote em Custos e lotes, por texto ou áudio no grupo de resultados.
        </div>
      )}
      <Panel title="Produtos ativos" sub="Ordenado pelo que mais faturou no período" body={false}>
        {rows.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="tb">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="r">Preço</th>
                  <th className="r">Custo</th>
                  <th className="r">Sobra por peça</th>
                  <th className="r">Margem</th>
                  <th className="r">Vendidos</th>
                  <th className="r">Faturamento</th>
                  <th className="r">Lucro</th>
                  <th className="r">Estoque</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product.id}>
                    <td>
                      <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.product.image ? <img className="thumb" src={`${r.product.image}&width=80`} alt="" /> : <div className="thumb" />}
                        <span>{r.product.title}</span>
                      </div>
                    </td>
                    <td className="r">{brl(r.price)}</td>
                    <td className="r">
                      {r.cost != null ? brl(r.cost) : <span className="chip c-s">falta</span>}
                      {r.costFromLot && <div className="dim" style={{ fontSize: 11 }}>do lote</div>}
                    </td>
                    <td className="r">{r.unitProfit != null ? <b className={r.unitProfit < 0 ? "dn" : ""}>{brl(r.unitProfit)}</b> : "–"}</td>
                    <td className="r">{r.margin != null ? pct(r.margin, 0) : "–"}</td>
                    <td className="r">{r.sold}</td>
                    <td className="r">{brl(r.revenue, 0)}</td>
                    <td className="r">{r.profit != null ? <b className={r.profit < 0 ? "dn" : "up"}>{brl(r.profit, 0)}</b> : "–"}</td>
                    <td className="r mut">{r.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !error && <div className="empty">Nenhum produto ativo.</div>
        )}
      </Panel>
    </>
  );
}
