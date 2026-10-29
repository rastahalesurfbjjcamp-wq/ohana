// Histórico de vendas da loja inteira, direto do relatório de vendas da Shopify (ShopifyQL).
// Bruto = preço x quantidade; descontos = cupons e promoções; devoluções = reembolsos e trocas;
// líquido = bruto - descontos - devoluções (sem frete e sem impostos), igual ao "Vendas líquidas" da Shopify.
import { swr } from "./cache";
import { shopCreatedAt, shopifyql, unitCostsByTitle } from "./shopify";
import { costResolver } from "./report";
import { isoDayLocal } from "./time";

export type HistRow = { key: string; orders: number; gross: number; discounts: number; returns: number; net: number; shipping: number; total: number };
const num = (v?: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const METRICS = "orders, gross_sales, discounts, sales_reversals, net_sales, shipping_charges, total_sales";
// nomes antigos de algumas colunas, conforme a versão da API
const ALIAS: Record<string, string> = { sales_reversals: "returns", shipping_charges: "shipping" };
async function query(build: (m: string) => string) {
  let metrics = METRICS;
  for (let i = 0; i < 4; i++) {
    try {
      return await shopifyql(build(metrics));
    } catch (e) {
      const col = String(e).match(/Column '(\w+)' not found/)?.[1];
      if (!col || !ALIAS[col]) throw e;
      metrics = metrics.replace(col, ALIAS[col]);
    }
  }
  return shopifyql(build(metrics));
}
const toRow = (key: string, r: Record<string, string>): HistRow => ({
  key,
  orders: num(r.orders),
  gross: num(r.gross_sales),
  discounts: Math.abs(num(r.discounts)),
  returns: Math.abs(num(r.sales_reversals ?? r.returns)),
  net: num(r.net_sales),
  shipping: num(r.shipping_charges ?? r.shipping),
  total: num(r.total_sales),
});

export function sumRows(rows: HistRow[], key = "total"): HistRow {
  const z: HistRow = { key, orders: 0, gross: 0, discounts: 0, returns: 0, net: 0, shipping: 0, total: 0 };
  for (const r of rows) { z.orders += r.orders; z.gross += r.gross; z.discounts += r.discounts; z.returns += r.returns; z.net += r.net; z.shipping += r.shipping; z.total += r.total; }
  return z;
}

// Série por mês (ou por dia) entre duas datas
export async function salesSeries(from: string, to: string, by: "month" | "day") {
  return swr(`hist:${by}:${from}:${to}`, by === "day" ? 120_000 : 600_000, async () => {
    const rows = await query((m) => `FROM sales SHOW ${m} TIMESERIES ${by} SINCE ${from} UNTIL ${to}`);
    return rows.map((r) => toRow(String(r[by] ?? Object.values(r)[0]).slice(0, by === "month" ? 7 : 10), r));
  });
}

// Vendas por cupom no período (linha vazia = pedidos sem cupom)
export async function couponSeries(from: string, to: string) {
  return swr(`hist:cupons:${from}:${to}`, 600_000, async () => {
    const rows = await query((m) => `FROM sales SHOW ${m} GROUP BY discount_code SINCE ${from} UNTIL ${to} ORDER BY gross_sales DESC LIMIT 300`);
    return rows.map((r) => toRow(r.discount_code ?? "", r)).filter((r) => r.orders || r.gross);
  });
}

// Primeiro mês com venda: a partir da criação da loja
export async function storeStart() {
  const created = await shopCreatedAt().catch(() => "2020-01-01");
  return created;
}

export const todayIso = () => isoDayLocal();

// Vendas que vieram por cupons (ex.: cupom que o ManyChat entrega para quem chega pelo tráfego do perfil)
export type CouponSales = { codes: string[]; orders: number; gross: number; net: number; cogs: number; missingCost: number; items: number };
export async function couponSales(codes: string[], from: string, to: string): Promise<CouponSales> {
  const clean = [...new Set(codes.map((c) => c.trim()).filter((c) => /^[\w-]{2,40}$/.test(c)))];
  return swr(`hist:cs:${clean.join(",")}:${from}:${to}`, 300_000, async () => {
    const out: CouponSales = { codes: clean, orders: 0, gross: 0, net: 0, cogs: 0, missingCost: 0, items: 0 };
    if (!clean.length) return out;
    const [resolve, costs] = await Promise.all([costResolver(), unitCostsByTitle().catch(() => new Map<string, number>())]);
    for (const code of clean) {
      const tot = (await shopifyql(`FROM sales SHOW orders, gross_sales, net_sales WHERE discount_code = '${code}' SINCE ${from} UNTIL ${to}`))[0] ?? {};
      out.orders += num(tot.orders); out.gross += num(tot.gross_sales); out.net += num(tot.net_sales);
      if (!num(tot.orders)) continue;
      const rows = await shopifyql(`FROM sales SHOW net_items_sold WHERE discount_code = '${code}' GROUP BY product_title SINCE ${from} UNTIL ${to} LIMIT 500`);
      for (const r of rows) {
        const q = num(r.net_items_sold);
        if (q <= 0) continue;
        out.items += q;
        const c = resolve(r.product_title, costs.get(r.product_title) ?? null);
        if (c == null) out.missingCost += q; else out.cogs += c * q;
      }
    }
    return out;
  });
}
