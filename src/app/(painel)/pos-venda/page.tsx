import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Header, Kpi, Panel } from "@/components/ui";
import { savePostsale } from "../acoes3";

export const dynamic = "force-dynamic";

export default async function PosVenda({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const since = new Date(Date.now() - 30 * 864e5);
  const [reviews, repurchase] = await Promise.all([
    db.recoveryCase.count({ where: { kind: "avaliacao", sentCount: { gt: 0 }, createdAt: { gte: since } } }),
    db.recoveryCase.count({ where: { kind: "recompra", sentCount: { gt: 0 }, createdAt: { gte: since } } }),
  ]);
  return (
    <>
      <Header title="Pós-venda" lede="Depois que o pedido chega: pedido de avaliação com foto e cupom para a próxima compra. E uma mensagem para quem está há um tempo sem comprar." />
      {sp.ok && <div className="ok">Salvo.</div>}
      <div className="grid g4">
        <Kpi label="Pedidos de avaliação (30 dias)" value={reviews} />
        <Kpi label="Chamadas de recompra (30 dias)" value={repurchase} />
        <Kpi label="Cupom da próxima compra" value={s.postsale.coupon || "–"} sub="crie o mesmo cupom na Shopify" />
        <Kpi label="Avaliação" value={s.postsale.reviewEnabled ? <span className="up">ligada</span> : "desligada"} />
      </div>
      <Panel title="Configurar" sub="{nome}, {pedido}, {cupom}, {loja} e {link} são trocados pelos dados de cada pessoa.">
        <form action={savePostsale} className="stack">
          <label className="check"><input type="checkbox" name="reviewEnabled" defaultChecked={s.postsale.reviewEnabled} /> <b>Pedir avaliação com foto depois da entrega</b></label>
          <div className="row">
            <span className="mut" style={{ fontSize: 13 }}>Mandar</span>
            <input className="in" name="reviewDelayDays" defaultValue={s.postsale.reviewDelayDays} style={{ width: 70, height: 32 }} inputMode="numeric" />
            <span className="mut" style={{ fontSize: 13 }}>dias depois que a transportadora marcar como entregue</span>
          </div>
          <textarea className="in" name="reviewText" defaultValue={s.postsale.reviewText} />
          <div className="row">
            <div className="field" style={{ width: 200 }}><label>Cupom</label><input className="in" name="coupon" defaultValue={s.postsale.coupon} /></div>
            <div className="field" style={{ flex: 1 }}><label>Link da loja</label><input className="in" name="storeUrl" defaultValue={s.postsale.storeUrl} /></div>
          </div>
          <label className="check" style={{ marginTop: 8 }}><input type="checkbox" name="repurchaseEnabled" defaultChecked={s.postsale.repurchaseEnabled} /> <b>Chamar de volta quem está sem comprar</b></label>
          <div className="row">
            <span className="mut" style={{ fontSize: 13 }}>Quando completar</span>
            <input className="in" name="repurchaseDays" defaultValue={s.postsale.repurchaseDays} style={{ width: 70, height: 32 }} inputMode="numeric" />
            <span className="mut" style={{ fontSize: 13 }}>dias desde a última compra</span>
          </div>
          <textarea className="in" name="repurchaseText" defaultValue={s.postsale.repurchaseText} />
          <p className="dim" style={{ fontSize: 12 }}>Cashback e oferta logo depois da compra dependem do checkout da Shopify. Por enquanto o cupom de próxima compra faz esse papel.</p>
          <div><button className="btn pri" type="submit">Salvar</button></div>
        </form>
      </Panel>
    </>
  );
}
