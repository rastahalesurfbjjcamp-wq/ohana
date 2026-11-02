// Livro de comissões dos atletas e influenciadores.
// Tudo em centavos (inteiros) para não ter erro de arredondamento. Nenhum lançamento é apagado:
// pedido cancelado ou estornado vira um lançamento negativo, e o saldo é sempre a soma do livro menos os saques.
import { db } from "./db";
import { getSettings } from "./settings";
import { ordersBetween } from "./store";
import { isoDayLocal } from "./time";

export type Tier = { minCents: number; bonusCents: number };
export type Milestone = { minCents: number; prizeCents: number };
export type Program = { startDate: string; releaseDay: number; minWithdrawCents: number; tiers: Tier[]; milestones: Milestone[] };

const KEY = "_partner_program";
const PAID = new Set(["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED"]);
const VOID = new Set(["REFUNDED", "VOIDED", "EXPIRED"]);

export const cents = (v: number) => Math.round(v * 100);
export const brlc = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const monthOf = (d: Date) => isoDayLocal(d).slice(0, 7);
export const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

function defaults(): Program {
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { startDate: prev.toISOString().slice(0, 10), releaseDay: 1, minWithdrawCents: 5000, tiers: [{ minCents: 100000, bonusCents: 30000 }], milestones: [{ minCents: 1000000, prizeCents: 100000 }] };
}

export async function program(): Promise<Program> {
  const s = await db.setting.findUnique({ where: { key: KEY } });
  if (s) {
    const v = { ...defaults(), ...(s.value as Partial<Program>) };
    // premiação agora é sempre em dinheiro; marcos antigos sem valor ficam de fora
    v.milestones = (v.milestones ?? []).map((m) => ({ minCents: Number(m.minCents) || 0, prizeCents: Number((m as Partial<Milestone>).prizeCents) || 0 })).filter((m) => m.minCents > 0 && m.prizeCents > 0);
    return v;
  }
  const d = defaults();
  await db.setting.create({ data: { key: KEY, value: d } }).catch(() => null);
  return d;
}
export async function saveProgram(p: Program) {
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: p }, update: { value: p } });
}

// Dia em que a comissão do mês fica disponível (dia X do mês seguinte, 00h de Brasília)
export function releaseOf(month: string, releaseDay: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, Math.min(Math.max(releaseDay, 1), 28), 3, 0, 0));
}
function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

// Só conta o que veio depois do cadastro do parceiro no portal
export function countable(e: { orderAt: Date | null; month: string }, portalAt: Date | null | undefined) {
  if (!portalAt) return false;
  return e.orderAt ? e.orderAt >= portalAt : e.month >= monthOf(portalAt);
}
type WdRow = { status: string; amountCents: number; legacy: boolean; requestedAt: Date };
const wdCounts = (w: WdRow, portalAt: Date | null | undefined) => !w.legacy || (!!portalAt && w.requestedAt >= portalAt);

// Lê os pedidos e grava o que falta no livro. Pode rodar quantas vezes quiser: cada lançamento tem uma chave única.
export async function syncLedger(opts: { force?: boolean } = {}) {
  const last = await db.setting.findUnique({ where: { key: "_ledger_sync" } });
  const lastAt = (last?.value as { at?: string } | undefined)?.at;
  if (!opts.force && lastAt && Date.now() - Date.parse(lastAt) < 10 * 60_000) return { skipped: true };
  await db.setting.upsert({ where: { key: "_ledger_sync" }, create: { key: "_ledger_sync", value: { at: new Date().toISOString() } }, update: { value: { at: new Date().toISOString() } } });

  const prog = await program();
  const s = await getSettings();
  const partners = await db.referral.findMany({ where: { kind: { in: ["atleta", "influenciador"] } } });
  if (!partners.length) return { added: 0 };
  const byCode = new Map(partners.map((p) => [p.code.toUpperCase(), p]));
  const start = new Date(`${prog.startDate}T03:00:00Z`);
  const from = new Date(Math.max(start.getTime(), Date.now() - 59 * 864e5));
  const orders = await ordersBetween(from, new Date());
  const recent = await db.partnerEarning.findMany({ where: { kind: { in: ["venda", "estorno"] }, orderAt: { gte: new Date(from.getTime() - 864e5) } }, select: { key: true, amountCents: true, availableAt: true, month: true, referralId: true, orderId: true, pct: true } });
  const existing = new Map(recent.map((e) => [e.key, e]));
  const sumByOrder = new Map<string, number>();
  for (const e of recent) if (e.orderId) sumByOrder.set(e.orderId, (sumByOrder.get(e.orderId) ?? 0) + e.amountCents);
  let added = 0;
  for (const o of orders) {
    const code = o.codes.map((c) => c.toUpperCase()).find((c) => byCode.has(c)) ?? (o.ref && byCode.has(o.ref) ? o.ref : undefined);
    if (!code) continue;
    const p = byCode.get(code)!;
    const sale = existing.get(`venda:${o.id}`);
    const at = new Date(o.createdAt);
    const month = monthOf(at);
    if (!sale && !o.cancelled && PAID.has(o.financial) && at >= start && p.portalAt && at >= p.portalAt) {
      const pct = p.commissionPct ?? s.referral.commission;
      const base = cents(o.subtotal);
      const amount = Math.round((base * pct) / 100);
      await db.partnerEarning.create({ data: { referralId: p.id, key: `venda:${o.id}`, kind: "venda", month, orderId: o.id, orderName: o.name, orderAt: at, baseCents: base, pct, amountCents: amount, availableAt: releaseOf(month, prog.releaseDay) } }).then(() => added++).catch(() => null);
    } else if (sale && (o.cancelled || VOID.has(o.financial))) {
      // cancelado ou reembolsado inteiro: zera o que já tinha entrado desse pedido
      const left = sumByOrder.get(o.id) ?? sale.amountCents;
      if (left !== 0 && !existing.has(`estorno:${o.id}`)) await db.partnerEarning.create({ data: { referralId: sale.referralId, key: `estorno:${o.id}`, kind: "estorno", month: sale.month, orderId: o.id, orderName: o.name, orderAt: at, amountCents: -left, availableAt: sale.availableAt, note: o.cancelled ? "Pedido cancelado" : "Pedido reembolsado" } }).then(() => added++).catch(() => null);
    } else if (sale && PAID.has(o.financial)) {
      // reembolso parcial: a comissão passa a ser só sobre o valor que ficou
      const should = Math.round((cents(o.subtotal) * (sale.pct ?? 0)) / 100);
      const has = sumByOrder.get(o.id) ?? sale.amountCents;
      if (should < has) await db.partnerEarning.create({ data: { referralId: sale.referralId, key: `parcial:${o.id}:${should}`, kind: "estorno", month: sale.month, orderId: o.id, orderName: o.name, orderAt: at, baseCents: cents(o.subtotal), pct: sale.pct, amountCents: should - has, availableAt: sale.availableAt, note: "Reembolso parcial" } }).then(() => added++).catch(() => null);
    }
  }

  // Bônus por meta: quando o mês fecha, quem bateu a faixa ganha o bônus da maior faixa atingida
  const portalOf = new Map(partners.map((p) => [p.id, p.portalAt]));
  const tiers = [...prog.tiers].filter((t) => t.minCents > 0 && t.bonusCents > 0).sort((a, b) => b.minCents - a.minCents);
  if (tiers.length) {
    const startMonth = prog.startDate.slice(0, 7);
    for (let m = startMonth; releaseOf(m, prog.releaseDay).getTime() <= Date.now(); m = addMonths(m, 1)) {
      const rows = await db.partnerEarning.findMany({ where: { month: m, kind: { in: ["venda", "estorno"] } }, select: { referralId: true, orderAt: true, month: true, amountCents: true } });
      const sums = new Map<string, number>();
      for (const e of rows) if (countable(e, portalOf.get(e.referralId))) sums.set(e.referralId, (sums.get(e.referralId) ?? 0) + e.amountCents);
      for (const [referralId, total] of sums) {
        const r = { referralId };
        const t = tiers.find((x) => total >= x.minCents);
        if (!t) continue;
        await db.partnerEarning.create({ data: { referralId: r.referralId, key: `bonus:${r.referralId}:${m}`, kind: "bonus", month: m, amountCents: t.bonusCents, availableAt: releaseOf(m, prog.releaseDay), note: `Bônus por passar de ${brlc(t.minCents)} em comissão` } }).then(() => added++).catch(() => null);
      }
    }
  }

  // Fixo mensal e mínimo garantido: no fechamento do mês o parceiro recebe o maior entre o mínimo e (fixo + comissão)
  const withFixed = partners.filter((p) => (p.fixedMonthly ?? 0) > 0 || (p.minMonthly ?? 0) > 0);
  if (withFixed.length) {
    for (let m = prog.startDate.slice(0, 7); releaseOf(m, prog.releaseDay).getTime() <= Date.now(); m = addMonths(m, 1)) {
      for (const p of withFixed) {
        if (!countable({ orderAt: null, month: m }, p.portalAt)) continue;
        const rows = await db.partnerEarning.findMany({ where: { referralId: p.id, month: m, kind: { in: ["venda", "estorno"] } }, select: { orderAt: true, month: true, amountCents: true } });
        const comm = rows.filter((e) => countable(e, p.portalAt)).reduce((a, e) => a + e.amountCents, 0);
        const fixed = cents(p.fixedMonthly ?? 0), min = cents(p.minMonthly ?? 0);
        const amount = Math.max(fixed, min - comm);
        if (amount <= 0) continue;
        const note = amount > fixed ? `Fixo de ${brlc(fixed)} + complemento até o mínimo de ${brlc(min)}` : `Fixo mensal de ${brlc(fixed)}`;
        await db.partnerEarning.create({ data: { referralId: p.id, key: `fixo:${p.id}:${m}`, kind: "ajuste", month: m, amountCents: amount, availableAt: releaseOf(m, prog.releaseDay), note } }).then(() => added++).catch(() => null);
      }
    }
  }

  // Premiação em dinheiro: quando o total ganho (sem contar premiações) passa do marco, entra uma vez só
  const miles = prog.milestones.filter((m) => m.minCents > 0 && m.prizeCents > 0);
  if (miles.length) {
    const rows = await db.partnerEarning.findMany({ where: { NOT: { key: { startsWith: "premio:" } } }, select: { referralId: true, orderAt: true, month: true, amountCents: true } });
    const sums = new Map<string, number>();
    for (const e of rows) if (countable(e, portalOf.get(e.referralId))) sums.set(e.referralId, (sums.get(e.referralId) ?? 0) + e.amountCents);
    const month = monthOf(new Date());
    for (const [referralId, total] of sums) {
      const r = { referralId };
      for (const m of miles) {
        if (total < m.minCents) continue;
        await db.partnerEarning.create({ data: { referralId: r.referralId, key: `premio:${r.referralId}:${m.minCents}`, kind: "bonus", month, amountCents: m.prizeCents, availableAt: releaseOf(month, prog.releaseDay), note: `Premiação por chegar em ${brlc(m.minCents)} ganhos` } }).then(() => added++).catch(() => null);
      }
    }
  }

  // Pagamentos já marcados na tela antiga entram como saques pagos (para o saldo bater)
  const legacy = await db.payout.findMany({ where: { month: { gte: prog.startDate.slice(0, 7) } } });
  for (const p of legacy) {
    const has = await db.partnerWithdrawal.findFirst({ where: { referralId: p.referralId, note: `legado:${p.id}` } });
    if (!has) await db.partnerWithdrawal.create({ data: { referralId: p.referralId, amountCents: cents(p.amount), status: "pago", method: p.method, requestedAt: p.paidAt, paidAt: p.paidAt, paidBy: p.createdBy, note: `legado:${p.id}`, legacy: true } });
  }
  return { added };
}

export type Balance = {
  availableCents: number; pendingCents: number; progressCents: number; monthCents: number; lifetimeCents: number; paidCents: number; requestedCents: number;
  months: { month: string; cents: number; bonusCents: number; released: boolean }[];
};

export async function balanceOf(referralId: string): Promise<Balance> {
  const prog = await program();
  const now = new Date();
  const [ref, entries, wds] = await Promise.all([
    db.referral.findUnique({ where: { id: referralId }, select: { portalAt: true } }),
    db.partnerEarning.findMany({ where: { referralId }, select: { kind: true, key: true, month: true, orderAt: true, amountCents: true, availableAt: true } }),
    db.partnerWithdrawal.findMany({ where: { referralId, status: { in: ["solicitado", "pago"] } }, select: { status: true, amountCents: true, legacy: true, requestedAt: true } }),
  ]);
  const portalAt = ref?.portalAt;
  let released = 0, pending = 0, lifetime = 0, progress = 0;
  const byMonth = new Map<string, { cents: number; bonusCents: number }>();
  for (const e of entries) {
    if (!countable(e, portalAt)) continue;
    lifetime += e.amountCents;
    if (!e.key.startsWith("premio:")) progress += e.amountCents;
    if (e.availableAt <= now) released += e.amountCents; else pending += e.amountCents;
    const b = byMonth.get(e.month) ?? { cents: 0, bonusCents: 0 };
    if (e.kind === "bonus") b.bonusCents += e.amountCents; else b.cents += e.amountCents;
    byMonth.set(e.month, b);
  }
  const ok = wds.filter((w) => wdCounts(w, portalAt));
  const paid = ok.filter((w) => w.status === "pago").reduce((a, w) => a + w.amountCents, 0);
  const requested = ok.filter((w) => w.status === "solicitado").reduce((a, w) => a + w.amountCents, 0);
  const cur = monthOf(now);
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => ({ month, ...v, released: releaseOf(month, prog.releaseDay) <= now }));
  return { availableCents: released - paid - requested, pendingCents: pending, progressCents: progress, monthCents: byMonth.get(cur)?.cents ?? 0, lifetimeCents: lifetime, paidCents: paid, requestedCents: requested, months };
}

// Pedido de saque: confere o saldo dentro de uma transação para nunca sacar mais do que tem
export async function requestWithdrawal(referralId: string, amountCents: number, pixKey: string) {
  const prog = await program();
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false as const, error: "Valor inválido" };
  if (amountCents < prog.minWithdrawCents) return { ok: false as const, error: `O saque mínimo é ${brlc(prog.minWithdrawCents)}` };
  if (!pixKey.trim()) return { ok: false as const, error: "Informe a chave Pix" };
  return db.$transaction(async (tx) => {
    const open = await tx.partnerWithdrawal.count({ where: { referralId, status: "solicitado" } });
    if (open) return { ok: false as const, error: "Você já tem um saque em análise. Assim que ele for pago, pode pedir outro." };
    const [ref, earned, wd] = await Promise.all([
      tx.referral.findUnique({ where: { id: referralId }, select: { portalAt: true } }),
      tx.partnerEarning.findMany({ where: { referralId, availableAt: { lte: new Date() } }, select: { orderAt: true, month: true, amountCents: true } }),
      tx.partnerWithdrawal.findMany({ where: { referralId, status: { in: ["solicitado", "pago"] } }, select: { status: true, amountCents: true, legacy: true, requestedAt: true } }),
    ]);
    const available = earned.filter((e) => countable(e, ref?.portalAt)).reduce((a, e) => a + e.amountCents, 0) - wd.filter((w) => wdCounts(w, ref?.portalAt)).reduce((a, w) => a + w.amountCents, 0);
    if (amountCents > available) return { ok: false as const, error: `Seu saldo disponível é ${brlc(Math.max(0, available))}` };
    const w = await tx.partnerWithdrawal.create({ data: { referralId, amountCents, pixKey: pixKey.trim().slice(0, 120) } });
    await tx.referral.update({ where: { id: referralId }, data: { pixKey: pixKey.trim().slice(0, 120) } });
    return { ok: true as const, id: w.id };
  }, { isolationLevel: "Serializable" });
}
