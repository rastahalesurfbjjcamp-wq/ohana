import { ExternalLink } from "lucide-react";
import { FINANCIAL, FULFILLMENT, recentOrders, type Order } from "@/lib/store";
import { brl } from "@/lib/time";
import { ErrorNote, Header, Kpi, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const FILTERS: Record<string, { label: string; q: string }> = {
  todos: { label: "Todos", q: "" },
  enviar: { label: "A enviar", q: "fulfillment_status:unfulfilled financial_status:paid" },
  pagamento: { label: "Aguardando pagamento", q: "financial_status:pending" },
  enviados: { label: "Enviados", q: "fulfillment_status:shipped" },
};

function origin(o: Order) {
  if (o.utm?.source) return `${o.utm.source}${o.utm.campaign ? " / " + o.utm.campaign : ""}`;
  const s = (o.firstSource ?? "").toLowerCase();
  if (!s) return "direto";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("facebook")) return "facebook";
  if (s.includes("google")) return "google";
  if (s.includes("linktr")) return "linktree";
  return s.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 24);
}

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "todos" } = await searchParams;
  const filter = FILTERS[f] ?? FILTERS.todos;
  let orders: Order[] = [];
  let error: unknown = null;
  try {
    orders = await recentOrders(100, filter.q);
  } catch (e) {
    error = e;
  }
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const toShip = orders.filter((o) => o.fulfillment === "UNFULFILLED" && o.financial === "PAID").length;
  const pending = orders.filter((o) => o.financial === "PENDING").length;

  return (
    <>
      <Header title="Pedidos" lede="Os últimos pedidos da loja, com pagamento, envio, rastreio e de onde a pessoa veio." />
      {error ? <ErrorNote error={error} /> : null}
      <div className="grid g4">
        <Kpi label="Pedidos listados" value={orders.length} />
        <Kpi label="A enviar" value={toShip} sub="pagos e ainda não enviados" />
        <Kpi label="Aguardando pagamento" value={pending} sub="Pix ou boleto em aberto" />
        <Kpi label="Valor listado" value={brl(orders.reduce((s, o) => s + o.subtotal, 0), 0)} />
      </div>
      <div className="tabs">
        {Object.entries(FILTERS).map(([k, v]) => (
          <a key={k} href={`/pedidos?f=${k}`} className={f === k ? "on" : ""}>{v.label}</a>
        ))}
      </div>
      <Panel title="Pedidos" body={false}>
        {orders.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="tb">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Itens</th>
                  <th className="r">Valor</th>
                  <th>Pagamento</th>
                  <th>Envio</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const fin = FINANCIAL[o.financial] ?? [o.financial.toLowerCase(), "c-n"];
                  const ful = FULFILLMENT[o.fulfillment] ?? [o.fulfillment.toLowerCase(), "c-n"];
                  return (
                    <tr key={o.id}>
                      <td>
                        <b style={{ fontWeight: 550 }}>{o.name}</b>
                        <div className="dim" style={{ fontSize: 12 }}>{fmt.format(new Date(o.createdAt))}</div>
                      </td>
                      <td>
                        {o.customer}
                        <div className="dim" style={{ fontSize: 12 }}>{[o.city, o.state].filter(Boolean).join(" / ")}</div>
                      </td>
                      <td className="mut" style={{ fontSize: 12.5, maxWidth: 260 }}>
                        {o.lines.map((l) => `${l.quantity}x ${l.title}${l.variant ? ` (${l.variant})` : ""}`).join(", ")}
                      </td>
                      <td className="r"><b>{brl(o.subtotal)}</b></td>
                      <td><span className={`chip ${o.cancelled ? "c-n" : fin[1]}`}>{o.cancelled ? "cancelado" : fin[0]}</span></td>
                      <td>
                        <span className={`chip ${ful[1]}`}>{ful[0]}</span>
                        {o.tracking && (
                          <div style={{ marginTop: 4 }}>
                            {o.tracking.url ? (
                              <a className="dim" style={{ fontSize: 12, display: "inline-flex", gap: 4, alignItems: "center" }} href={o.tracking.url} target="_blank" rel="noreferrer">
                                {o.tracking.number} <ExternalLink size={11} />
                              </a>
                            ) : (
                              <span className="dim" style={{ fontSize: 12 }}>{o.tracking.number}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="mut" style={{ fontSize: 12.5 }}>{origin(o)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !error && <div className="empty">Nenhum pedido neste filtro.</div>
        )}
      </Panel>
    </>
  );
}
