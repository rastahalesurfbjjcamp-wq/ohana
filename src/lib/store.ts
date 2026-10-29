// Dados da loja na Shopify para as telas do painel (pedidos, produtos, clientes, conversão).
// Leituras com cache curto em memória para as telas abrirem rápido.
import { creds } from "./integrations";

const API_VERSION = "2025-10";

export async function hasShopify() {
  const c = (await creds()).shopify;
  return !!c.domain && !!c.token;
}

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { domain, token } = (await creds()).shopify;
  if (!domain || !token) throw new Error("SHOPIFY_NAO_CONFIGURADA");
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (!res.ok || json.errors) throw new Error(`Shopify: ${JSON.stringify(json.errors ?? res.status).slice(0, 300)}`);
  return json.data as T;
}

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const money = (m?: { shopMoney?: { amount: string } } | { amount: string } | null) =>
  Number((m && ("shopMoney" in m ? m.shopMoney?.amount : (m as { amount: string }).amount)) ?? 0);

/* Pedidos */
export interface OrderLine {
  title: string;
  variant: string;
  sku: string | null;
  quantity: number;
  revenue: number;
  unitCost: number | null;
}
export interface Order {
  id: string;
  name: string;
  createdAt: string;
  financial: string;
  fulfillment: string;
  subtotal: number;
  total: number;
  customer: string;
  state: string | null;
  city: string | null;
  firstSource: string | null;
  utm: { source?: string; medium?: string; campaign?: string; content?: string } | null;
  tracking: { number: string; company: string | null; url: string | null } | null;
  lines: OrderLine[];
  cancelled: boolean;
  gateway: string | null;
  email: string | null;
  phone: string | null;
  images: string[];
  shipStatus: string | null;
}

type RawOrder = {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  currentSubtotalPriceSet: { shopMoney: { amount: string } };
  currentTotalPriceSet: { shopMoney: { amount: string } };
  customer: { displayName: string } | null;
  shippingAddress: { provinceCode: string | null; city: string | null } | null;
  customerJourneySummary: {
    firstVisit: { source: string | null; utmParameters: Record<string, string | null> | null } | null;
    lastVisit: { source: string | null; utmParameters: Record<string, string | null> | null } | null;
  } | null;
  fulfillments: { displayStatus: string | null; trackingInfo: { number: string; company: string | null; url: string | null }[] }[];
  paymentGatewayNames: string[] | null;
  email: string | null;
  phone: string | null;
  lineItems: {
    nodes: {
      title: string;
      variantTitle: string | null;
      quantity: number;
      sku: string | null;
      discountedTotalSet: { shopMoney: { amount: string } };
      variant: { inventoryItem: { unitCost: { amount: string } | null } | null } | null;
      image: { url: string } | null;
    }[];
  };
};

const ORDER_FIELDS = `id name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus
  currentSubtotalPriceSet{shopMoney{amount}} currentTotalPriceSet{shopMoney{amount}}
  customer{displayName} shippingAddress{provinceCode city}
  customerJourneySummary{ firstVisit{ source utmParameters{source medium campaign content} } lastVisit{ source utmParameters{source medium campaign content} } }
  fulfillments(first:3){ displayStatus trackingInfo{number company url} }
  paymentGatewayNames email phone
  lineItems(first:50){ nodes{ title variantTitle quantity sku discountedTotalSet{shopMoney{amount}} variant{ inventoryItem{ unitCost{amount} } } image{ url(transform:{maxWidth:96, maxHeight:96}) } } }`;

function mapOrder(o: RawOrder): Order {
  const visit = o.customerJourneySummary?.lastVisit?.utmParameters ? o.customerJourneySummary.lastVisit : o.customerJourneySummary?.firstVisit;
  const utm = visit?.utmParameters
    ? Object.fromEntries(Object.entries(visit.utmParameters).filter(([, v]) => !!v).map(([k, v]) => [k, String(v).toLowerCase()]))
    : null;
  const tr = o.fulfillments.flatMap((f) => f.trackingInfo)[0] ?? null;
  return {
    id: o.id,
    name: o.name,
    createdAt: o.createdAt,
    financial: o.displayFinancialStatus,
    fulfillment: o.displayFulfillmentStatus,
    subtotal: money(o.currentSubtotalPriceSet),
    total: money(o.currentTotalPriceSet),
    customer: o.customer?.displayName ?? "Cliente",
    state: o.shippingAddress?.provinceCode ?? null,
    city: o.shippingAddress?.city ?? null,
    firstSource: o.customerJourneySummary?.firstVisit?.source ?? null,
    utm: utm && Object.keys(utm).length ? utm : null,
    tracking: tr,
    cancelled: !!o.cancelledAt,
    gateway: o.paymentGatewayNames?.[0] ?? null,
    email: o.email ?? null,
    phone: o.phone ?? null,
    images: o.lineItems.nodes.map((l) => l.image?.url).filter((x): x is string => !!x),
    shipStatus: o.fulfillments.find((f) => f.displayStatus)?.displayStatus ?? null,
    lines: o.lineItems.nodes.map((l) => ({
      title: l.title,
      variant: l.variantTitle ?? "",
      sku: l.sku,
      quantity: l.quantity,
      revenue: money(l.discountedTotalSet),
      unitCost: l.variant?.inventoryItem?.unitCost ? Number(l.variant.inventoryItem.unitCost.amount) : null,
    })),
  };
}

export async function ordersBetween(start: Date, end: Date, max = 3000): Promise<Order[]> {
  const key = `orders:${start.toISOString()}:${end.toISOString()}`;
  return cached(key, 90_000, async () => {
    const q = `created_at:>='${start.toISOString()}' created_at:<'${end.toISOString()}'`;
    const out: Order[] = [];
    let after: string | null = null;
    do {
      type P = { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawOrder[] } };
      const d: P = await gql<P>(
        `query($q:String!,$after:String){ orders(first:100, after:$after, query:$q, sortKey:CREATED_AT, reverse:true){ pageInfo{hasNextPage endCursor} nodes{ ${ORDER_FIELDS} } } }`,
        { q, after },
      );
      out.push(...d.orders.nodes.map(mapOrder));
      after = d.orders.pageInfo.hasNextPage && out.length < max ? d.orders.pageInfo.endCursor : null;
    } while (after);
    return out;
  });
}

export async function recentOrders(limit = 50, query = ""): Promise<Order[]> {
  return cached(`recent:${limit}:${query}`, 60_000, async () => {
    type P = { orders: { nodes: RawOrder[] } };
    const d = await gql<P>(
      `query($n:Int!,$q:String){ orders(first:$n, sortKey:CREATED_AT, reverse:true, query:$q){ nodes{ ${ORDER_FIELDS} } } }`,
      { n: limit, q: query || null },
    );
    return d.orders.nodes.map(mapOrder);
  });
}

/* Produtos */
export interface Variant {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  stock: number;
  unitCost: number | null;
}
export interface Product {
  id: string;
  title: string;
  status: string;
  image: string | null;
  totalInventory: number;
  variants: Variant[];
}

export async function products(): Promise<Product[]> {
  return cached("products", 120_000, async () => {
    const out: Product[] = [];
    let after: string | null = null;
    do {
      type P = {
        products: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            id: string;
            title: string;
            status: string;
            totalInventory: number;
            featuredMedia: { preview: { image: { url: string } | null } | null } | null;
            variants: { nodes: { id: string; title: string; sku: string | null; price: string; inventoryQuantity: number | null; inventoryItem: { unitCost: { amount: string } | null } | null }[] };
          }[];
        };
      };
      const d: P = await gql<P>(
        `query($after:String){ products(first:100, after:$after, query:"status:active"){ pageInfo{hasNextPage endCursor}
          nodes{ id title status totalInventory featuredMedia{preview{image{url}}}
            variants(first:60){ nodes{ id title sku price inventoryQuantity inventoryItem{ unitCost{amount} } } } } } }`,
        { after },
      );
      for (const p of d.products.nodes) {
        out.push({
          id: p.id,
          title: p.title,
          status: p.status,
          image: p.featuredMedia?.preview?.image?.url ?? null,
          totalInventory: p.totalInventory,
          variants: p.variants.nodes.map((v) => ({
            id: v.id,
            title: v.title,
            sku: v.sku,
            price: Number(v.price),
            stock: v.inventoryQuantity ?? 0,
            unitCost: v.inventoryItem?.unitCost ? Number(v.inventoryItem.unitCost.amount) : null,
          })),
        });
      }
      after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
    } while (after);
    return out;
  });
}

/* Clientes */
export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  orders: number;
  spent: number;
  lastOrderAt: string | null;
  createdAt: string;
  state: string | null;
  city: string | null;
  zip: string | null;
  tags: string[];
}

export async function customers(max = 5000): Promise<Customer[]> {
  return cached("customers", 300_000, async () => {
    const out: Customer[] = [];
    let after: string | null = null;
    do {
      type P = {
        customers: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            id: string;
            displayName: string;
            defaultEmailAddress: { emailAddress: string } | null;
            defaultPhoneNumber: { phoneNumber: string } | null;
            numberOfOrders: string;
            amountSpent: { amount: string };
            lastOrder: { createdAt: string; shippingAddress: { phone: string | null } | null } | null;
            createdAt: string;
            defaultAddress: { provinceCode: string | null; city: string | null; zip: string | null; phone: string | null } | null;
            tags: string[];
          }[];
        };
      };
      const d: P = await gql<P>(
        `query($after:String){ customers(first:250, after:$after, query:"orders_count:>0", sortKey:UPDATED_AT, reverse:true){ pageInfo{hasNextPage endCursor}
          nodes{ id displayName defaultEmailAddress{emailAddress} defaultPhoneNumber{phoneNumber} numberOfOrders amountSpent{amount}
            lastOrder{ createdAt shippingAddress{ phone } } createdAt defaultAddress{ provinceCode city zip phone } tags } } }`,
        { after },
      );
      for (const c of d.customers.nodes) {
        out.push({
          id: c.id,
          name: c.displayName,
          email: c.defaultEmailAddress?.emailAddress ?? null,
          phone: c.defaultPhoneNumber?.phoneNumber ?? c.defaultAddress?.phone ?? c.lastOrder?.shippingAddress?.phone ?? null,
          orders: Number(c.numberOfOrders),
          spent: Number(c.amountSpent.amount),
          lastOrderAt: c.lastOrder?.createdAt ?? null,
          createdAt: c.createdAt,
          state: c.defaultAddress?.provinceCode ?? null,
          city: c.defaultAddress?.city ?? null,
          zip: c.defaultAddress?.zip ?? null,
          tags: c.tags,
        });
      }
      after = d.customers.pageInfo.hasNextPage && out.length < max ? d.customers.pageInfo.endCursor : null;
    } while (after);
    return out;
  });
}

/* Conversão (ShopifyQL) */
export interface FunnelDay {
  day: string;
  sessions: number;
  cart: number;
  checkout: number;
  purchased: number;
  rate: number;
}

export async function shopifyql(query: string): Promise<Record<string, string>[] | null> {
  try {
    type R = { shopifyqlQuery: { tableData?: { rows?: Record<string, string>[] }; parseErrors?: unknown[] } };
    const d = await gql<R>(`query($q:String!){ shopifyqlQuery(query:$q){ tableData{ rows } parseErrors } }`, { q: query });
    return d.shopifyqlQuery?.tableData?.rows ?? null;
  } catch {
    return null;
  }
}

export async function funnelByDay(sinceIso: string, untilIso: string): Promise<FunnelDay[] | null> {
  return cached(`funnel:${sinceIso}:${untilIso}`, 300_000, async () => {
    const rows = await shopifyql(
      `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout, conversion_rate GROUP BY day SINCE ${sinceIso} UNTIL ${untilIso}`,
    );
    if (!rows) return null;
    return rows
      .map((r) => ({
        day: String(r.day).slice(0, 10),
        sessions: Number(r.sessions),
        cart: Number(r.sessions_with_cart_additions),
        checkout: Number(r.sessions_that_reached_checkout),
        purchased: Number(r.sessions_that_completed_checkout),
        rate: Number(r.conversion_rate),
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  });
}

export async function conversionByDevice(sinceIso: string, untilIso: string) {
  return cached(`device:${sinceIso}:${untilIso}`, 300_000, async () => {
    const rows = await shopifyql(
      `FROM sessions SHOW sessions, sessions_that_completed_checkout, conversion_rate GROUP BY session_device_type SINCE ${sinceIso} UNTIL ${untilIso}`,
    );
    if (!rows) return null;
    return rows.map((r) => ({
      device: String(r.session_device_type ?? "outro"),
      sessions: Number(r.sessions),
      purchased: Number(r.sessions_that_completed_checkout),
      rate: Number(r.conversion_rate),
    }));
  });
}

/* Status em português */
export const FINANCIAL: Record<string, [string, string]> = {
  PAID: ["pago", "c-l"],
  PENDING: ["aguardando pagamento", "c-s"],
  AUTHORIZED: ["autorizado", "c-k"],
  PARTIALLY_PAID: ["pago em parte", "c-s"],
  REFUNDED: ["estornado", "c-c"],
  PARTIALLY_REFUNDED: ["estornado em parte", "c-c"],
  VOIDED: ["cancelado", "c-n"],
  EXPIRED: ["expirado", "c-n"],
};
export const FULFILLMENT: Record<string, [string, string]> = {
  FULFILLED: ["enviado", "c-l"],
  UNFULFILLED: ["a enviar", "c-s"],
  PARTIALLY_FULFILLED: ["enviado em parte", "c-s"],
  IN_PROGRESS: ["separando", "c-k"],
  ON_HOLD: ["em espera", "c-n"],
  SCHEDULED: ["agendado", "c-k"],
  RESTOCKED: ["devolvido", "c-c"],
};

/* Entregas */
export interface Shipment {
  order: string;
  customer: string;
  city: string | null;
  state: string | null;
  shippedAt: string;
  deliveredAt: string | null;
  status: string;
  company: string | null;
  number: string | null;
  url: string | null;
}

export async function shipments(days = 30): Promise<Shipment[]> {
  return cached(`ship:${days}`, 120_000, async () => {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const out: Shipment[] = [];
    let after: string | null = null;
    do {
      type P = {
        orders: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            name: string;
            customer: { displayName: string } | null;
            shippingAddress: { city: string | null; provinceCode: string | null } | null;
            fulfillments: { createdAt: string; displayStatus: string; deliveredAt: string | null; trackingInfo: { number: string; company: string | null; url: string | null }[] }[];
          }[];
        };
      };
      const d: P = await gql<P>(
        `query($q:String,$after:String){ orders(first:100, after:$after, sortKey:CREATED_AT, reverse:true, query:$q){ pageInfo{hasNextPage endCursor}
          nodes{ name customer{displayName} shippingAddress{city provinceCode} fulfillments(first:3){ createdAt displayStatus deliveredAt trackingInfo{number company url} } } } }`,
        { q: `fulfillment_status:shipped created_at:>='${since}'`, after },
      );
      for (const o of d.orders.nodes) {
        const f = o.fulfillments[0];
        if (!f) continue;
        const t = f.trackingInfo[0];
        out.push({
          order: o.name,
          customer: o.customer?.displayName ?? "Cliente",
          city: o.shippingAddress?.city ?? null,
          state: o.shippingAddress?.provinceCode ?? null,
          shippedAt: f.createdAt,
          deliveredAt: f.deliveredAt,
          status: f.displayStatus,
          company: t?.company ?? null,
          number: t?.number ?? null,
          url: t?.url ?? null,
        });
      }
      after = d.orders.pageInfo.hasNextPage ? d.orders.pageInfo.endCursor : null;
    } while (after);
    return out;
  });
}
