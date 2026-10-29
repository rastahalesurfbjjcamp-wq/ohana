import { swr } from "@/lib/cache";
import Link from "next/link";
import { Banknote, CreditCard, Download, ExternalLink, MessageCircle, QrCode, Search, ShoppingCart } from "lucide-react";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { normalizePhone } from "@/lib/segments";
import { gql, ordersBetween, type Order } from "@/lib/store";
import { addDays, brl, dayRange, isoDayLocal } from "@/lib/time";
import { ErrorNote, Header } from "@/components/ui";

export const dynamic = "force-dynamic";

const SHIP: Record<string, [string, string]> = {
  FULFILLED: ["Postado", "c-k"], IN_TRANSIT: ["Em trânsito", "c-k"], OUT_FOR_DELIVERY: ["Saiu p/ entrega", "c-l"], DELIVERED: ["Entregue", "c-l"],
  ATTEMPTED_DELIVERY: ["Tentativa de entrega", "c-s"], READY_FOR_PICKUP: ["Pronto para retirar", "c-s"], CONFIRMED: ["Postado", "c-k"], LABEL_PRINTED: ["Etiqueta impressa", "c-n"],
  LABEL_PURCHASED: ["Etiqueta comprada", "c-n"], FAILURE: ["Problema na entrega", "c-c"], CANCELED: ["Cancelado", "c-n"], NOT_DELIVERED: ["Não entregue", "c-c"],
};
const PAY: Record<string, [string, string]> = { PAID: ["Pago", "c-l"], PENDING: ["Não pago", "c-c"], AUTHORIZED: ["Autorizado", "c-k"], PARTIALLY_PAID: ["Pago em parte", "c-s"], REFUNDED: ["Estornado", "c-n"], PARTIALLY_REFUNDED: ["Estorno parcial", "c-s"], VOIDED: ["Cancelado", "c-n"], EXPIRED: ["Expirado", "c-n"] };
function method(g: string | null): [string, typeof CreditCard] {
  const s = (g ?? "").toLowerCase();
  if (s.includes("pix")) return ["Pix", QrCode];
  if (s.includes("boleto")) return ["Boleto", Banknote];
  if (s.includes("cart") || s.includes("card") || s.includes("crédito") || s.includes("credito")) return ["Cartão", CreditCard];
  return [g ? g.split(" - ")[0].slice(0, 14) : "–", CreditCard];
}
const FILTERS: Record<string, [string, (o: Order) => boolean]> = {
  todos: ["Todos", () => true],
  pago: ["Pago", (o) => o.financial === "PAID" && !o.cancelled],
  pendente: ["Não pago", (o) => o.financial === "PENDING" && !o.cancelled],
  enviar: ["A enviar", (o) => o.financial === "PAID" && o.fulfillment === "UNFULFILLED" && !o.cancelled],
  transito: ["Em trânsito", (o) => !!o.shipStatus && !["DELIVERED"].includes(o.shipStatus)],
  entregue: ["Entregue", (o) => o.shipStatus === "DELIVERED"],
  cancelado: ["Cancelado", (o) => o.cancelled],
};

type Checkout = { id: string; createdAt: string; completedAt: string | null; abandonedCheckoutUrl: string; totalPriceSet: { shopMoney: { amount: string } }; customer: { displayName: string; defaultPhoneNumber: { phoneNumber: string } | null } | null; shippingAddress: { phone: string | null; firstName: string | null } | null; lineItems: { nodes: { title: string; quantity: number; image: { url: string } | null }[] } };

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; dias?: string; aba?: string }> }) {
  const sp = await searchParams;
  const dias = ["7", "30", "90"].includes(sp.dias ?? "") ? Number(sp.dias) : 30;
  const today = isoDayLocal();
  const aba = sp.aba === "carrinhos" ? "carrinhos" : "pedidos";
  let orders: Order[] = [];
  let carts: Checkout[] = [];
  let error: unknown = null;
  try {
    const since = dayRange(addDays(today, -(dias - 1))).start.toISOString();
    // pedidos e carrinhos ao mesmo tempo; carrinhos guardados por 1 minuto
    const ordersP = ordersBetween(dayRange(addDays(today, -(dias - 1))).start, dayRange(today).end);
    const d = await swr(`checkouts:${since.slice(0, 10)}`, 60_000, () => gql<{ abandonedCheckouts: { nodes: Checkout[] } }>(
      `query($q:String){ abandonedCheckouts(first:100, reverse:true, sortKey:CREATED_AT, query:$q){ nodes{ id createdAt completedAt abandonedCheckoutUrl totalPriceSet{shopMoney{amount}} customer{ displayName defaultPhoneNumber{phoneNumber} } shippingAddress{ phone firstName } lineItems(first:5){ nodes{ title quantity image{ url(transform:{maxWidth:96, maxHeight:96}) } } } } } }`,
      { q: `created_at:>='${since}'` },
    )).catch(() => null);
    orders = await ordersP;
    carts = (d?.abandonedCheckouts?.nodes ?? []).filter((c) => !c.completedAt);
  } catch (e) {
    error = e;
  }
  const q = (sp.q ?? "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const searched = q ? orders.filter((o) => `${o.name} ${o.customer} ${o.email ?? ""}`.toLowerCase().includes(q) || (digits.length >= 4 && (o.phone ?? "").replace(/\D/g, "").includes(digits))) : orders;
  const f = FILTERS[sp.f ?? ""] ? sp.f! : "todos";
  const list = searched.filter(FILTERS[f][1]);
  const cases = await db.recoveryCase.findMany({ where: { orderName: { in: list.filter((o) => o.financial === "PENDING").map((o) => o.name) } } });
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const href = (k: string, v?: string) => {
    const p = new URLSearchParams();
    const vals: Record<string, string | undefined> = { aba: sp.aba, f: sp.f, q: sp.q, dias: sp.dias, [k]: v };
    for (const [kk, vv] of Object.entries(vals)) if (vv) p.set(kk, vv);
    return `/pedidos${p.toString() ? `?${p}` : ""}`;
  };
  const Thumbs = ({ imgs, n }: { imgs: string[]; n: number }) => (
    <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
      <span className="thumbs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {imgs.slice(0, 3).map((u, i) => <img key={i} src={u} alt="" />)}
      </span>
      <span className="dim" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{n} produto{n > 1 ? "s" : ""}</span>
    </div>
  );

  return (
    <>
      <Header title="Pedidos" lede="Sincronizado com a Shopify. Pagamento, rastreio e conversa com o cliente num lugar só.">
        <form className="srch" action="/pedidos">
          <Search size={15} className="dim" />
          <input name="q" defaultValue={sp.q} placeholder="Pedido, nome, telefone ou e-mail" />
        </form>
        <a className="btn" href={`/api/export/pedidos?dias=${dias}`}><Download size={16} /> Exportar</a>
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="seg">
            <Link href={href("aba", undefined)} className={aba === "pedidos" ? "on" : ""}>Pedidos {orders.length}</Link>
            <Link href={href("aba", "carrinhos")} className={aba === "carrinhos" ? "on" : ""}>Carrinhos abandonados {carts.length}</Link>
          </div>
          {aba === "pedidos" && (
            <div className="chips">
              {Object.entries(FILTERS).map(([k, [l, fn]]) => <Link key={k} href={href("f", k === "todos" ? undefined : k)} className={f === k ? "on" : ""}>{l}<b>{searched.filter(fn).length}</b></Link>)}
            </div>
          )}
        </div>
        <div className="seg">{[["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"]].map(([k, l]) => <Link key={k} href={href("dias", k === "30" ? undefined : k)} className={String(dias) === k ? "on" : ""}>{l}</Link>)}</div>
      </div>

      <section className="pnl">
        {aba === "pedidos" ? (
          list.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="tb">
                <thead><tr><th>Pedido</th><th>Cliente</th><th>Produtos</th><th>Pagamento</th><th>Rastreio</th><th className="r">Valor</th><th>Data</th><th style={{ width: 50 }} /></tr></thead>
                <tbody>
                  {list.slice(0, 250).map((o) => {
                    const [m, MIcon] = method(o.gateway);
                    const pay = o.cancelled ? ["Cancelado", "c-n"] : PAY[o.financial] ?? [o.financial.toLowerCase(), "c-n"];
                    const rc = cases.find((c) => c.orderName === o.name);
                    const ship = o.shipStatus ? SHIP[o.shipStatus] ?? [o.shipStatus.toLowerCase(), "c-n"] : null;
                    const phone = normalizePhone(o.phone);
                    return (
                      <tr key={o.id} className={o.financial === "PENDING" && !o.cancelled ? "warn" : ""}>
                        <td><b style={{ fontWeight: 650 }}>{o.name}</b></td>
                        <td>
                          <b style={{ fontWeight: 600 }}>{o.customer}</b>
                          <div className="dim" style={{ fontSize: 12 }}>{[o.phone ? formatPhone(o.phone) : null, o.email].filter(Boolean).join(" · ") || [o.city, o.state].filter(Boolean).join(" / ")}</div>
                        </td>
                        <td><Thumbs imgs={o.images} n={o.lines.reduce((a, l) => a + l.quantity, 0)} /></td>
                        <td style={{ whiteSpace: "nowrap" }}><span className="row" style={{ gap: 6, flexWrap: "nowrap" }}><MIcon size={14} className="mut" /> {m} <span className={`chip ${pay[1]}`}>{pay[0]}</span></span></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {o.tracking ? (
                            <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                              {o.tracking.url ? <a className="trk" href={o.tracking.url} target="_blank" rel="noreferrer">{o.tracking.number} <ExternalLink size={11} /></a> : <span className="trk">{o.tracking.number}</span>}
                              {ship && <span className={`chip ${ship[1]}`}>{ship[0]}</span>}
                            </span>
                          ) : o.financial === "PENDING" && !o.cancelled ? (
                            <span className="mut" style={{ fontSize: 12.5 }}>{rc ? `em recuperação · msg ${rc.sentCount} de ${rc.kind === "pix" ? 2 : 3}` : "aguardando pagamento"}</span>
                          ) : o.cancelled ? <span className="dim">–</span> : <span className="mut" style={{ fontSize: 12.5 }}>aguardando postagem</span>}
                        </td>
                        <td className="r" style={{ whiteSpace: "nowrap" }}><b>{brl(o.total)}</b></td>
                        <td className="mut" style={{ whiteSpace: "nowrap" }}>{fmt.format(new Date(o.createdAt))}</td>
                        <td>{phone ? <Link className="wa-b" href={`/atendimento?tel=${phone}`} title="Conversar no WhatsApp"><MessageCircle size={15} /></Link> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {list.length > 250 && <div className="dim" style={{ fontSize: 12.5, padding: "12px 22px" }}>Mostrando 250 de {list.length}. Use a busca ou os filtros.</div>}
            </div>
          ) : !error && <div className="empty">Nenhum pedido neste filtro.</div>
        ) : carts.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="tb">
              <thead><tr><th>Cliente</th><th>Produtos</th><th className="r">Valor</th><th>Data</th><th>Recuperação</th><th style={{ width: 90 }} /></tr></thead>
              <tbody>
                {carts.map((c) => {
                  const phone = normalizePhone(c.customer?.defaultPhoneNumber?.phoneNumber ?? c.shippingAddress?.phone);
                  return (
                    <tr key={c.id}>
                      <td><b style={{ fontWeight: 600 }}>{c.shippingAddress?.firstName ?? c.customer?.displayName ?? "Sem nome"}</b><div className="dim" style={{ fontSize: 12 }}>{phone ? formatPhone(phone) : "sem telefone"}</div></td>
                      <td><Thumbs imgs={c.lineItems.nodes.map((l) => l.image?.url).filter((x): x is string => !!x)} n={c.lineItems.nodes.reduce((a, l) => a + l.quantity, 0)} /></td>
                      <td className="r"><b>{brl(Number(c.totalPriceSet.shopMoney.amount))}</b></td>
                      <td className="mut">{fmt.format(new Date(c.createdAt))}</td>
                      <td>{phone ? <span className="chip c-s">pode recuperar</span> : <span className="chip c-n">sem WhatsApp</span>}</td>
                      <td className="r">
                        <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <a className="menu-b" href={c.abandonedCheckoutUrl} target="_blank" rel="noreferrer" title="Abrir carrinho"><ShoppingCart size={15} /></a>
                          {phone && <Link className="wa-b" href={`/atendimento?tel=${phone}`} title="Conversar no WhatsApp"><MessageCircle size={15} /></Link>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">Nenhum carrinho abandonado no período.</div>}
      </section>
    </>
  );
}
