// Números da loja e texto dos relatórios enviados no WhatsApp.
import { db } from "./db";
import { salesBetween, conversionForDay, type SalesLine } from "./shopify";
import { metaSpend } from "./meta";
import { shortTip } from "./ai";
import { getSettings } from "./settings";
import { addDays, brl, dayRange, isoDayLocal, pct, weekdayName } from "./time";

export interface Metrics {
  from: string;
  to: string; // inclusivo
  orders: number;
  net: number;
  aov: number;
  ads: number | null;
  cogs: number;
  missingCost: string[];
  taxesFees: number;
  packaging: number;
  profitBeforeFixed: number;
  fixedCosts: number; // custos fixos do mês inteiro (só no período mensal)
  variableCosts: number;
  conversion: { sessions: number; rate: number } | null;
  champion: SalesLine | null;
  joins: number;
  leaves: number;
}

// Custo por peça: lote lançado (pela palavra-chave no nome do produto) ou custo da Shopify
async function costResolver() {
  const lots = await db.cost.findMany({ where: { kind: "STOCK_LOT", productKey: { not: null } }, orderBy: { createdAt: "desc" } });
  return (title: string, shopifyCost: number | null): number | null => {
    const t = title.toLowerCase();
    const lot = lots.find((l) => l.productKey && t.includes(l.productKey.toLowerCase()));
    if (lot?.unitCost != null) return Number(lot.unitCost);
    return shopifyCost;
  };
}

export async function computeMetrics(fromIso: string, toIso: string, opts: { monthMode?: boolean } = {}): Promise<Metrics> {
  const s = await getSettings();
  const { start } = dayRange(fromIso);
  const { end } = dayRange(toIso);

  const sales = await salesBetween(start, end);
  const resolve = await costResolver();
  let cogs = 0;
  let items = 0;
  const missing: string[] = [];
  for (const l of sales.lines) {
    items += l.quantity;
    const c = resolve(l.title, l.unitCost);
    if (c == null) missing.push(l.title);
    else cogs += c * l.quantity;
  }
  let ads: number | null = null;
  try {
    ads = await metaSpend(fromIso, toIso);
  } catch {
    ads = null;
  }
  const taxesFees = sales.net * (s.costs.taxRate + s.costs.paymentFeeRate);
  const packaging = items * s.costs.packagingPerItem;
  const profitBeforeFixed = sales.net - cogs - taxesFees - packaging - (ads ?? 0);

  let fixedCosts = 0;
  let variableCosts = 0;
  if (opts.monthMode) {
    const month = fromIso.slice(0, 7);
    const fixed = await db.cost.findMany({ where: { kind: "FIXED", OR: [{ recurring: true }, { month }] } });
    fixedCosts = fixed.reduce((sum, c) => sum + Number(c.amount), 0); // mês inteiro, nunca proporcional
    const vars = await db.cost.findMany({ where: { kind: "VARIABLE", month } });
    variableCosts = vars.reduce((sum, c) => sum + Number(c.amount), 0);
  }

  const conversion = fromIso === toIso ? await conversionForDay(fromIso) : null;
  const [joins, leaves] = await Promise.all([
    db.memberEvent.count({ where: { type: { in: ["JOIN", "RETURN"] }, createdAt: { gte: start, lt: end }, group: { isCommunity: true } } }),
    db.memberEvent.count({ where: { type: "LEAVE", createdAt: { gte: start, lt: end }, group: { isCommunity: true } } }),
  ]);

  return {
    from: fromIso,
    to: toIso,
    orders: sales.orders,
    net: sales.net,
    aov: sales.orders ? sales.net / sales.orders : 0,
    ads,
    cogs,
    missingCost: missing,
    taxesFees,
    packaging,
    profitBeforeFixed,
    fixedCosts,
    variableCosts,
    conversion,
    champion: sales.lines[0] ?? null,
    joins,
    leaves,
  };
}

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${weekdayName(iso)} ${d}/${m}`;
}

export function reportText(m: Metrics, title: string, items = { revenue: true, ads: true, profit: true, conversion: true, champion: true, tip: false, groups: false }, tip?: string) {
  const L: string[] = [`*${title}*`, ""];
  if (items.revenue) {
    L.push(`Faturamento: *${brl(m.net)}*`);
    L.push(`Pedidos: *${m.orders}*${m.orders ? `, ticket médio ${brl(m.aov, 0)}` : ""}`);
  }
  if (items.ads && m.ads != null) L.push(`Anúncios: *${brl(m.ads)}*`);
  if (items.profit) {
    if (m.fixedCosts || m.variableCosts) {
      L.push(`Lucro antes dos fixos: ${brl(m.profitBeforeFixed)}`);
      L.push(`Custos fixos do mês (inteiro): ${brl(m.fixedCosts)}`);
      if (m.variableCosts) L.push(`Outros custos do mês: ${brl(m.variableCosts)}`);
      L.push(`Lucro real: *${brl(m.profitBeforeFixed - m.fixedCosts - m.variableCosts)}*`);
    } else {
      L.push(`Lucro: *${brl(m.profitBeforeFixed)}* (antes dos custos fixos)`);
    }
    if (m.missingCost.length) L.push(`_Sem custo cadastrado: ${m.missingCost.slice(0, 3).join(", ")}${m.missingCost.length > 3 ? " e outros" : ""}_`);
  }
  if (items.conversion && m.conversion) L.push(`Conversão: *${pct(m.conversion.rate)}* (${m.conversion.sessions.toLocaleString("pt-BR")} visitas)`);
  if (items.champion && m.champion) L.push("", `Produto campeão: *${m.champion.title}* (${m.champion.quantity} un., ${brl(m.champion.revenue)})`);
  if (items.groups) L.push("", `Comunidade: +${m.joins} entraram, ${m.leaves} saíram`);
  if (items.tip && tip) L.push("", tip);
  return L.join("\n");
}

export async function dailyReport(isoDay?: string, opts: { withTip?: boolean } = {}) {
  const s = await getSettings();
  const day = isoDay ?? isoDayLocal();
  const m = await computeMetrics(day, day);
  const base = reportText(m, `Resultado de ${fmtDay(day)}`, { ...s.report.items, tip: false });
  if (!opts.withTip || !s.report.items.tip) return base;
  let tip: string | undefined;
  try {
    tip = await shortTip(base);
  } catch {
    tip = undefined;
  }
  return tip ? `${base}\n\n${tip}` : base;
}

export async function weeklyReport() {
  const s = await getSettings();
  const to = addDays(isoDayLocal(), -1);
  const from = addDays(to, -6);
  const m = await computeMetrics(from, to);
  return reportText(m, `Resumo da semana, ${from.slice(8)}/${from.slice(5, 7)} a ${to.slice(8)}/${to.slice(5, 7)}`, { ...s.report.items, groups: true });
}

export async function monthReport() {
  const today = isoDayLocal();
  const from = `${today.slice(0, 7)}-01`;
  const m = await computeMetrics(from, today, { monthMode: true });
  return reportText(m, `Mês até hoje (${from.slice(8)}/${from.slice(5, 7)} a ${today.slice(8)}/${today.slice(5, 7)})`, {
    revenue: true, ads: true, profit: true, conversion: false, champion: true, tip: false, groups: true,
  });
}
