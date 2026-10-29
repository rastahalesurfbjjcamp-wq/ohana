// Leitura de vendas da Shopify (Admin GraphQL).
import { swr } from "./cache";
import { creds } from "./integrations";

const API_VERSION = "2025-10";

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { domain, token } = (await creds()).shopify;
  if (!domain || !token) throw new Error("SHOPIFY_NAO_CONFIGURADA");
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
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

// Vendas entre duas datas (UTC)
async function salesBetweenRaw(start: Date, end: Date): Promise<SalesSummary> {
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
