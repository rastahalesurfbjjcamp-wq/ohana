// Leitura de vendas da Shopify (Admin GraphQL).
import { swr } from "./cache";
import { creds } from "./integrations";
import { isoDayLocal } from "./time";

const API_VERSION = "2025-10";
const QL_VERSION = "2026-10";

async function gql<T>(query: string, variables: Record<string, unknown> = {}, version = API_VERSION): Promise<T> {
  const { domain, token } = (await creds()).shopify;
  if (!domain || !token) throw new Error("SHOPIFY_NAO_CONFIGURADA");
  const res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (!res.ok || json.errors) throw new Error(`Shopify: ${JSON.stringify(json.errors ?? res.status)}`);
  return json.data as T;
}

export interface SalesLine {
  title: string;
  quantity: number;
  revenue: number;
  unitCost: number | null;
}

export interface SalesSummary {
  orders: number;
  gross: number;
  net: number;
  lines: SalesLine[];
}

type OrdersPage = {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      cancelledAt: string | null;
      currentSubtotalPriceSet: { shopMoney: { amount: string } };
      totalPriceSet: { shopMoney: { amount: string } };
      lineItems: {
        nodes: {
          quantity: number;
          title: string;
          discountedTotalSet: { shopMoney: { amount: string } };
          variant: { inventoryItem: { unitCost: { amount: string } | null } | null } | null;
        }[];
      };
    }[];
  };
};

// A Shopify só entrega pedidos dos últimos 60 dias pela API de pedidos (sem a permissão read_all_orders).
// Antes disso, os números vêm do relatório de vendas (ShopifyQL), que tem a loja inteira.
export const ORDERS_WINDOW_DAYS = 58;
export const beyondOrdersWindow = (start: Date) => start.getTime() < Date.now() - ORDERS_WINDOW_DAYS * 864e5;

export async function unitCostsByTitle(): Promise<Map<string, number>> {
  return swr("unit-costs", 600_000, async () => {
    const out = new Map<string, number>();
    let after: string | null = null;
    do {
      type P = { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { title: string; variants: { nodes: { inventoryItem: { unitCost: { amount: string } | null } | null }[] } }[] } };
      const d: P = await gql<P>(`query($after:String){ products(first:100, after:$after){ pageInfo{hasNextPage endCursor} nodes{ title variants(first:5){ nodes{ inventoryItem{ unitCost{amount} } } } } } }`, { after });
      for (const p of d.products.nodes) {
        const c = p.variants.nodes.map((v) => v.inventoryItem?.unitCost?.amount).find((x) => x != null);
        if (c != null) out.set(p.title, Number(c));
      }
      after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
    } while (after);
    return out;
  });
}

async function salesFromReport(start: Date, end: Date): Promise<SalesSummary> {
  const a = isoDayLocal(start);
  const b = isoDayLocal(new Date(end.getTime() - 1));
  const tot = (await shopifyql(`FROM sales SHOW orders, net_sales, total_sales SINCE ${a} UNTIL ${b}`))[0] ?? {};
  const rows = await shopifyql(`FROM sales SHOW net_items_sold, net_sales GROUP BY product_title SINCE ${a} UNTIL ${b} ORDER BY net_sales DESC LIMIT 1000`);
  const costs = await unitCostsByTitle().catch(() => new Map<string, number>());
  const lines: SalesLine[] = rows
    .map((r) => ({ title: r.product_title || "Sem produto", quantity: Number(r.net_items_sold) || 0, revenue: Number(r.net_sales) || 0, unitCost: costs.get(r.product_title) ?? null }))
    .filter((l) => l.quantity > 0 || l.revenue !== 0);
  return { orders: Number(tot.orders) || 0, gross: Number(tot.total_sales) || 0, net: Number(tot.net_sales) || 0, lines };
}

// Vendas entre duas datas (UTC)
async function salesBetweenRaw(start: Date, end: Date): Promise<SalesSummary> {
  if (beyondOrdersWindow(start)) return salesFromReport(start, end);
  const q = `created_at:>='${start.toISOString()}' created_at:<'${end.toISOString()}' -status:cancelled`;
  let after: string | null = null;
  const out: SalesSummary = { orders: 0, gross: 0, net: 0, lines: [] };
  const byTitle = new Map<string, SalesLine>();
  do {
    const data: OrdersPage = await gql<OrdersPage>(
      `query($q:String!,$after:String){ orders(first:100, after:$after, query:$q){ pageInfo{hasNextPage endCursor}
        nodes{ cancelledAt currentSubtotalPriceSet{shopMoney{amount}} totalPriceSet{shopMoney{amount}}
          lineItems(first:50){ nodes{ quantity title discountedTotalSet{shopMoney{amount}} variant{ inventoryItem{ unitCost{amount} } } } } } } }`,
      { q, after },
    );
    for (const o of data.orders.nodes) {
      if (o.cancelledAt) continue;
      out.orders++;
      out.gross += Number(o.totalPriceSet.shopMoney.amount);
      out.net += Number(o.currentSubtotalPriceSet.shopMoney.amount);
      for (const li of o.lineItems.nodes) {
        const cur = byTitle.get(li.title) ?? { title: li.title, quantity: 0, revenue: 0, unitCost: null };
        cur.quantity += li.quantity;
        cur.revenue += Number(li.discountedTotalSet.shopMoney.amount);
        const uc = li.variant?.inventoryItem?.unitCost?.amount;
        if (uc != null) cur.unitCost = Number(uc);
        byTitle.set(li.title, cur);
      }
    }
    after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
  } while (after);
  out.lines = [...byTitle.values()].sort((a, b) => b.revenue - a.revenue);
  return out;
}

// Conversão do dia via ShopifyQL. Se a loja ou a versão da API não liberar, devolve null.
async function conversionForDayRaw(isoDay: string): Promise<{ sessions: number; rate: number } | null> {
  try {
    type R = { shopifyqlQuery: { tableData?: { rows?: unknown[] }; parseErrors?: unknown[] } };
    const data = await gql<R>(
      `query($q:String!){ shopifyqlQuery(query:$q){ tableData{ rows } parseErrors } }`,
      { q: `FROM sessions SHOW sessions, conversion_rate SINCE ${isoDay} UNTIL ${isoDay}` },
    );
    const row = data.shopifyqlQuery?.tableData?.rows?.[0] as Record<string, string> | string[] | undefined;
    if (!row) return null;
    const vals = Array.isArray(row) ? row : Object.values(row);
    const sessions = Number(vals[0]);
    const rate = Number(vals[1]);
    if (!Number.isFinite(sessions) || !Number.isFinite(rate)) return null;
    return { sessions, rate };
  } catch {
    return null;
  }
}

export async function salesBetween(start: Date, end: Date): Promise<SalesSummary> {
  return swr(`sales:${start.toISOString()}:${end.toISOString()}`, 90_000, () => salesBetweenRaw(start, end));
}

export async function conversionForDay(isoDay: string) {
  return swr(`conv:${isoDay}`, 300_000, () => conversionForDayRaw(isoDay));
}

// Consulta ShopifyQL (mesmos números dos relatórios da Shopify). Devolve linhas com o nome de cada coluna.
export async function shopifyql(q: string, tries = 4): Promise<Record<string, string>[]> {
  try {
    return await shopifyqlOnce(q);
  } catch (e) {
    // a Shopify limita consultas de relatório; espera e tenta de novo
    if (tries > 1 && /THROTTLE|Rate limited/i.test(String(e))) {
      await new Promise((r) => setTimeout(r, (5 - tries) * 3000));
      return shopifyql(q, tries - 1);
    }
    throw e;
  }
}

async function shopifyqlOnce(q: string): Promise<Record<string, string>[]> {
  type R = { shopifyqlQuery: { tableData?: { columns: { name: string }[]; rows: unknown[] } | null; parseErrors: string[] } };
  // relatórios usam a versão mais nova da API (nomes de colunas iguais aos da Shopify hoje)
  const data = await gql<R>(`query($q:String!){ shopifyqlQuery(query:$q){ tableData{ columns{ name } rows } parseErrors } }`, { q }, QL_VERSION);
  const r = data.shopifyqlQuery;
  if (r.parseErrors?.length) throw new Error(`ShopifyQL: ${r.parseErrors.join("; ")}`);
  const cols = r.tableData?.columns.map((c) => c.name) ?? [];
  return (r.tableData?.rows ?? []).map((row) => {
    if (Array.isArray(row)) return Object.fromEntries(cols.map((c, i) => [c, String(row[i] ?? "")]));
    return Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]));
  });
}

export async function shopCreatedAt(): Promise<string> {
  return swr("shop-created", 86_400_000, async () => (await gql<{ shop: { createdAt: string } }>(`{ shop { createdAt } }`)).shop.createdAt.slice(0, 10));
}

// Chamadas que dependem de recursos novos da Shopify (descontos com segmento, tags em descontos)
export async function gqlNew<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  return gql<T>(query, variables, QL_VERSION);
}
