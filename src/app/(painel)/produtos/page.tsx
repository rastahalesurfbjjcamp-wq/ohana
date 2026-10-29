import Link from "next/link";
import { AlertCircle, Calculator, Megaphone, ReceiptText, Settings, ShoppingBag } from "lucide-react";
import { DateRange } from "@/components/DateRange";
import { CostVoice } from "@/components/CostVoice";
import { computeMetrics, type Metrics } from "@/lib/report";
import { productProfits, type ProductProfit } from "@/lib/profit";
import { resolvePeriod } from "@/lib/periods";
import { getSettings } from "@/lib/settings";
import { brl, pct } from "@/lib/time";
import { ErrorNote, Header, Kpi, Panel } from "@/components/ui";
import { parseCosts, saveCostTable, saveParsedCosts } from "../acoes4";
import { CostTableBar, SelectAll } from "@/components/CostTableBar";

export const dynamic = "force-dynamic";

export default async function Produtos({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string; todos?: string; salvos?: string }> }) {
  const { p, de, ate, todos, salvos } = await searchParams;
  const backUrl = `/produtos?${new URLSearchParams({ ...(p ? { p } : {}), ...(de ? { de } : {}), ...(ate ? { ate } : {}), ...(todos ? { todos } : {}) })}`;
  const period = resolvePeriod(p, "30d", de, ate);
  const s = await getSettings();
  let rows: ProductProfit[] = [];
  let m: Metrics | null = null;
  let error: unknown = null;
  try {
    [rows, m] = await Promise.all([productProfits(period.from, period.to), computeMetrics(period.from, period.to)]);
  } catch (e) {
    error = e;
  }
  const sold = rows.filter((r) => r.sold > 0);
  const missing = sold.filter((r) => r.cost == null);
  const revenue = m?.net ?? sold.reduce((a, r) => a + r.revenue, 0);
  const adsShare = m?.ads && revenue ? m.ads / revenue : 0;
  const list = (todos ? rows : sold).sort((a, b) => b.revenue - a.revenue);
  const real = (r: ProductProfit) => (r.profit == null ? null : r.profit - r.revenue * adsShare);
  const maxMargin = Math.max(0.01, ...list.map((r) => { const x = real(r); return x != null && r.revenue ? x / r.revenue : 0; }));

  return (
    <>
      <Header title="Produtos e lucro" lede="Quanto sobra de verdade em cada peça, depois de custo, impostos, taxas, embalagem e anúncio.">
        <DateRange current={period.key} from={period.from} to={period.to} label={period.label} />
        <Link className="btn" href="/precificacao"><Calculator size={15} /> Precificação</Link>
        <Link className="btn" href="/custos"><Settings size={15} /> Impostos e taxas</Link>
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      {salvos && <div className="ok">{Number(salvos) ? `${salvos} custo${salvos === "1" ? "" : "s"} salvo${salvos === "1" ? "" : "s"}. O lucro já foi recalculado.` : "Nenhum custo mudou."}</div>}
      <div className="grid g4">
        <Kpi icon={<ShoppingBag size={15} />} label="Faturamento líquido" value={brl(revenue, 0)} sub={`${m?.orders ?? 0} pedidos · ${period.label.toLowerCase()}`} />
        <Kpi icon={<Megaphone size={15} />} tone="k" label="Anúncios" value={m?.ads != null ? brl(m.ads, 0) : "–"} sub={m?.ads != null ? `${pct(adsShare, 0)} do faturamento, puxado do Meta` : "conecte o Meta Ads"} />
        <Kpi icon={<ReceiptText size={15} />} tone="p" label="Impostos e taxas" value={brl(m?.taxesFees ?? 0, 0)} sub={`imposto ${pct(s.costs.taxRate, 1)} e pagamento ${pct(s.costs.paymentFeeRate, 1)}`} />
        <div className={`pnl kpi${missing.length ? " warnk" : ""}`}>
          <small><span className={`tile sm ${missing.length ? "t-s" : "t-l"}`} style={{ width: 28, height: 28, borderRadius: 8 }}><AlertCircle size={15} /></span> Sem custo cadastrado</small>
          <span className="num" style={missing.length ? { color: "var(--sun)" } : undefined}>{missing.length} produto{missing.length === 1 ? "" : "s"}</span>
          <div className="sub">{missing.length ? "o lucro deles fica incompleto" : "tudo com custo"}</div>
        </div>
      </div>
      <div className="cols c-2-1" style={{ alignItems: "start" }}>
        <Panel title="Lucro por produto" sub={`${todos ? "Todos os produtos" : "Os vendidos"} no período. Clique no título da coluna para ordenar, digite o custo direto na linha ou marque vários para aplicar o mesmo custo.`} body={false}
          right={<Link className="btn sm ghost" href={todos ? "/produtos" : `/produtos?todos=1${p ? `&p=${p}` : ""}`}>{todos ? "Só os vendidos" : `Ver os ${rows.length}`}</Link>}>
          {list.length ? (
            <form action={saveCostTable}>
            <input type="hidden" name="back" value={backUrl} />
            <div style={{ overflowX: "auto" }}>
              <table className="tb">
                <thead><tr><th style={{ width: 36 }}><SelectAll /></th><th>Produto</th><th className="r">Vendidos</th><th className="r">Faturou</th><th className="r">Custo por peça</th><th className="r">Lucro real</th><th style={{ width: 170 }}>Margem</th><th className="r">Estoque</th></tr></thead>
                <tbody>
                  {list.slice(0, 150).map((r) => {
                    const lr = real(r);
                    const mg = lr != null && r.revenue ? lr / r.revenue : null;
                    return (
                      <tr key={r.product.id} className={r.cost == null && r.sold ? "warn-y" : ""}>
                        <td><input type="checkbox" name="sel" value={r.product.title} aria-label={`Selecionar ${r.product.title}`} /></td>
                        <td data-sort={r.product.title.toLowerCase()}>
                          <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {r.product.image ? <img className="thumb" src={r.product.image} alt="" /> : <div className="thumb" />}
                            <Link href={`/precificacao?produto=${encodeURIComponent(r.product.title)}`} style={{ color: "inherit", fontWeight: 600 }} title="Simular preço e lucro">{r.product.title}</Link>
                          </div>
                        </td>
                        <td className="r">{r.sold}</td>
                        <td className="r">{brl(r.revenue, 0)}</td>
                        <td className="r" data-sort={r.cost ?? -1}>
                          <input type="hidden" name={`o::${r.product.title}`} value={r.cost != null ? r.cost.toFixed(2).replace(".", ",") : ""} />
                          <span className="row" style={{ gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}><span className="dim" style={{ fontSize: 12 }}>R$</span><input className={`cost-in${r.cost == null ? " miss" : ""}`} name={`c::${r.product.title}`} defaultValue={r.cost != null ? r.cost.toFixed(2).replace(".", ",") : ""} data-orig={r.cost != null ? r.cost.toFixed(2).replace(".", ",") : ""} placeholder="falta" inputMode="decimal" /></span>
                        </td>
                        <td className="r" data-sort={lr ?? -1e9}>{lr != null ? <b className={lr < 0 ? "dn" : "up"}>{brl(lr, 0)}</b> : <span className="dim">?</span>}</td>
                        <td data-sort={mg ?? -1e9}>{mg != null ? <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}><div className="hbar" style={{ flex: 1 }}><i className={mg < 0.15 ? "c" : mg < 0.3 ? "s" : ""} style={{ width: `${Math.max(2, (Math.max(0, mg) / maxMargin) * 100)}%` }} /></div><b style={{ width: 38, textAlign: "right" }}>{pct(mg, 0)}</b></div> : <span className="dim">?</span>}</td>
                        <td className="r" data-sort={r.stock}>{r.stock <= 0 ? <span className="chip c-c">zerado</span> : <span className="mut">{r.stock}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <CostTableBar />
            </form>
          ) : !error && <div className="empty">Nenhuma venda no período.</div>}
        </Panel>
        <section className="pnl" style={{ padding: 22, borderColor: "rgba(52,194,106,.35)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Preencher os custos falando</h3>
          <p className="dim" style={{ fontSize: 12.5, margin: "4px 0 12px" }}>Fale ou digite os valores. A IA encontra cada produto e preenche sozinha. {missing.length ? `Faltam: ${missing.slice(0, 4).map((x) => x.product.title).join(", ")}${missing.length > 4 ? "…" : ""}.` : ""}</p>
          <CostVoice products={(missing.length ? missing : sold).map((x) => x.product.title)} parse={parseCosts} save={saveParsedCosts} />
        </section>
      </div>
    </>
  );
}
