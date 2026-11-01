// Histórico de vendas por cupom, guardado no banco.
// Mês fechado (antes do mês passado) não muda mais: busca uma vez na Shopify e fica salvo.
// Mês passado e mês atual continuam sendo lidos ao vivo (ainda pode ter estorno e troca).
import { db } from "./db";
import { costResolver } from "./report";
import { shopCreatedAt, shopifyql, unitCostsByTitle } from "./shopify";
import { isoDayLocal } from "./time";

const DONE = "_coupon_months2"; // v2: soma todas as grafias do cupom
const num = (v?: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const okCode = (c: string) => /^[\w-]{2,40}$/.test(c);

export type Agg = { orders: number; gross: number; net: number; items: number; cogs: number; missing: number };
export const zero = (): Agg => ({ orders: 0, gross: 0, net: 0, items: 0, cogs: 0, missing: 0 });

// primeiro dia do mês passado: daqui para trás está fechado
export function openFrom(today = isoDayLocal()) {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 10);
}
const monthEnd = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const nextMonth = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7); };
const monthsBetween = (from: string, to: string) => { const out: string[] = []; for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = nextMonth(m)) out.push(m); return out; };

async function doneMap(): Promise<Record<string, string[]>> {
  const s = await db.setting.findUnique({ where: { key: DONE } });
  return (s?.value as Record<string, string[]>) ?? {};
}
async function markDone(code: string, month: string) {
  const cur = await doneMap();
  const list = new Set(cur[code] ?? []);
  list.add(month);
  cur[code] = [...list].sort();
  await db.setting.upsert({ where: { key: DONE }, create: { key: DONE, value: cur }, update: { value: cur } });
}

// Busca um mês fechado de um cupom (dia a dia) e guarda
export async function syncCouponMonth(code: string, month: string) {
  if (!okCode(code)) return;
  const from = `${month}-01`, to = monthEnd(month);
  const { codeVariants, inList } = await import("./history");
  const vs = inList(await codeVariants(code));
  const days = await shopifyql(`FROM sales SHOW orders, gross_sales, net_sales, net_items_sold WHERE discount_code IN (${vs}) TIMESERIES day SINCE ${from} UNTIL ${to}`);
  const active = days.filter((r) => num(r.orders) || num(r.net_sales) || num(r.net_items_sold));
  const byDay = new Map<string, Agg>();
  for (const r of active) byDay.set(String(r.day).slice(0, 10), { orders: num(r.orders), gross: num(r.gross_sales), net: num(r.net_sales), items: num(r.net_items_sold), cogs: 0, missing: 0 });
  if (byDay.size) {
    const [resolve, costs] = await Promise.all([costResolver(), unitCostsByTitle().catch(() => new Map<string, number>())]);
    const rows = await shopifyql(`FROM sales SHOW net_items_sold WHERE discount_code IN (${vs}) GROUP BY day, product_title SINCE ${from} UNTIL ${to} LIMIT 1000`);
    for (const r of rows) {
      const a = byDay.get(String(r.day).slice(0, 10));
      const q = num(r.net_items_sold);
      if (!a || q <= 0) continue;
      const c = resolve(r.product_title, costs.get(r.product_title) ?? null);
      if (c == null) a.missing += q; else a.cogs += c * q;
    }
  }
  await db.$transaction([
    db.couponDay.deleteMany({ where: { code, day: { gte: from, lte: to } } }),
    ...[...byDay.entries()].map(([day, a]) => db.couponDay.create({ data: { code, day, ...a } })),
  ]);
  await markDone(code, month);
}

// Preenche aos poucos o histórico dos cupons dos atletas (mais recente primeiro)
export async function syncCouponHistory(maxMonths = 6) {
  const partners = await db.referral.findMany({ where: { kind: { in: ["atleta", "influenciador"] } }, select: { code: true, createdAt: true } });
  if (!partners.length) return { synced: 0 };
  const done = await doneMap();
  const lastClosed = new Date(Date.parse(`${openFrom()}T12:00:00Z`) - 864e5).toISOString().slice(0, 7);
  const start = (await shopCreatedAt().catch(() => "2024-01-01")).slice(0, 7);
  const todo: [string, string][] = [];
  for (const m of monthsBetween(`${start}-01`, `${lastClosed}-01`).reverse()) for (const p of partners) if (okCode(p.code) && !(done[p.code] ?? []).includes(m)) todo.push([p.code, m]);
  let synced = 0;
  for (const [code, m] of todo.slice(0, maxMonths)) {
    await syncCouponMonth(code, m).then(() => synced++).catch((e) => console.error("[cupons]", code, m, String(e).slice(0, 160)));
  }
  return { synced, left: Math.max(0, todo.length - synced) };
}

// Soma o que está guardado; diz se todos os meses do período já estão salvos para cada cupom
export async function storedCouponSales(codes: string[], from: string, to: string) {
  const done = await doneMap();
  const months = monthsBetween(from, to);
  const out = new Map<string, Agg>();
  const complete = new Set<string>();
  for (const c of codes) { out.set(c, zero()); if (months.every((m) => (done[c] ?? []).includes(m))) complete.add(c); }
  const rows = await db.couponDay.findMany({ where: { code: { in: codes }, day: { gte: from, lte: to } } });
  for (const r of rows) { const a = out.get(r.code)!; a.orders += r.orders; a.gross += r.gross; a.net += r.net; a.items += r.items; a.cogs += r.cogs; a.missing += r.missing; }
  return { byCode: out, complete };
}
