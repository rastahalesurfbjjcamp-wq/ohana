// Responde às consultas do Hub como a Shopify responderia, com os dados da loja fictícia.
import { ATHLETES, CUSTOMERS, DEMO_STORE, ORDERS, PRODUCTS, type DOrder } from "./data";

const money = (v: number) => ({ shopMoney: { amount: v.toFixed(2) }, amount: v.toFixed(2) });
const TZ = -3;
const localDay = (iso: string) => new Date(new Date(iso).getTime() + TZ * 3600_000).toISOString().slice(0, 10);

function rawOrder(o: DOrder) {
  const ship = o.shippedAt ? [{ createdAt: o.shippedAt, displayStatus: o.deliveredAt ? "DELIVERED" : "IN_TRANSIT", deliveredAt: o.deliveredAt, trackingInfo: [{ number: o.tracking, company: "Correios", url: `https://rastreamento.correios.com.br/app/index.php?objetos=${o.tracking}` }], events: { nodes: [{ status: o.deliveredAt ? "DELIVERED" : "IN_TRANSIT", message: o.deliveredAt ? "Objeto entregue ao destinatário" : "Objeto em trânsito", happenedAt: o.deliveredAt ?? o.shippedAt }] } }] : [];
  return {
    id: o.id, name: o.name, createdAt: o.createdAt, cancelledAt: o.cancelled ? o.createdAt : null,
    displayFinancialStatus: o.financial, displayFulfillmentStatus: o.fulfillment,
    currentSubtotalPriceSet: money(o.subtotal), currentTotalPriceSet: money(o.total), totalPriceSet: money(o.total),
    customer: { id: o.customer.id, displayName: o.customer.name },
    shippingAddress: { provinceCode: o.customer.state, city: o.customer.city, phone: `+${o.customer.phone}` },
    localizedFields: { nodes: [{ key: "TAX_CREDENTIAL_BR", value: o.customer.cpf }] },
    customerJourneySummary: { firstVisit: { source: o.firstSource, utmParameters: o.utm }, lastVisit: { source: o.firstSource, utmParameters: o.utm } },
    fulfillments: ship, paymentGatewayNames: [o.gateway], discountCodes: o.code ? [o.code] : [],
    email: o.customer.email, phone: `+${o.customer.phone}`,
    lineItems: { nodes: o.lines.map((l) => ({ title: l.p.title, variantTitle: l.size, quantity: l.qty, sku: `MA-${l.p.id.slice(-3)}-${l.size}`, discountedTotalSet: money(l.net), variant: { inventoryItem: { unitCost: { amount: l.p.cost.toFixed(2) } } }, image: null })) },
  };
}

// Filtros que o Hub usa na busca de pedidos
function filterOrders(q: string | null | undefined) {
  let list = ORDERS();
  if (!q) return list;
  const ge = q.match(/created_at:>='([^']+)'/)?.[1];
  const lt = q.match(/created_at:<'([^']+)'/)?.[1];
  if (ge) list = list.filter((o) => o.createdAt >= new Date(ge).toISOString());
  if (lt) list = list.filter((o) => o.createdAt < new Date(lt).toISOString());
  if (/-status:cancelled/.test(q)) list = list.filter((o) => !o.cancelled);
  if (/fulfillment_status:unfulfilled/.test(q)) list = list.filter((o) => o.fulfillment === "UNFULFILLED");
  if (/fulfillment_status:shipped/.test(q)) list = list.filter((o) => o.fulfillment === "FULFILLED");
  if (/financial_status:paid/.test(q)) list = list.filter((o) => o.financial === "PAID");
  const cid = q.match(/customer_id:(\d+)/)?.[1];
  if (cid) list = list.filter((o) => o.customer.id.endsWith(`/${cid}`));
  return list;
}

function page<T>(all: T[], first: number, after: string | null | undefined) {
  const start = after ? Number(after) : 0;
  const nodes = all.slice(start, start + first);
  const end = start + nodes.length;
  return { pageInfo: { hasNextPage: end < all.length, endCursor: String(end) }, nodes };
}

const productNode = (p: (typeof PRODUCTS)[number]) => ({
  id: p.id, title: p.title, status: "ACTIVE", totalInventory: p.stock.reduce((a, b) => a + b, 0), featuredMedia: null,
  variants: { nodes: p.sizes.map((s, k) => ({ id: `${p.id}/v${k}`, title: s, sku: `MA-${p.id.slice(-3)}-${s}`, price: p.price.toFixed(2), inventoryQuantity: p.stock[k], inventoryItem: { unitCost: { amount: p.cost.toFixed(2) } } })) },
});

function customerNodes() {
  const by = new Map<string, { n: number; spent: number; last: DOrder }>();
  for (const o of ORDERS()) {
    if (o.cancelled) continue;
    const c = by.get(o.customer.id) ?? { n: 0, spent: 0, last: o };
    c.n++; c.spent += o.subtotal; c.last = o; by.set(o.customer.id, c);
  }
  return CUSTOMERS.filter((c) => by.has(c.id)).map((c) => {
    const s = by.get(c.id)!;
    return {
      id: c.id, displayName: c.name, defaultEmailAddress: { emailAddress: c.email }, defaultPhoneNumber: { phoneNumber: `+${c.phone}` },
      numberOfOrders: String(s.n), amountSpent: { amount: s.spent.toFixed(2) },
      lastOrder: { createdAt: s.last.createdAt, shippingAddress: { phone: `+${c.phone}` } }, createdAt: c.createdAt,
      defaultAddress: { provinceCode: c.state, city: c.city, zip: "22000-000", phone: `+${c.phone}` }, tags: s.n >= 4 ? ["vip"] : [],
    };
  }).sort((a, b) => b.lastOrder.createdAt.localeCompare(a.lastOrder.createdAt));
}

/* ShopifyQL: FROM sales|sessions SHOW ... [WHERE discount_code = 'X'] [GROUP BY x | TIMESERIES x] SINCE a UNTIL b [ORDER BY c DESC] [LIMIT n] */
function shopifyql(q: string) {
  const from = q.match(/FROM\s+(\w+)/i)?.[1]?.toLowerCase() ?? "sales";
  const cols = (q.match(/SHOW\s+(.+?)(?:\s+WHERE|\s+GROUP BY|\s+TIMESERIES|\s+SINCE|$)/i)?.[1] ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const where = q.match(/WHERE\s+discount_code\s*=\s*'([^']+)'/i)?.[1];
  const group = q.match(/GROUP BY\s+(\w+)/i)?.[1];
  const ts = q.match(/TIMESERIES\s+(\w+)/i)?.[1];
  const since = q.match(/SINCE\s+(\S+)/i)?.[1] ?? "2020-01-01";
  const until = q.match(/UNTIL\s+(\S+)/i)?.[1] ?? "2999-01-01";
  const order = q.match(/ORDER BY\s+(\w+)(\s+ASC|\s+DESC)?/i);
  const limit = Number(q.match(/LIMIT\s+(\d+)/i)?.[1] ?? 0);
  const today = localDay(new Date().toISOString());
  const u = until === "today" ? today : until;
  const s0 = since.startsWith("-") ? localDay(new Date(Date.now() - parseInt(since.slice(1)) * 864e5).toISOString()) : since;
  const orders = ORDERS().filter((o) => { const d = localDay(o.createdAt); return d >= s0 && d <= u && !o.cancelled; });
  const keyOf = (o: DOrder, l?: DOrder["lines"][number]) => {
    const g = group ?? ts;
    if (!g) return "_";
    if (g === "day") return localDay(o.createdAt);
    if (g === "month") return `${localDay(o.createdAt).slice(0, 7)}-01`;
    if (g === "week") return localDay(o.createdAt);
    if (g === "discount_code") return o.code ?? "";
    if (g === "product_title") return l?.p.title ?? "";
    if (g === "session_device_type") return "mobile";
    return "_";
  };
  type Acc = Record<string, number>;
  const acc = new Map<string, Acc>();
  const add = (k: string, f: Partial<Acc>) => { const a = acc.get(k) ?? {}; for (const [x, v] of Object.entries(f)) a[x] = (a[x] ?? 0) + (v ?? 0); acc.set(k, a); };
  if (from === "sessions") {
    // visitas: cerca de 110 por pedido, a maior parte no celular
    const days = new Map<string, number>();
    for (const o of orders) days.set(localDay(o.createdAt), (days.get(localDay(o.createdAt)) ?? 0) + 1);
    for (let d = new Date(s0 + "T12:00:00Z"); localDay(d.toISOString()) <= u && d.getTime() <= Date.now(); d = new Date(d.getTime() + 864e5)) {
      const day = d.toISOString().slice(0, 10);
      const n = days.get(day) ?? 0;
      const sess = Math.round(n * 105 + 180 + (day.charCodeAt(9) % 7) * 23);
      const parts = group === "session_device_type" ? [["mobile", 0.79], ["desktop", 0.19], ["tablet", 0.02]] as [string, number][] : [[group === "day" ? day : "_", 1]] as [string, number][];
      for (const [k, w] of parts) add(k, { sessions: Math.round(sess * w), sessions_with_cart_additions: Math.round(sess * w * 0.075), sessions_that_reached_checkout: Math.round(sess * w * 0.032), sessions_that_completed_checkout: Math.round(n * w), online_store_visitors: Math.round(sess * w * 0.82) });
    }
  } else {
    for (const o of orders) {
      if (where && (o.code ?? "").toUpperCase() !== where.toUpperCase()) continue;
      if (group === "product_title") {
        for (const l of o.lines) add(keyOf(o, l), { net_items_sold: o.refunded ? 0 : l.qty, gross_sales: l.gross, discounts: -(l.gross - l.net), net_sales: o.refunded ? 0 : l.net, orders: 1 });
      } else {
        add(keyOf(o), { orders: 1, gross_sales: o.gross, discounts: -o.discount, sales_reversals: o.refunded ? -(o.gross - o.discount) : 0, returns: o.refunded ? -(o.gross - o.discount) : 0, net_sales: o.refunded ? 0 : o.subtotal, shipping_charges: o.refunded ? 0 : o.shipping, shipping: o.refunded ? 0 : o.shipping, taxes: 0, total_sales: o.refunded ? 0 : o.subtotal + o.shipping, net_items_sold: o.refunded ? 0 : o.lines.reduce((a, l) => a + l.qty, 0) });
      }
    }
  }
  // série completa (meses ou dias sem venda aparecem com zero)
  if (ts === "month" || ts === "day") {
    for (let d = new Date(s0 + "T12:00:00Z"); d.toISOString().slice(0, 10) <= u; d = new Date(d.getTime() + 864e5)) {
      const k = ts === "month" ? `${d.toISOString().slice(0, 7)}-01` : d.toISOString().slice(0, 10);
      if (!acc.has(k)) acc.set(k, {});
    }
  }
  const dim = group ?? ts;
  let rows = [...acc.entries()].map(([k, a]) => {
    const row: Record<string, string> = {};
    if (dim) row[dim] = k;
    for (const c of cols) {
      if (c === "conversion_rate") row[c] = String((a.sessions ? (a.sessions_that_completed_checkout ?? 0) / a.sessions : 0).toFixed(4));
      else if (c === "average_order_value") row[c] = String(a.orders ? ((a.net_sales ?? 0) / a.orders).toFixed(2) : 0);
      else row[c] = String(Math.round((a[c] ?? 0) * 100) / 100);
    }
    return row;
  });
  if (ts || group === "day") rows.sort((a, b) => String(a[dim!]).localeCompare(String(b[dim!])));
  if (order) { const c = order[1]; const desc = !/asc/i.test(order[2] ?? ""); rows.sort((a, b) => (Number(a[c]) - Number(b[c])) * (desc ? -1 : 1)); }
  if (limit) rows = rows.slice(0, limit);
  const columns = [...(dim ? [{ name: dim, dataType: "STRING", displayName: dim }] : []), ...cols.map((c) => ({ name: c, dataType: "NUMBER", displayName: c }))];
  return { shopifyqlQuery: { tableData: { columns, rows, rowMetadata: [] }, parseErrors: [], parseWarnings: [], analyticsTargets: [] } };
}

let seq = 1;
const ok = (key: string, node: Record<string, unknown>) => ({ [key]: { ...node, userErrors: [] } });

export function demoShopify(query: string, v: Record<string, unknown> = {}): { data?: unknown; errors?: unknown } {
  const q = query.replace(/\s+/g, " ");
  if (/shopifyqlQuery/.test(q)) return { data: shopifyql(String(v.q ?? "")) };
  // escritas: sempre dão certo na demonstração
  if (/^ ?mutation/.test(q) || /^mutation/.test(q.trim())) {
    const name = q.match(/\{ ?(\w+)\(/)?.[1] ?? "op";
    const id = `gid://shopify/DiscountCodeNode/${880000 + seq++}`;
    if (name === "segmentCreate") return { data: ok(name, { segment: { id: "gid://shopify/Segment/1" } }) };
    if (name === "customerCreate") return { data: ok(name, { customer: { id: `gid://shopify/Customer/${99000 + seq}` } }) };
    if (name === "draftOrderCreate") return { data: ok(name, { draftOrder: { id: `gid://shopify/DraftOrder/${700 + seq}` } }) };
    if (name === "draftOrderComplete") { const n = 30000 + seq; return { data: ok(name, { draftOrder: { order: { id: `gid://shopify/Order/${n}`, name: `#${n}` } } }) }; }
    if (name.startsWith("discountAutomatic")) return { data: ok(name, { automaticDiscountNode: { id: "gid://shopify/DiscountAutomaticNode/1" } }) };
    return { data: ok(name, { codeDiscountNode: { id } }) };
  }
  if (/codeDiscountNodeByCode/.test(q)) {
    const code = String(v.c ?? v.code ?? "").toUpperCase();
    const a = ATHLETES.find((x) => x.code === code);
    return { data: { codeDiscountNodeByCode: a ? { id: `gid://shopify/DiscountCodeNode/77${ATHLETES.indexOf(a)}`, codeDiscount: { __typename: "DiscountCodeBasic", title: a.code, customerGets: { value: { __typename: "DiscountPercentage", percentage: a.pct / 100 } }, minimumRequirement: null } } : null } };
  }
  if (/discountNodes/.test(q)) {
    return { data: { discountNodes: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [...ATHLETES.map((a, i) => ({ id: `gid://shopify/DiscountCodeNode/77${i}`, discount: { __typename: "DiscountCodeBasic", title: a.code, status: "ACTIVE", codes: { nodes: [{ code: a.code }] }, customerGets: { value: { __typename: "DiscountPercentage", percentage: a.pct / 100 } } } })), { id: "gid://shopify/DiscountCodeNode/790", discount: { __typename: "DiscountCodeBasic", title: "COMUNIDADE10", status: "ACTIVE", codes: { nodes: [{ code: "COMUNIDADE10" }] }, customerGets: { value: { __typename: "DiscountPercentage", percentage: 0.1 } } } }] } } };
  }
  if (/abandonedCheckouts/.test(q)) {
    const recent = ORDERS().slice(-60);
    const nodes = recent.filter((_, i) => i % 5 === 0).map((o, i) => ({ id: `gid://shopify/AbandonedCheckout/${3000 + i}`, createdAt: new Date(new Date(o.createdAt).getTime() - 3600_000).toISOString(), completedAt: null, abandonedCheckoutUrl: "#", totalPriceSet: money(o.total), customer: { displayName: CUSTOMERS[(i * 31) % CUSTOMERS.length].name, defaultPhoneNumber: { phoneNumber: `+${CUSTOMERS[(i * 31) % CUSTOMERS.length].phone}` } }, shippingAddress: { phone: null, firstName: CUSTOMERS[(i * 31) % CUSTOMERS.length].name.split(" ")[0] }, lineItems: { nodes: o.lines.map((l) => ({ title: l.p.title, quantity: l.qty, image: null })) } }));
    return { data: { abandonedCheckouts: { nodes } } };
  }
  if (/\borders ?\(/.test(q)) {
    const list = filterOrders(v.q as string | undefined).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const first = Number(v.n ?? q.match(/orders\(first: ?(\d+)/)?.[1] ?? 50);
    return { data: { orders: page(list.map(rawOrder), first, v.after as string | undefined) } };
  }
  if (/\bproducts ?\(/.test(q)) return { data: { products: page(PRODUCTS.map(productNode), 100, v.after as string | undefined) } };
  if (/\bcustomers ?\(/.test(q)) {
    const all = customerNodes();
    const qq = String(v.q ?? "");
    const em = qq.match(/email:(\S+)/)?.[1];
    const ph = qq.match(/phone:\+?(\d+)/)?.[1];
    let list = em ? all.filter((c) => c.defaultEmailAddress.emailAddress === em) : ph ? all.filter((c) => c.defaultPhoneNumber.phoneNumber.endsWith(ph.slice(-11))) : all;
    if (/AMOUNT_SPENT|TOTAL_SPENT/.test(q)) list = [...list].sort((a, b) => Number(b.amountSpent.amount) - Number(a.amountSpent.amount));
    const first = Number(v.n ?? q.match(/customers\(first: ?(\d+)/)?.[1] ?? 250);
    return { data: { customers: page(list, first, v.after as string | undefined) } };
  }
  if (/\bshop ?\{/.test(q)) return { data: { shop: { name: DEMO_STORE, createdAt: new Date(Date.now() - 425 * 864e5).toISOString(), currencyCode: "BRL", myshopifyDomain: "mare-alta-demo.myshopify.com" } } };
  if (/\bcustomer ?\(/.test(q)) return { data: { customer: null } };
  return { data: {} };
}
