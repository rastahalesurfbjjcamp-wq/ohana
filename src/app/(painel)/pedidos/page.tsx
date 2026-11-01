import { swr } from "@/lib/cache";
import Link from "next/link";
import { Banknote, ChevronDown, CreditCard, Download, ExternalLink, LayoutGrid, List, MessageCircle, QrCode, Search, ShoppingCart } from "lucide-react";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { normalizePhone } from "@/lib/segments";
import { gql, ordersBetween, type Order } from "@/lib/store";
import { addDays, brl, dayRange, isoDayLocal } from "@/lib/time";
import { ErrorNote, Header } from "@/components/ui";
import { QuickButtons } from "@/components/QuickButtons";
import { quickMessages, sentFor } from "@/lib/quick";
import { metaFor, orderStatuses } from "@/lib/orderMeta";
import { Stop } from "@/components/Stop";
import { Kanban, OrderControls, StatusEditor, type Card } from "./OrderControls";

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
  return [g ? g.split(" - ")[0].slice(0, 14) : "-", CreditCard];
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

const dueOf = (o: Order) => isoDayLocal(new Date(new Date(o.createdAt).getTime() + 3 * 864e5));
const isBoleto = (o: Order) => (o.gateway ?? "").toLowerCase().includes("boleto");
const isCard = (o: Order) => /cart|card|crédito|credito/.test((o.gateway ?? "").toLowerCase());
const ATALHOS: Record<string, [string, (o: Order, today: string) => boolean]> = {
  pix_pendente: ["Pix pendente", (o) => !o.cancelled && o.financial === "PENDING" && (o.gateway ?? "").toLowerCase().includes("pix")],
  cartao_recusado: ["Cartão recusado", (o) => !o.cancelled && o.financial !== "PAID" && isCard(o)],
  boleto_hoje: ["Boleto vence hoje", (o, t) => !o.cancelled && o.financial === "PENDING" && isBoleto(o) && dueOf(o) === t],
  boleto_amanha: ["Boleto vence amanhã", (o, t) => !o.cancelled && o.financial === "PENDING" && isBoleto(o) && dueOf(o) === addDays(t, 1)],
  boleto_vencido: ["Boleto vencido", (o, t) => !o.cancelled && o.financial === "PENDING" && isBoleto(o) && dueOf(o) < t],
  sem_rastreio: ["Pago sem rastreio há +2 dias", (o) => !o.cancelled && o.financial === "PAID" && !o.tracking && Date.now() - new Date(o.createdAt).getTime() > 2 * 864e5],
};

type Checkout = { id: string; createdAt: string; completedAt: string | null; abandonedCheckoutUrl: string; totalPriceSet: { shopMoney: { amount: string } }; customer: { displayName: string; defaultPhoneNumber: { phoneNumber: string } | null } | null; shippingAddress: { phone: string | null; firstName: string | null } | null; lineItems: { nodes: { title: string; quantity: number; image: { url: string } | null }[] } };

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; dias?: string; aba?: string; met?: string; st?: string; resp?: string; arq?: string; at?: string; v?: string; cf?: string }> }) {
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
      `query($q:String){ abandonedCheckouts(first:100, reverse:true, sortKey:CREATED_AT, query:$q){ nodes{ id createdAt completedAt abandonedCheckoutUrl totalPriceSet{shopMoney{amount}} customer{ displayName defaultPhoneNumber{phoneNumber} } shippingAddress{ phone firstName } lineItems(first:5){ nodes{ title quantity image{ url(transform:{maxWidth:640, maxHeight:640}) } } } } } }`,
      { q: `created_at:>='${since}'` },
    )).catch(() => null);
    orders = await ordersP;
    carts = d?.abandonedCheckouts?.nodes ?? [];
  } catch (e) {
    error = e;
  }
  const q = (sp.q ?? "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const searched = q ? orders.filter((o) => `${o.name} ${o.customer} ${o.email ?? ""}`.toLowerCase().includes(q) || (digits.length >= 4 && (o.phone ?? "").replace(/\D/g, "").includes(digits))) : orders;
  const f = FILTERS[sp.f ?? ""] ? sp.f! : "todos";
  const [statuses, users, meta] = await Promise.all([
    orderStatuses(),
    db.user.findMany({ select: { name: true } }).then((u) => u.map((x) => x.name).filter(Boolean)).catch(() => [] as string[]),
    metaFor([...orders.map((o) => o.id), ...carts.map((c) => c.id)]),
  ]);
  const M = (id: string) => meta.get(id) ?? { status: null, assignee: null, flagged: false, archived: false, note: null };
  const byMethod = (o: Order) => !sp.met || (sp.met === "pix" ? (o.gateway ?? "").toLowerCase().includes("pix") : sp.met === "boleto" ? isBoleto(o) : isCard(o));
  const side = searched.filter((o) => (sp.arq ? M(o.id).archived : !M(o.id).archived) && byMethod(o) && (!sp.st || (sp.st === "_sem" ? !M(o.id).status : M(o.id).status === sp.st)) && (!sp.resp || M(o.id).assignee === sp.resp) && (!sp.at || !ATALHOS[sp.at] || ATALHOS[sp.at][1](o, today)));
  const list = side.filter(FILTERS[f][1]);
  const view = sp.v === "quadro" ? "quadro" : "lista";
  const cf = sp.cf ?? "todos";
  carts = carts.filter((c) => Number(c.totalPriceSet.shopMoney.amount) > 0 && c.lineItems.nodes.length > 0);
  const cartList = carts.filter((c) => (cf === "abandonados" ? !c.completedAt : cf === "recuperados" ? !!c.completedAt : true) && (sp.arq ? M(c.id).archived : !M(c.id).archived) && (!q || `${c.customer?.displayName ?? ""} ${c.shippingAddress?.phone ?? ""} ${c.customer?.defaultPhoneNumber?.phoneNumber ?? ""}`.toLowerCase().includes(q)));
  const [cases, qmsgs, sent] = await Promise.all([
    db.recoveryCase.findMany({ where: { orderName: { in: list.filter((o) => o.financial === "PENDING").map((o) => o.name) } } }),
    quickMessages().then((x) => x.filter((m) => m.active)).catch(() => []),
    sentFor(aba === "pedidos" ? list.slice(0, 250).map((o) => o.id) : carts.map((c) => c.id)).catch(() => new Map()),
  ]);
  const stage = (o: Order) => (o.cancelled ? "cancelado" : o.financial === "PENDING" ? "pendente" : o.tracking ? "enviado" : "pago");
  const orderMsgs = (o: Order) => qmsgs.filter((m) => m.kind === "pedido" && (m.show === "todos" || m.show === stage(o))).map((m) => ({ id: m.id, name: m.name }));
  const cartMsgs = qmsgs.filter((m) => m.kind === "carrinho").map((m) => ({ id: m.id, name: m.name }));
  const sentOf = (id: string) => ((sent.get(id) ?? []) as { messageId: string; at: Date; by: string | null; error: string | null }[]).map((x) => ({ ...x, at: x.at.toISOString() }));
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const href = (k: string, v?: string) => {
    const p = new URLSearchParams();
    const vals: Record<string, string | undefined> = { aba: sp.aba, f: sp.f, q: sp.q, dias: sp.dias, met: sp.met, st: sp.st, resp: sp.resp, arq: sp.arq, at: sp.at, v: sp.v, cf: sp.cf, [k]: v };
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

  const Side = ({ k, v, label, n }: { k: string; v?: string; label: string; n?: number }) => {
    const on = (sp as Record<string, string | undefined>)[k] === v || (!v && !(sp as Record<string, string | undefined>)[k]);
    return <Link href={href(k, on && v ? undefined : v)} className={`ps-i${on && v ? " on" : ""}`}>{label}{n !== undefined && <small>{n}</small>}</Link>;
  };
  const cardOf = (o: Order): Card => {
    const pay = o.cancelled ? ["Cancelado", "c-n"] : PAY[o.financial] ?? [o.financial.toLowerCase(), "c-n"];
    return { id: o.id, status: M(o.id).status, title: `${o.name} · ${o.customer}`, sub: `${o.lines.reduce((x, l) => x + l.quantity, 0)} itens · ${fmt.format(new Date(o.createdAt))}`, value: brl(o.total), chip: [pay[0], pay[1]] as [string, string], flagged: M(o.id).flagged };
  };

  return (
    <>
      <Header title="Pedidos" lede="Sincronizado com a Shopify. Pagamento, rastreio, status próprio e conversa com o cliente num lugar só.">
        <form className="srch" action="/pedidos">
          {sp.aba && <input type="hidden" name="aba" value={sp.aba} />}
          <Search size={15} className="dim" />
          <input name="q" defaultValue={sp.q} placeholder="Pedido, nome, telefone ou e-mail" />
        </form>
        <a className="btn" href={`/api/export/pedidos?dias=${dias}`}><Download size={16} /> Exportar</a>
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="seg">
          <Link href={href("aba", undefined)} className={aba === "pedidos" ? "on" : ""}>Pedidos {orders.length}</Link>
          <Link href={href("aba", "carrinhos")} className={aba === "carrinhos" ? "on" : ""}>Carrinhos abandonados {carts.length}</Link>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {aba === "pedidos" && <StatusEditor statuses={statuses} />}
          {aba === "pedidos" && <div className="seg"><Link href={href("v", undefined)} className={view === "lista" ? "on" : ""}><List size={14} /> Lista</Link><Link href={href("v", "quadro")} className={view === "quadro" ? "on" : ""}><LayoutGrid size={14} /> Quadro</Link></div>}
          <div className="seg">{[["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"]].map(([k, l]) => <Link key={k} href={href("dias", k === "30" ? undefined : k)} className={String(dias) === k ? "on" : ""}>{l}</Link>)}</div>
        </div>
      </div>

      <div className="ped">
        <aside className="ps">
          {aba === "pedidos" ? (
            <>
              <div className="ps-g">Pagamento</div>
              {Object.entries(FILTERS).map(([k, [l, fn]]) => <Link key={k} href={href("f", k === "todos" ? undefined : k)} className={`ps-i${f === k ? " on" : ""}`}>{l}<small>{side.filter(fn).length}</small></Link>)}
              <div className="ps-g">Método</div>
              <Side k="met" v="cartao" label="Cartão" /><Side k="met" v="pix" label="Pix" /><Side k="met" v="boleto" label="Boleto" />
              <div className="ps-g">Atalhos</div>
              {Object.entries(ATALHOS).map(([k, [l, fn]]) => <Side key={k} k="at" v={k} label={l} n={searched.filter((o) => fn(o, today)).length} />)}
              <div className="ps-g">Status</div>
              <Side k="st" v="_sem" label="Sem status" />
              {statuses.map((x) => <Link key={x.id} href={href("st", sp.st === x.id ? undefined : x.id)} className={`ps-i${sp.st === x.id ? " on" : ""}`}><span><i className="ps-dot" style={{ background: x.color }} />{x.label}</span><small>{orders.filter((o) => M(o.id).status === x.id).length}</small></Link>)}
              {users.length > 0 && <><div className="ps-g">Responsável</div>{users.map((u) => <Side key={u} k="resp" v={u} label={u} />)}</>}
            </>
          ) : (
            <>
              <div className="ps-g">Carrinhos</div>
              <Side k="cf" v="abandonados" label="Abandonados" n={carts.filter((c) => !c.completedAt).length} />
              <Side k="cf" v="recuperados" label="Recuperados" n={carts.filter((c) => c.completedAt).length} />
              <div className="dim" style={{ fontSize: 11.5, padding: "8px 10px" }}>Carrinhos sem produto ou de R$ 0 ficam escondidos.</div>
            </>
          )}
          <div className="ps-g">Outros</div>
          <Side k="arq" v="1" label="Ver arquivados" />
          {(sp.met || sp.st || sp.resp || sp.arq || sp.at || sp.f || sp.cf) && <Link className="ps-i" href={`/pedidos${aba === "carrinhos" ? "?aba=carrinhos" : ""}`} style={{ color: "var(--coral)" }}>Limpar filtros</Link>}
        </aside>

        <div style={{ minWidth: 0 }}>
          {aba === "pedidos" && view === "quadro" ? (
            <Kanban cards={list.slice(0, 300).map(cardOf)} statuses={statuses} />
          ) : (
            <section className="pnl">
              {aba === "pedidos" ? (
                list.length ? (
                  <div className="po-list">
                    {list.slice(0, 250).map((o) => {
                      const [m, MIcon] = method(o.gateway);
                      const pay = o.cancelled ? ["Cancelado", "c-n"] : PAY[o.financial] ?? [o.financial.toLowerCase(), "c-n"];
                      const rc = cases.find((c) => c.orderName === o.name);
                      const ship = o.shipStatus ? SHIP[o.shipStatus] ?? [o.shipStatus.toLowerCase(), "c-n"] : null;
                      const phone = normalizePhone(o.phone);
                      const mt = M(o.id);
                      return (
                        <details key={o.id} className={`po${o.cancelled ? " po-off" : o.financial === "PAID" ? " po-ok" : " po-bad"}`}>
                          <summary>
                            <div className="po-a">
                              <OrderControls refId={o.id} meta={mt} statuses={statuses} users={users} />
                              <span className="po-n"><b>{o.name}</b><small className="row" style={{ gap: 4 }}><MIcon size={12} /> {m}</small></span>
                            </div>
                            <div className="po-c">
                              <b>{o.customer}</b>
                              <small>{[o.phone ? formatPhone(o.phone) : null, o.email].filter(Boolean).join(" · ") || [o.city, o.state].filter(Boolean).join(" / ")}</small>
                              {!o.cancelled && <Stop><QuickButtons msgs={orderMsgs(o)} refId={o.id} phone={phone} sent={sentOf(o.id)} ctx={{ nome: o.customer, produtos: o.lines.map((l) => `${l.quantity > 1 ? `${l.quantity}x ` : ""}${l.title}${l.variant ? ` (${l.variant})` : ""}`).join(", "), valor: brl(o.total), link: o.statusUrl ?? "", pedido: o.name, rastreio: o.tracking?.url ?? o.tracking?.number ?? "", imagem: o.images[0] }} /></Stop>}
                            </div>
                            <Thumbs imgs={o.images} n={o.lines.reduce((x, l) => x + l.quantity, 0)} />
                            <div className="po-t">
                              {o.tracking ? (
                                <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                  <span className="trk">{o.tracking.number}</span>
                                  {ship && <span className={`chip ${ship[1]}`}>{ship[0]}</span>}
                                </span>
                              ) : o.financial === "PENDING" && !o.cancelled ? (
                                <small className="mut">{rc ? `em recuperação · msg ${rc.sentCount} de ${rc.kind === "pix" ? 2 : 3}` : isBoleto(o) ? `boleto vence ${dueOf(o).split("-").reverse().slice(0, 2).join("/")}` : "aguardando pagamento"}</small>
                              ) : o.cancelled ? null : <small className="mut">aguardando postagem</small>}
                            </div>
                            <div className="po-v"><b>{brl(o.total)}</b><span className={`chip ${pay[1]}`}>{pay[0]}</span></div>
                            <div className="po-d"><small>{fmt.format(new Date(o.createdAt))}</small>{phone ? <Link className="wa-b" href={`/atendimento?tel=${phone}`} title="Conversar no WhatsApp"><MessageCircle size={15} /></Link> : null}<ChevronDown size={15} className="dim po-chev" /></div>
                          </summary>
                          <div className="po-x">
                            <div className="po-box"><small>Entrega</small><div>{o.address ?? ([o.city, o.state].filter(Boolean).join(" / ") || "Sem endereço")}</div>{o.cpf && <div className="dim" style={{ fontSize: 12 }}>CPF {o.cpf}</div>}</div>
                            <div className="po-box" style={{ flex: 2 }}>
                              <small>Produtos ({o.lines.reduce((x, l) => x + l.quantity, 0)})</small>
                              {o.lines.map((l, i) => <div key={i} className="po-line">{/* eslint-disable-next-line @next/next/no-img-element */}{o.images[i] && <img src={o.images[i]} alt="" />}<span>{l.quantity}× {l.title}{l.variant ? <em> · {l.variant}</em> : null}</span><b>{brl(l.revenue)}</b></div>)}
                              {o.codes.length > 0 && <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>Cupom: {o.codes.join(", ")}</div>}
                            </div>
                            <div className="po-box">
                              <small>Rastreio</small>
                              {o.tracking ? <>{o.tracking.company && <div>{o.tracking.company}</div>}{o.tracking.url ? <a className="trk" href={o.tracking.url} target="_blank" rel="noreferrer">{o.tracking.number} <ExternalLink size={11} /></a> : <div>{o.tracking.number}</div>}</> : <div className="dim">Ainda sem rastreio</div>}
                              {o.statusUrl && <a href={o.statusUrl} target="_blank" rel="noreferrer" className="dim" style={{ fontSize: 12, textDecoration: "underline", display: "block", marginTop: 6 }}>Página do pedido</a>}
                            </div>
                          </div>
                        </details>
                      );
                    })}
                    {list.length > 250 && <div className="dim" style={{ fontSize: 12.5, padding: "12px 22px" }}>Mostrando 250 de {list.length}. Use a busca ou os filtros.</div>}
                  </div>
                ) : !error && <div className="empty">Nenhum pedido neste filtro.</div>
              ) : cartList.length ? (
                <div className="po-list">
                  {cartList.map((c) => {
                    const phone = normalizePhone(c.customer?.defaultPhoneNumber?.phoneNumber ?? c.shippingAddress?.phone);
                    return (
                      <div key={c.id} className={`po flat${c.completedAt ? " po-ok" : ""}`}>
                        <div className="po-row">
                          <div className="po-a"><OrderControls refId={c.id} meta={M(c.id)} statuses={statuses} users={users} kind="carrinho" /></div>
                          <div className="po-c">
                            <b>{c.customer?.displayName ?? c.shippingAddress?.firstName ?? "Sem nome"}</b>
                            <small>{phone ? formatPhone(phone) : "sem telefone"}</small>
                            <QuickButtons msgs={cartMsgs} refId={c.id} phone={phone} sent={sentOf(c.id)} ctx={{ nome: c.customer?.displayName ?? c.shippingAddress?.firstName ?? "", produtos: c.lineItems.nodes.map((l) => `${l.quantity > 1 ? `${l.quantity}x ` : ""}${l.title}`).join(", "), valor: brl(Number(c.totalPriceSet.shopMoney.amount)), link: c.abandonedCheckoutUrl, imagem: c.lineItems.nodes.find((l) => l.image)?.image?.url }} />
                          </div>
                          <Thumbs imgs={c.lineItems.nodes.map((l) => l.image?.url).filter((x): x is string => !!x)} n={c.lineItems.nodes.reduce((x, l) => x + l.quantity, 0)} />
                          <div className="po-t"><small className="dim">{c.lineItems.nodes.map((l) => l.title).join(", ").slice(0, 80)}</small></div>
                          <div className="po-v"><b>{brl(Number(c.totalPriceSet.shopMoney.amount))}</b>{c.completedAt ? <span className="chip c-l">Recuperado</span> : <span className="chip c-n">Abandonado</span>}</div>
                          <div className="po-d"><small>{fmt.format(new Date(c.createdAt))}</small>
                            <a className="menu-b" href={c.abandonedCheckoutUrl} target="_blank" rel="noreferrer" title="Abrir carrinho"><ShoppingCart size={15} /></a>
                            {phone && <Link className="wa-b" href={`/atendimento?tel=${phone}`} title="Conversar no WhatsApp"><MessageCircle size={15} /></Link>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="empty">Nenhum carrinho neste filtro.</div>}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
