import { NumberInput } from "@/components/NumberInput";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { brl, isoDayLocal } from "@/lib/time";
import { Header, Kpi, Panel } from "@/components/ui";
import { addCost, deleteCost, saveCostRates } from "../actions";

export const dynamic = "force-dynamic";

const KIND = { FIXED: ["fixo", "c-k"], VARIABLE: ["avulso", "c-n"], STOCK_LOT: ["lote", "c-s"] } as const;
const pctIn = (v: number) => (v * 100).toFixed(2).replace(/\.?0+$/, "").replace(".", ",");

export default async function Custos({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  const month = isoDayLocal().slice(0, 7);
  const [s, costs, lots] = await Promise.all([
    getSettings(),
    db.cost.findMany({ where: { kind: { not: "STOCK_LOT" }, OR: [{ month }, { kind: "FIXED", recurring: true }] }, orderBy: { createdAt: "desc" } }),
    db.cost.findMany({ where: { kind: "STOCK_LOT" }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const fixed = costs.filter((c) => c.kind === "FIXED").reduce((a, c) => a + Number(c.amount), 0);
  const variable = costs.filter((c) => c.kind === "VARIABLE").reduce((a, c) => a + Number(c.amount), 0);

  return (
    <>
      <Header title="Custos e lotes" lede="Custos fixos entram inteiros no lucro do mês. Lotes de estoque viram custo por peça, ligado ao produto por uma palavra do nome. Também dá para lançar tudo pelo grupo de resultados." />
      {sp.erro && <div className="err">Confira a descrição, o valor e, no lote, a quantidade de peças.</div>}
      <div className="grid g4">
        <Kpi label="Custos fixos do mês" value={brl(fixed)} sub="sempre o mês inteiro" />
        <Kpi label="Outros custos do mês" value={brl(variable)} />
        <Kpi label="Imposto + taxas" value={`${pctIn(s.costs.taxRate + s.costs.paymentFeeRate)}%`} sub="sobre o faturamento" />
        <Kpi label="Embalagem por peça" value={brl(s.costs.packagingPerItem)} />
      </div>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Lançar custo">
          <form action={addCost} className="stack">
            <div className="row">
              <div className="field" style={{ width: 180 }}>
                <label>Tipo</label>
                <select className="in" name="kind" defaultValue="FIXED">
                  <option value="FIXED">Custo fixo</option>
                  <option value="VARIABLE">Custo avulso</option>
                  <option value="STOCK_LOT">Lote de estoque</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Descrição</label>
                <input className="in" name="description" placeholder="Ex.: Shopify, aluguel, produção Pura" required />
              </div>
            </div>
            <div className="row">
              <div className="field" style={{ width: 160 }}>
                <label>Valor total (R$)</label>
                <NumberInput name="amount" prefix="R$" step={100} decimals={2} placeholder="11.000" required />
              </div>
              <div className="field" style={{ width: 140 }}>
                <label>Mês</label>
                <input className="in" type="month" name="month" defaultValue={month} />
              </div>
              <label className="check" style={{ marginTop: 22 }}>
                <input type="checkbox" name="recurring" defaultChecked /> Repete todo mês (fixo)
              </label>
            </div>
            <div className="row">
              <div className="field" style={{ width: 160 }}>
                <label>Peças (só lote)</label>
                <NumberInput name="units" suffix="peças" step={10} placeholder="200" />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <label>Palavra do produto (só lote)</label>
                <input className="in" name="productKey" placeholder="pura" />
                <span className="hint">Toda venda de produto com essa palavra no nome usa o custo do lote.</span>
              </div>
            </div>
            <div>
              <button className="btn pri" type="submit">Lançar</button>
            </div>
          </form>
        </Panel>
        <Panel title="Impostos e taxas" sub="Configure uma vez. Vale para todos os cálculos de lucro.">
          <form action={saveCostRates} className="stack">
            <div className="row">
              <div className="field" style={{ width: 150 }}>
                <label>Imposto (%)</label>
                <NumberInput name="taxRate" defaultValue={pctIn(s.costs.taxRate)} suffix="%" step={0.5} decimals={2} max={100} />
              </div>
              <div className="field" style={{ width: 170 }}>
                <label>Taxas de pagamento (%)</label>
                <NumberInput name="paymentFeeRate" defaultValue={pctIn(s.costs.paymentFeeRate)} suffix="%" step={0.5} decimals={2} max={100} />
              </div>
              <div className="field" style={{ width: 150 }}>
                <label>Embalagem (R$/peça)</label>
                <NumberInput name="packagingPerItem" defaultValue={s.costs.packagingPerItem} prefix="R$" step={0.5} decimals={2} />
              </div>
            </div>
            <div>
              <button className="btn" type="submit">Salvar</button>
            </div>
          </form>
        </Panel>
      </div>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title={`Custos de ${month.slice(5)}/${month.slice(0, 4)}`} body={false}>
          <CostTable rows={costs} />
        </Panel>
        <Panel title="Lotes de estoque" body={false}>
          <CostTable rows={lots} lots />
        </Panel>
      </div>
    </>
  );
}

type Row = Awaited<ReturnType<typeof db.cost.findMany>>[number];
function CostTable({ rows, lots }: { rows: Row[]; lots?: boolean }) {
  if (!rows.length) return <div className="empty">Nada lançado.</div>;
  return (
    <table className="tb">
      <tbody>
        {rows.map((c) => (
          <tr key={c.id}>
            <td>
              <span className={`chip ${KIND[c.kind][1]}`} style={{ marginRight: 8 }}>{KIND[c.kind][0]}</span>
              {c.description}
              <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>
                {lots ? `${c.units} peças · palavra “${c.productKey ?? "-"}” · ${c.month}` : c.recurring ? "todo mês" : c.month}
                {c.source === "whatsapp" ? " · pelo WhatsApp" : ""}
              </div>
            </td>
            <td className="r">
              <b>{brl(Number(c.amount))}</b>
              {lots && c.unitCost && <div className="mut" style={{ fontSize: 12 }}>{brl(Number(c.unitCost))}/peça</div>}
            </td>
            <td style={{ width: 50 }}>
              <form action={deleteCost}>
                <input type="hidden" name="id" value={c.id} />
                <button className="btn sm danger" type="submit" title="Apagar">
                  <Trash2 size={14} />
                </button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
