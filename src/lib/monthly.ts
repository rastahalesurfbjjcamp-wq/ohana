// Fechamento do mês, mandado no grupo de resultados todo dia 1.
// Números de venda do relatório da Shopify (iguais aos da Shopify), anúncios do Meta e estoque atual.
import { db } from "./db";
import { byGroup, campStats } from "./meta";
import { computeMetrics } from "./report";
import { couponSeries, salesSeries, sumRows } from "./history";
import { shopifyql } from "./shopify";
import { products } from "./store";
import { addDays, brl, isoDayLocal } from "./time";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pctTxt = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;
const n0 = (v: number) => v.toLocaleString("pt-BR");

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return { from: `${ym}-01`, to: `${ym}-${String(lastDay(y, m)).padStart(2, "0")}`, name: `${MESES[m - 1]} de ${y}`, days: lastDay(y, m) };
}

// ym = "2026-10". Sem informar, fecha o mês anterior.
export async function monthlyClosing(ym?: string) {
  const today = isoDayLocal();
  const month = ym ?? addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const cur = monthRange(month);
  const prevYm = addDays(cur.from, -1).slice(0, 7);
  const prev = monthRange(prevYm);
  const to = cur.to > today ? today : cur.to;

  const [rows, prevRows, m, camps, cupons, top, prods] = await Promise.all([
    salesSeries(cur.from, to, "month").catch(() => []),
    salesSeries(prev.from, prev.to, "month").catch(() => []),
    computeMetrics(cur.from, to, { monthMode: true }).catch(() => null),
    campStats(cur.from, to).catch(() => null),
    couponSeries(cur.from, to).catch(() => []),
    shopifyql(`FROM sales SHOW net_items_sold, net_sales GROUP BY product_title SINCE ${cur.from} UNTIL ${to} ORDER BY net_items_sold DESC LIMIT 40`).catch(() => [] as Record<string, string>[]),
    products().catch(() => []),
  ]);
  const t = sumRows(rows);
  const p = sumRows(prevRows);
  const g = camps ? byGroup(camps) : null;
  const ads = g ? g.total.spend : m?.ads ?? 0;
  const lucro = m ? m.profitBeforeFixed - m.fixedCosts - m.variableCosts : null;

  const L: string[] = [`*Fechamento de ${cur.name}*`, ""];
  L.push("*Vendas*");
  L.push(`Faturamento bruto: ${brl(t.gross)}`);
  L.push(`Cupons e descontos: -${brl(t.discounts)}`);
  if (t.returns) L.push(`Devoluções e trocas: -${brl(t.returns)}`);
  L.push(`Faturamento líquido: *${brl(t.net)}*${p.net ? ` (${pctTxt(t.net / p.net - 1)} vs ${MESES[Number(prevYm.slice(5)) - 1]})` : ""}`);
  L.push(`Pedidos: *${n0(t.orders)}*${t.orders ? ` · ticket médio ${brl(t.net / t.orders, 0)}` : ""}`);

  L.push("", "*Anúncios*");
  L.push(`Gasto total: *${brl(ads)}*`);
  if (g) {
    if (g.vendas.spend) L.push(`Venda: ${brl(g.vendas.spend, 0)}${g.vendas.purchases ? ` · ${n0(g.vendas.purchases)} compras pelo Meta` : ""}`);
    if (g.leads.spend) L.push(`Lead: ${brl(g.leads.spend, 0)} · ${n0(g.leads.leads)} leads${g.leads.leads ? ` a ${brl(g.leads.spend / g.leads.leads)}` : ""}`);
    if (g.perfil.spend) L.push(`Perfil: ${brl(g.perfil.spend, 0)}${g.perfil.visits ? ` · ${n0(g.perfil.visits)} visitas no perfil` : ""}`);
  }
  if (ads) L.push(`ROAS: *${(t.net / ads).toFixed(2).replace(".", ",")}* (faturamento líquido ÷ gasto)`);

  if (m) {
    L.push("", "*Lucro*");
    L.push(`Lucro antes dos fixos: ${brl(m.profitBeforeFixed)}`);
    L.push(`Custos fixos do mês inteiro: -${brl(m.fixedCosts)}`);
    if (m.variableCosts) L.push(`Outros custos do mês: -${brl(m.variableCosts)}`);
    L.push(`Lucro real: *${brl(lucro!)}*`);
    if (ads && lucro != null) L.push(`ROI dos anúncios: *${pctTxt(lucro / ads)}* (lucro real ÷ gasto)`);
    if (m.missingCost.length) L.push(`_Sem custo cadastrado: ${m.missingCost.slice(0, 3).join(", ")}${m.missingCost.length > 3 ? " e outros" : ""}_`);
  }

  const champs = top.filter((r) => Number(r.net_items_sold) > 0).slice(0, 5);
  if (champs.length) {
    L.push("", "*Campeões do mês*");
    champs.forEach((r, i) => L.push(`${i + 1}. ${r.product_title}: ${n0(Number(r.net_items_sold))} un. · ${brl(Number(r.net_sales), 0)}`));
  }

  // Repor: vendeu bem no mês e o estoque não aguenta mais 30 dias no mesmo ritmo
  const byTitle = new Map(prods.map((x) => [x.title, x]));
  const repor = top
    .map((r) => {
      const prod = byTitle.get(r.product_title);
      const sold = Number(r.net_items_sold) || 0;
      if (!prod || prod.status !== "ACTIVE" || sold < 3) return null;
      const perDay = sold / cur.days;
      const dias = perDay ? prod.totalInventory / perDay : Infinity;
      const zerados = prod.variants.filter((v) => v.stock <= 0).map((v) => v.title).filter((v) => v && v !== "Default Title");
      return { title: prod.title, sold, stock: prod.totalInventory, dias, zerados };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && (x.dias < 30 || x.zerados.length > 0))
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 8);
  if (repor.length) {
    L.push("", "*Para repor (vendeu bem e está acabando)*");
    for (const r of repor) L.push(`• ${r.title}: vendeu ${r.sold}, restam ${r.stock}${Number.isFinite(r.dias) ? ` (≈${Math.max(0, Math.round(r.dias))} dias)` : ""}${r.zerados.length ? ` · sem: ${r.zerados.slice(0, 5).join(", ")}` : ""}`);
  }

  const topCupons = cupons.filter((c) => c.key).sort((a, b) => b.net - a.net).slice(0, 3);
  if (topCupons.length) {
    L.push("", "*Cupons que mais venderam*");
    for (const c of topCupons) L.push(`${c.key}: ${c.orders} pedidos · ${brl(c.net, 0)}`);
  }

  const [club, joins, leaves] = await Promise.all([
    db.clubMember.count({ where: { status: { not: "cancelado" } } }).catch(() => 0),
    db.memberEvent.count({ where: { type: { in: ["JOIN", "RETURN"] }, createdAt: { gte: new Date(`${cur.from}T03:00:00Z`), lt: new Date(new Date(`${to}T03:00:00Z`).getTime() + 864e5) }, group: { isCommunity: true } } }).catch(() => 0),
    db.memberEvent.count({ where: { type: "LEAVE", createdAt: { gte: new Date(`${cur.from}T03:00:00Z`), lt: new Date(new Date(`${to}T03:00:00Z`).getTime() + 864e5) }, group: { isCommunity: true } } }).catch(() => 0),
  ]);
  if (club || joins || leaves) {
    L.push("", "*Comunidade e clube*");
    if (joins || leaves) L.push(`Grupo: +${joins} entraram, ${leaves} saíram`);
    if (club) L.push(`Clube: ${club} membros ativos`);
  }
  return L.join("\n");
}
