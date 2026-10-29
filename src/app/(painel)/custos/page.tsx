import { CheckCheck, Package, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { computeMetrics } from "@/lib/report";
import { productProfits } from "@/lib/profit";
import { addDays, brl, isoDayLocal } from "@/lib/time";
import { Header } from "@/components/ui";
import { NumberInput } from "@/components/NumberInput";
import { addCost, deleteCost, saveCostRates } from "../actions";

export const dynamic = "force-dynamic";

const pctIn = (v: number) => (v * 100).toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
const REGIME: Record<string, string> = { simples: "Simples Nacional", mei: "MEI", presumido: "Lucro Presumido", real: "Lucro Real" };

export default async function Custos({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const sp = await searchParams;
  const today = isoDayLocal();
  const month = today.slice(0, 7);
  const [s, costs, lots] = await Promise.all([
    getSettings(),
    db.cost.findMany({ where: { kind: { not: "STOCK_LOT" }, OR: [{ month }, { kind: "FIXED", recurring: true }] }, orderBy: [{ kind: "asc" }, { createdAt: "desc" }] }),
    db.cost.findMany({ where: { kind: "STOCK_LOT" }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const c = s.costs;
  const fixed = costs.filter((x) => x.kind === "FIXED");
  const variable = costs.filter((x) => x.kind === "VARIABLE");
  const fixedTotal = fixed.reduce((a, x) => a + Number(x.amount), 0);
  const varTotal = variable.reduce((a, x) => a + Number(x.amount), 0);

  // Simulação com o produto mais vendido dos últimos 30 dias
  let sim: { title: string; price: number; cost: number | null } | null = null;
  let adsShare = 0;
  try {
    const [pp, m] = await Promise.all([productProfits(addDays(today, -29), today), computeMetrics(addDays(today, -29), today)]);
    const top = pp.filter((p) => p.sold > 0).sort((a, b) => b.sold - a.sold)[0];
    if (top) sim = { title: top.product.title, price: top.price, cost: top.cost };
    adsShare = m.ads && m.net ? m.ads / m.net : 0;
  } catch {
    sim = null;
  }
  const lines = sim
    ? [
        ["Custo da peça", sim.cost ?? 0, sim.cost == null ? "sem custo cadastrado" : ""],
        [`${REGIME[c.regime] ?? "Imposto"}, ${pctIn(c.taxRate)}%`, sim.price * c.taxRate, ""],
        [`Pagamento (média ${pctIn(c.paymentFeeRate)}%)`, sim.price * c.paymentFeeRate, `${Math.round(c.pixShare * 100)}% no Pix`],
        ["Embalagem", c.packagingPerItem, ""],
        [`Anúncio, média de ${Math.round(adsShare * 100)}%`, sim.price * adsShare, adsShare ? "" : "sem Meta conectado"],
      ] as [string, number, string][]
    : [];
  const left = sim ? sim.price - lines.reduce((a, l) => a + l[1], 0) : 0;

  return (
    <>
      <Header title="Custos e impostos" lede="Preencha uma vez. Daqui pra frente, todo lucro do sistema já sai com tudo descontado. Custos fixos saem inteiros do lucro do mês." />
      {sp.ok === "1" && <div className="ok">Impostos e taxas salvos. A taxa média de pagamento ficou em {pctIn(c.paymentFeeRate)}%, pela mistura real de Pix e cartão dos últimos 30 dias.</div>}
      {sp.ok === "custo" && <div className="ok">Custo lançado.</div>}
      {sp.ok === "lote" && <div className="ok">Lote lançado. As vendas desse produto já usam o custo por peça.</div>}
      {sp.erro && <div className="err">Confira a descrição, o valor e, no lote, a quantidade de peças.</div>}
      <div className="cols" style={{ gridTemplateColumns: "minmax(0, 1fr) 380px", alignItems: "start" }}>
        <div className="stack" style={{ gap: 16 }}>
          <form action={saveCostRates} className="pnl" style={{ padding: 22 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Impostos</h3>
              <button className="btn pri" type="submit"><CheckCheck size={15} /> Salvar</button>
            </div>
            <div className="g2f">
              <div className="field"><label>Regime</label><select className="in" name="regime" defaultValue={c.regime}>{Object.entries(REGIME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field"><label>Alíquota sobre o faturamento</label><NumberInput name="taxRate" defaultValue={pctIn(c.taxRate)} suffix="%" step={0.5} decimals={2} max={100} /></div>
            </div>
            <div className="sep" />
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Taxas do pagamento</h3>
            <div className="g2f">
              <div className="field"><label>Gateway</label><input className="in" name="gatewayName" defaultValue={c.gatewayName} /></div>
              <div className="field"><label>Pix</label><NumberInput name="pixFee" defaultValue={pctIn(c.pixFee)} suffix="%" step={0.1} decimals={2} max={20} /></div>
              <div className="field"><label>Cartão</label><NumberInput name="cardFee" defaultValue={pctIn(c.cardFee)} suffix="%" step={0.1} decimals={2} max={20} /></div>
              <div className="field"><label>Média usada no lucro</label><div className="in" style={{ display: "flex", alignItems: "center", gap: 8 }}><b>{pctIn(c.paymentFeeRate)}%</b><span className="dim" style={{ fontSize: 12.5 }}>{Math.round(c.pixShare * 100)}% das vendas no Pix</span></div></div>
            </div>
            <div className="sep" />
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Por pedido</h3>
            <div className="g2f">
              <div className="field"><label>Embalagem e etiqueta, por peça</label><NumberInput name="packagingPerItem" defaultValue={c.packagingPerItem} prefix="R$" step={0.5} decimals={2} /></div>
            </div>
          </form>

          <section className="pnl" style={{ padding: 22 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Custos fixos do mês</h3>
              <b style={{ fontSize: 15 }}>{brl(fixedTotal)}</b>
            </div>
            {fixed.map((x) => <CostLine key={x.id} c={x} />)}
            {variable.length > 0 && (
              <>
                <div className="row" style={{ justifyContent: "space-between", margin: "16px 0 6px" }}><span className="mut" style={{ fontSize: 13 }}>Outros custos de {month.slice(5)}/{month.slice(0, 4)}</span><b>{brl(varTotal)}</b></div>
                {variable.map((x) => <CostLine key={x.id} c={x} />)}
              </>
            )}
            {!costs.length && <div className="empty" style={{ padding: 18 }}>Nenhum custo lançado ainda.</div>}
            <form action={addCost} className="addline">
              <Plus size={16} className="up" />
              <select className="in" name="kind" defaultValue="FIXED" style={{ width: 150, height: 40 }}><option value="FIXED">Fixo (todo mês)</option><option value="VARIABLE">Só deste mês</option></select>
              <input type="hidden" name="recurring" value="on" />
              <input className="in" name="description" placeholder="Ex.: aluguel, equipe, aplicativos" required style={{ flex: 1, minWidth: 160, height: 40 }} />
              <NumberInput name="amount" prefix="R$" step={50} decimals={2} placeholder="0,00" required width={170} />
              <button className="btn pri sm" type="submit">Adicionar</button>
            </form>
            <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>Também dá para lançar pelo grupo de resultados: “lança 89 reais de ferramenta todo mês”.</p>
          </section>

          <section className="pnl" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Lotes de estoque</h3>
            <p className="dim" style={{ fontSize: 12.5, marginBottom: 10 }}>O custo do lote vira custo por peça para todo produto com a palavra no nome.</p>
            {lots.map((x) => <CostLine key={x.id} c={x} lot />)}
            <form action={addCost} className="addline" style={{ flexWrap: "wrap" }}>
              <Package size={16} className="up" />
              <input type="hidden" name="kind" value="STOCK_LOT" />
              <input className="in" name="description" placeholder="Ex.: produção Pura dezembro" required style={{ flex: 1, minWidth: 180, height: 40 }} />
              <input className="in" name="productKey" placeholder="palavra do produto" style={{ width: 170, height: 40 }} />
              <NumberInput name="units" suffix="peças" step={10} placeholder="200" width={160} />
              <NumberInput name="amount" prefix="R$" step={100} decimals={2} placeholder="11.000" required width={170} />
              <button className="btn pri sm" type="submit">Lançar lote</button>
            </form>
          </section>
        </div>

        <section className="pnl" style={{ padding: 22, position: "sticky", top: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Como fica uma venda</h3>
          <small className="dim">{sim ? `1 ${sim.title}, o mais vendido do mês` : "Conecte a Shopify para ver a simulação"}</small>
          {sim && (
            <>
              <div className="kv" style={{ marginTop: 10 }}><span>Preço de venda</span><b>{brl(sim.price)}</b></div>
              {lines.map(([l, v, note]) => (
                <div className="kv" key={l}><span className="mut">{l}{note && <small className="dim" style={{ display: "block", fontSize: 11.5 }}>{note}</small>}</span><span className="dn" style={{ fontWeight: 600 }}>-{brl(v)}</span></div>
              ))}
              <div className="kv" style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 16 }}><span style={{ fontSize: 16, fontWeight: 600 }}>Sobra por peça</span><b className={left >= 0 ? "up" : "dn"} style={{ fontSize: 24, fontFamily: "Geist" }}>{brl(left)}</b></div>
              <div className="callout" style={{ background: "#0f1312", border: "1px solid #222826", color: "var(--ink2)", marginTop: 12 }}>Os custos fixos ({brl(fixedTotal)}) não entram na peça: eles saem inteiros do lucro do mês, no Financeiro.</div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

type Row = Awaited<ReturnType<typeof db.cost.findMany>>[number];
function CostLine({ c, lot }: { c: Row; lot?: boolean }) {
  return (
    <div className="costl">
      <div style={{ flex: 1, minWidth: 0 }}>
        <span>{c.description}</span>
        <small className="dim">{lot ? `${c.units} peças · palavra “${c.productKey ?? "-"}” · ${c.month}` : c.recurring ? "todo mês" : c.month}{c.source === "whatsapp" ? " · pelo WhatsApp" : ""}</small>
      </div>
      <div style={{ textAlign: "right" }}>
        <b>{brl(Number(c.amount))}</b>
        {lot && c.unitCost && <small className="dim" style={{ display: "block" }}>{brl(Number(c.unitCost))}/peça</small>}
      </div>
      <form action={deleteCost}><input type="hidden" name="id" value={c.id} /><button className="menu-b" type="submit" title="Apagar"><Trash2 size={15} /></button></form>
    </div>
  );
}
