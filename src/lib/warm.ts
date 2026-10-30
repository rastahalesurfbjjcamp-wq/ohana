// Deixa prontos os dados dos períodos mais usados, para trocar de data sem esperar.
// Roda em segundo plano, no máximo a cada 4 minutos, enquanto alguém usa o painel.
import { computeMetrics } from "./report";
import { campStats, metaAccounts, metaAds } from "./meta";
import { partnerStats } from "./partners";
import { resolvePeriod, type PeriodKey } from "./periods";
import { beyondOrdersWindow } from "./shopify";
import { customers, funnelByDay, ordersBetween, products, recentOrders } from "./store";
import { addDays, isoDayLocal } from "./time";
import { getSettings } from "./settings";
import { dayRange } from "./time";
import { couponSales, salesSeries } from "./history";

let last = 0;
let running = false;
const KEYS: PeriodKey[] = ["hoje", "ontem", "7d", "30d", "mes", "mes-passado"];

export function warmSoon() {
  if (running || Date.now() - last < 4 * 60_000) return;
  running = true;
  last = Date.now();
  // um de cada vez, para não estourar o limite da Shopify e da Meta
  (async () => {
    const step = async (f: () => Promise<unknown>) => { try { await f(); } catch { /* segue */ } };
    await step(() => recentOrders(12));
    await step(() => products());
    for (const k of KEYS) {
      const p = resolvePeriod(k);
      const start = dayRange(p.from).start, end = dayRange(p.to).end;
      await step(() => computeMetrics(p.from, p.to));
      if (beyondOrdersWindow(start)) await step(() => salesSeries(p.from, p.to, "day"));
      else await step(() => ordersBetween(start, end));
      await step(() => campStats(p.from, p.to));
      await step(() => partnerStats(p.from, p.to));
    }
    // telas que abrem com 30 dias (Campanhas, Origem, Pedidos) e 90 dias (Precificação)
    const today = isoDayLocal();
    const d30 = resolvePeriod("30d");
    await step(() => metaAds(d30.from, d30.to));
    await step(() => funnelByDay(d30.from, d30.to));
    await step(() => metaAccounts());
    await step(async () => { const st = await getSettings(); if (st.ads.perfilCoupons.length) await couponSales(st.ads.perfilCoupons, d30.from, d30.to); });
    await step(() => ordersBetween(dayRange(addDays(today, -89)).start, dayRange(today).end));
    await step(() => customers());
  })().finally(() => { running = false; });
}
