// Lucro por produto: preço, custo (lote ou Shopify), impostos, taxas e embalagem.
import { costResolver } from "./report";
import { getSettings } from "./settings";
import { ordersBetween, products, type Product } from "./store";
import { dayRange } from "./time";

export interface ProductProfit {
  product: Product;
  price: number;
  cost: number | null;
  costFromLot: boolean;
  unitProfit: number | null;
  margin: number | null;
  sold: number;
  revenue: number;
  profit: number | null;
  stock: number;
}

export async function productProfits(fromIso: string, toIso: string): Promise<ProductProfit[]> {
  const [s, list, resolve] = await Promise.all([getSettings(), products(), costResolver()]);
  const { start } = dayRange(fromIso);
  const { end } = dayRange(toIso);
  const orders = await ordersBetween(start, end);
  const sales = new Map<string, { qty: number; revenue: number }>();
  for (const o of orders) {
    if (o.cancelled) continue;
    for (const l of o.lines) {
      const cur = sales.get(l.title) ?? { qty: 0, revenue: 0 };
      cur.qty += l.quantity;
      cur.revenue += l.revenue;
      sales.set(l.title, cur);
    }
  }
  const rate = s.costs.taxRate + s.costs.paymentFeeRate;
  return list
    .map((p) => {
      const prices = p.variants.map((v) => v.price).filter((x) => x > 0);
      const price = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const shopCosts = p.variants.map((v) => v.unitCost).filter((x): x is number => x != null);
      const shopCost = shopCosts.length ? shopCosts.reduce((a, b) => a + b, 0) / shopCosts.length : null;
      const cost = resolve(p.title, shopCost);
      const costFromLot = cost != null && cost !== shopCost;
      const unitProfit = cost != null ? price - cost - price * rate - s.costs.packagingPerItem : null;
      const sale = sales.get(p.title) ?? { qty: 0, revenue: 0 };
      const profit = cost != null ? sale.revenue - sale.qty * cost - sale.revenue * rate - sale.qty * s.costs.packagingPerItem : null;
      return {
        product: p,
        price,
        cost,
        costFromLot,
        unitProfit,
        margin: unitProfit != null && price ? unitProfit / price : null,
        sold: sale.qty,
        revenue: sale.revenue,
        profit,
        stock: p.variants.reduce((a, v) => a + Math.max(0, v.stock), 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
