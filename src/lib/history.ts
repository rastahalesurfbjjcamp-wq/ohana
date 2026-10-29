// Histórico de vendas da loja inteira, direto do relatório de vendas da Shopify (ShopifyQL).
// Bruto = preço x quantidade; descontos = cupons e promoções; devoluções = reembolsos e trocas;
// líquido = bruto - descontos - devoluções (sem frete e sem impostos), igual ao "Vendas líquidas" da Shopify.
import { swr } from "./cache";
import { shopCreatedAt, shopifyql } from "./shopify";
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
