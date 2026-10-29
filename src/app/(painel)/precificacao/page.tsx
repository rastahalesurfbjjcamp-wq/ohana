import Link from "next/link";
import { Box } from "lucide-react";
import { db } from "@/lib/db";
import { costResolver } from "@/lib/report";
import { getSettings } from "@/lib/settings";
import { ordersBetween, products } from "@/lib/store";
import { addDays, dayRange, isoDayLocal } from "@/lib/time";
import { ErrorNote, Header } from "@/components/ui";
import { PriceSim, type SimProduct } from "@/components/PriceSim";

export const dynamic = "force-dynamic";

export default async function Precificacao({ searchParams }: { searchParams: Promise<{ produto?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const today = isoDayLocal();
  const from = addDays(today, -89);
  let list: SimProduct[] = [];
  let error: unknown = null;
  let ppo = 1;
  try {
    const [prods, resolve, orders] = await Promise.all([products(), costResolver(), ordersBetween(dayRange(from).start, dayRange(today).end)]);
    // vendas por produto em cada um dos 3 últimos períodos de 30 dias
    const cut = [dayRange(addDays(today, -59)).start.getTime(), dayRange(addDays(today, -29)).start.getTime()];
    const sales = new Map<string, { q: [number, number, number]; rev: number; qty: number }>();
    let orderCount = 0, pieces = 0;
    for (const o of orders) {
      if (o.cancelled) continue;
      orderCount++;
      const t = new Date(o.createdAt).getTime();
      const b = t < cut[0] ? 0 : t < cut[1] ? 1 : 2;
      for (const l of o.lines) {
        pieces += l.quantity;
        const cur = sales.get(l.title) ?? { q: [0, 0, 0] as [number, number, number], rev: 0, qty: 0 };
        cur.q[b] += l.quantity; cur.rev += l.revenue; cur.qty += l.quantity;
        sales.set(l.title, cur);
      }
    }
    list = prods.filter((p) => p.status === "ACTIVE").map((p) => {
      const prices = p.variants.map((v) => v.price).filter((x) => x > 0);
      const price = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const shopCosts = p.variants.map((v) => v.unitCost).filter((x): x is number => x != null);
      const sale = sales.get(p.title);
      return {
        title: p.title, image: p.image, price: Math.round(price * 100) / 100,
        cost: resolve(p.title, shopCosts.length ? shopCosts.reduce((a, b) => a + b, 0) / shopCosts.length : null),
        months: sale ? sale.q : [0, 0, 0], soldPrice: sale && sale.qty ? sale.rev / sale.qty : null, stock: p.totalInventory,
      };
    }).sort((a, b) => b.months.reduce((x, y) => x + y, 0) - a.months.reduce((x, y) => x + y, 0));
    ppo = orderCount ? Math.round((pieces / orderCount) * 10) / 10 : 1;
  } catch (e) {
    error = e;
  }
  const fixed = await db.cost.findMany({ where: { kind: "FIXED", OR: [{ recurring: true }, { month: today.slice(0, 7) }] } });
  const fixedTotal = fixed.reduce((a, c) => a + Number(c.amount), 0);

  return (
    <>
      <Header title="Precificação" lede="Monte o preço com tudo que sai do bolso e veja quanto sobra no fim do mês em cada cenário de venda.">
        <Link className="btn" href="/produtos"><Box size={15} /> Produtos e lucro</Link>
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      <PriceSim
        products={list}
        initial={sp.produto}
        defaults={{ tax: s.costs.taxRate * 100, fee: s.costs.paymentFeeRate * 100, packaging: s.costs.packagingPerItem, commission: s.referral.commission, fixed: fixedTotal, piecesPerOrder: ppo }}
      />
    </>
  );
}
