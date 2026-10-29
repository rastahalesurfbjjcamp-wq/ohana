import Link from "next/link";
import { MessageSquareQuote, RotateCcw, Star, Ticket } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { gql } from "@/lib/store";
import { brl } from "@/lib/time";
import { formatPhone } from "@/lib/phone";
import { Header, Panel } from "@/components/ui";
import { NumberInput } from "@/components/NumberInput";
import { AutoToggle } from "@/components/AutoToggle";
import { saveRecoveryMessages, toggleAutomation } from "../acoes4";

export const dynamic = "force-dynamic";

export default async function PosVenda({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const since = new Date(Date.now() - 60 * 864e5);
  const [reviewCases, rebuyCases] = await Promise.all([
    db.recoveryCase.findMany({ where: { kind: "avaliacao", sentCount: { gt: 0 }, createdAt: { gte: since } } }),
    db.recoveryCase.findMany({ where: { kind: "recompra", sentCount: { gt: 0 }, createdAt: { gte: since } } }),
  ]);
  // respostas que chegaram depois do pedido de avaliação
  const replies = reviewCases.length
    ? await db.chatMessage.findMany({ where: { fromMe: false, OR: reviewCases.filter((c) => c.lastSentAt).map((c) => ({ phone: c.phone, createdAt: { gte: c.lastSentAt! } })) }, orderBy: { createdAt: "desc" }, take: 24, include: { thread: true } })
    : [];
  let couponUses = 0, couponRevenue = 0;
  if (s.postsale.coupon) {
    const d = await gql<{ orders: { nodes: { currentSubtotalPriceSet: { shopMoney: { amount: string } } }[] } }>(
      `query($q:String){ orders(first:250, query:$q){ nodes{ currentSubtotalPriceSet{shopMoney{amount}} } } }`,
      { q: `discount_code:${s.postsale.coupon} created_at:>='${since.toISOString()}'` },
    ).catch(() => null);
    couponUses = d?.orders.nodes.length ?? 0;
    couponRevenue = (d?.orders.nodes ?? []).reduce((a, o) => a + Number(o.currentSubtotalPriceSet.shopMoney.amount), 0);
  }
  const rebuyBack = rebuyCases.filter((c) => c.status === "recuperado");

  const cards = [
    { k: "avaliacao", icon: Star, tone: "t-s", title: "Avaliação com foto", sub: `${s.postsale.reviewDelayDays} dias depois da entrega`, on: s.postsale.reviewEnabled, big: `${reviewCases.length}`, unit: "pedidos", note: `${replies.length} respostas no WhatsApp nos últimos 60 dias. Quem manda foto ganha o cupom ${s.postsale.coupon}.` },
    { k: "recompra", icon: RotateCcw, tone: "t-l", title: "Chamar de volta", sub: `${s.postsale.repurchaseDays} dias sem comprar`, on: s.postsale.repurchaseEnabled, big: `${rebuyCases.length}`, unit: "chamados", note: `${rebuyBack.length} voltaram a comprar · ${brl(rebuyBack.reduce((a, c) => a + (c.recoveredValue ?? 0), 0), 0)}` },
    { k: "", icon: Ticket, tone: "t-k", title: `Cupom ${s.postsale.coupon || "da próxima compra"}`, sub: "enviado na avaliação e na volta", on: true, big: `${couponUses}`, unit: "usos", note: `${brl(couponRevenue, 0)} em pedidos com o cupom nos últimos 60 dias. Crie o mesmo cupom na Shopify.` },
  ];

  return (
    <>
      <Header title="Pós-venda" lede="O que acontece depois da compra para o cliente voltar: avaliação com foto, cupom da próxima compra e a mensagem para quem sumiu." />
      {sp.ok && <div className="ok">Salvo.</div>}
      <div className="cols c-1-1-1">
        {cards.map((c) => (
          <section key={c.title} className={`pnl pv-card${c.on ? " on" : ""}`}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
              <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                <span className={`tile sm ${c.tone}`}><c.icon size={16} /></span>
                <div><b style={{ fontSize: 15 }}>{c.title}</b><div className="dim" style={{ fontSize: 12.5 }}>{c.sub}</div></div>
              </div>
              {c.k && <AutoToggle action={toggleAutomation} k={c.k} on={c.on} />}
            </div>
            <div className="row" style={{ alignItems: "baseline", gap: 8, margin: "16px 0 6px" }}><span className="mid-num">{c.big}</span><span className="mut">{c.unit}</span></div>
            <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.45 }}>{c.note}</div>
          </section>
        ))}
      </div>
      <div className="cols c-2-1" style={{ alignItems: "start" }}>
        <Panel title="Respostas que chegaram pelo WhatsApp" sub="Depois do pedido de avaliação" right={<Link className="btn sm ghost" href="/atendimento">Atendimento</Link>}>
          {replies.length ? (
            <div className="rv-grid">
              {replies.map((m) => {
                const c = reviewCases.find((x) => x.phone === m.phone);
                return (
                  <Link key={m.id} href={`/atendimento?tel=${m.phone}`} className="rv">
                    <MessageSquareQuote size={18} className="dim" />
                    <p>{m.text.length > 160 ? `${m.text.slice(0, 160)}…` : m.text}</p>
                    <small>{m.thread.name ?? formatPhone(m.phone)}{c?.product ? ` · ${c.product}` : ""}</small>
                  </Link>
                );
              })}
            </div>
          ) : <div className="empty">As respostas aparecem aqui quando a avaliação estiver ligada e os clientes responderem.</div>}
        </Panel>
        <div className="stack">
          <Panel title="Mensagem da avaliação" sub="{nome}, {pedido}, {cupom} e {loja}">
            <form action={saveRecoveryMessages} className="stack" style={{ gap: 8 }}>
              <input type="hidden" name="kind" value="avaliacao" />
              <input type="hidden" name="back" value="/pos-venda" />
              <div className="row"><span className="mut" style={{ fontSize: 13 }}>Mandar</span><NumberInput size="sm" name="reviewDelayDays" defaultValue={s.postsale.reviewDelayDays} suffix="dias" /><span className="mut" style={{ fontSize: 13 }}>depois de entregue</span></div>
              <textarea className="in" name="reviewText" defaultValue={s.postsale.reviewText} />
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <div className="field" style={{ width: 150 }}><label>Cupom</label><input className="in" name="coupon" defaultValue={s.postsale.coupon} /></div>
                <div className="field" style={{ flex: 1 }}><label>Link da loja</label><input className="in" name="storeUrl" defaultValue={s.postsale.storeUrl} /></div>
              </div>
              <div><button className="btn pri sm" type="submit">Salvar</button></div>
            </form>
          </Panel>
          <Panel title="Mensagem para quem sumiu" sub="{nome}, {cupom}, {link} e {loja}">
            <form action={saveRecoveryMessages} className="stack" style={{ gap: 8 }}>
              <input type="hidden" name="kind" value="recompra" />
              <input type="hidden" name="back" value="/pos-venda" />
              <div className="row"><span className="mut" style={{ fontSize: 13 }}>Quando completar</span><NumberInput size="sm" name="repurchaseDays" defaultValue={s.postsale.repurchaseDays} suffix="dias" step={5} /></div>
              <textarea className="in" name="repurchaseText" defaultValue={s.postsale.repurchaseText} />
              <div><button className="btn pri sm" type="submit">Salvar</button></div>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
