// Rasta Hale Club: níveis por tempo, brindes (pedido R$ 0), aniversário, limite de compras com desconto,
// indicação do club, eventos com pontos, sorteio do mês e top compradores.
import { db } from "./db";
import { getSettings, type Settings } from "./settings";
import { gqlNew } from "./shopify";
import { gql } from "./store";
import { addPoints, isActiveAt, memberState, tagCustomer } from "./club";
import { enqueue } from "./queue";
import { isoDayLocal } from "./time";

type Club = Settings["club"];
type M = { id: string; name: string; status: string; paidUntil: Date | null; joinedAt: Date };

const rand = (n: number) => Array.from({ length: n }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
const baseName = (name: string, n = 8) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, n) || "MEMBRO";
export const monthKey = (d = new Date()) => isoDayLocal(d).slice(0, 7);

// Meses completos de club (contando da entrada)
export function monthsIn(m: { joinedAt: Date }, at = new Date()) {
  const a = new Date(m.joinedAt), b = at;
  let n = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) n--;
  return Math.max(0, n);
}
export const TIERS = [0, 3, 6, 12] as const;
export const tierOf = (months: number) => (months >= 12 ? 12 : months >= 6 ? 6 : months >= 3 ? 3 : 0);
export const tierName = (t: number) => (t === 0 ? "Membro" : `${t} meses`);
export const nextTier = (t: number) => (t === 0 ? 3 : t === 3 ? 6 : t === 6 ? 12 : null);
export const pointsRate = (m: { joinedAt: Date }, c: Club) => (monthsIn(m) >= 6 && c.t6Points > 0 ? c.t6Points : c.pointsPerReal);

export function tierPerks(t: number, c: Club): string[] {
  if (t === 0) return [`Camiseta do club + patch da bandeira`, c.usesPerMonth ? `${c.discountPct}% em ${c.usesPerMonth} compras por mês` : `${c.discountPct}% em toda compra`, `${c.pointsPerReal === 1 ? "1 ponto" : `${c.pointsPerReal} pontos`} por real`, "Acesso antecipado às coleções"];
  if (t === 3) return [`Brinde: ${c.t3Gift.replace(/\s*\(.*\)$/, "")}`, "Coleção exclusiva 3 meses"];
  if (t === 6) return [`${c.t6Points} pontos por real`, "Coleção exclusiva 6 meses"];
  return [`${c.t12Gift.replace(/\s*\(.*\)$/, "")}`, "Coleção exclusiva 12 meses"];
}

// Código do link de indicação: NOME ou NOME2, NOME3...
export async function ensureRefCode(memberId: string) {
  const m = await db.clubMember.findUnique({ where: { id: memberId }, select: { id: true, name: true, refCode: true } });
  if (!m || m.refCode) return m?.refCode ?? null;
  const base = baseName(m.name.split(" ")[0]);
  for (let i = 0; i < 30; i++) {
    const code = i === 0 ? base : i < 20 ? `${base}${i + 1}` : `${base}${rand(3)}`;
    try {
      await db.clubMember.update({ where: { id: m.id }, data: { refCode: code } });
      return code;
    } catch {
      // código já usado por outro membro
    }
  }
  return null;
}

/* ---------- Brindes: pedido de R$ 0 na Shopify ---------- */

type Addr = { zip?: string; street?: string; number?: string; extra?: string; district?: string; city?: string; state?: string };

export async function ensurePerk(memberId: string, kind: "kit" | "nivel3" | "nivel12", title: string) {
  await db.clubPerk.upsert({ where: { memberId_kind: { memberId, kind } }, create: { memberId, kind, title }, update: {} });
}

async function giftOrder(m: { name: string; customerId: string | null; email: string | null; phone: string | null; address: unknown; shirtSize: string | null }, title: string, kind: string) {
  const a = (m.address ?? {}) as Addr;
  if (!a.zip || !a.street || !a.city) return { status: "sem_endereco" as const };
  const [first, ...rest] = m.name.trim().split(/\s+/);
  const lineTitle = kind === "kit" && m.shirtSize ? `${title} · camiseta ${m.shirtSize}` : title;
  const input = {
    note: `Brinde do club (${kind === "kit" ? "boas-vindas" : kind === "nivel3" ? "3 meses" : "12 meses"}). Criado pelo Hub.`,
    tags: ["clube", "brinde"],
    email: m.email ?? undefined,
    ...(m.customerId ? { purchasingEntity: { customerId: m.customerId } } : {}),
    lineItems: [{ title: lineTitle, quantity: 1, originalUnitPriceWithCurrency: { amount: "0.00", currencyCode: "BRL" }, requiresShipping: true, taxable: false }],
    shippingAddress: { firstName: first, lastName: rest.join(" ") || first, address1: `${a.street}, ${a.number ?? "s/n"}`, address2: [a.extra, a.district].filter(Boolean).join(" · ") || undefined, city: a.city, provinceCode: a.state, zip: a.zip, countryCode: "BR", phone: m.phone ? `+${m.phone}` : undefined },
  };
  const d = await gqlNew<{ draftOrderCreate: { draftOrder: { id: string } | null; userErrors: { message: string }[] } }>(
    `mutation($input: DraftOrderInput!){ draftOrderCreate(input:$input){ draftOrder{ id } userErrors{ message } } }`, { input },
  );
  const e = d.draftOrderCreate.userErrors[0];
  if (e || !d.draftOrderCreate.draftOrder) throw new Error(e?.message ?? "Rascunho não criado");
  const c = await gqlNew<{ draftOrderComplete: { draftOrder: { order: { id: string; name: string } | null } | null; userErrors: { message: string }[] } }>(
    `mutation($id: ID!){ draftOrderComplete(id:$id){ draftOrder{ order{ id name } } userErrors{ message } } }`, { id: d.draftOrderCreate.draftOrder.id },
  );
  const o = c.draftOrderComplete.draftOrder?.order;
  if (c.draftOrderComplete.userErrors[0] || !o) throw new Error(c.draftOrderComplete.userErrors[0]?.message ?? "Pedido não criado");
  return { status: "criado" as const, orderId: o.id, orderName: o.name };
}

// Cria os pedidos dos brindes pendentes (e tenta de novo os que deram erro ou estavam sem endereço)
export async function processPerks(limit = 10) {
  const perks = await db.clubPerk.findMany({ where: { status: { in: ["pendente", "erro", "sem_endereco"] }, updatedAt: { lte: new Date(Date.now() - 10 * 60_000) } }, include: { member: true }, take: limit, orderBy: { createdAt: "asc" } });
  const fresh = await db.clubPerk.findMany({ where: { status: "pendente" }, include: { member: true }, take: limit });
  const all = [...new Map([...fresh, ...perks].map((p) => [p.id, p])).values()].slice(0, limit);
  for (const p of all) {
    if (p.member.status === "cancelado" && p.kind !== "kit") continue;
    try {
      const r = await giftOrder(p.member, p.title, p.kind);
      await db.clubPerk.update({ where: { id: p.id }, data: { status: r.status, orderId: "orderId" in r ? r.orderId : null, orderName: "orderName" in r ? r.orderName : null, error: null } });
      if (r.status === "criado") await db.clubEvent.create({ data: { memberId: p.memberId, kind: "resgate", text: `Brinde criado: ${p.title} (${r.orderName})` } }).catch(() => null);
    } catch (e) {
      const msg = String(e).replace(/^Error: /, "").slice(0, 180);
      await db.clubPerk.update({ where: { id: p.id }, data: { status: "erro", error: /access|scope|denied|permission/i.test(msg) ? "Falta a permissão de pedidos na Shopify: reconecte a loja em Integrações" : msg } });
    }
  }
}

/* ---------- Níveis por tempo ---------- */

export async function runTiers() {
  const c = (await getSettings()).club;
  const members = await db.clubMember.findMany({ where: { status: { not: "cancelado" } } });
  for (const m of members) {
    if (!isActiveAt(m, new Date(), c.graceDays)) continue;
    const t = tierOf(monthsIn(m));
    if (t <= m.tierGiven) continue;
    if (t >= 3 && m.tierGiven < 3) await ensurePerk(m.id, "nivel3", c.t3Gift);
    if (t >= 12 && m.tierGiven < 12) await ensurePerk(m.id, "nivel12", c.t12Gift);
    await db.clubMember.update({ where: { id: m.id }, data: { tierGiven: t } });
    await db.clubEvent.create({ data: { memberId: m.id, kind: "voltou", text: `Subiu para o nível ${tierName(t)}` } }).catch(() => null);
    if (c.msgTier) await enqueue("club-msg", { memberId: m.id, kind: "nivel", tier: t }, { jobId: `ct-${m.id}-${t}` }).catch(() => null);
  }
}

/* ---------- Aniversário ---------- */

const endOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); };

export async function runBirthdays() {
  const c = (await getSettings()).club;
  if (!c.birthdayPct) return 0;
  const month = new Date().getMonth();
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const members = await db.clubMember.findMany({ where: { status: { not: "cancelado" }, birthDate: { not: null } } });
  let n = 0;
  for (const m of members) {
    if (m.birthDate!.getUTCMonth() !== month || !isActiveAt(m, new Date(), c.graceDays)) continue;
    if (await db.clubReward.findFirst({ where: { memberId: m.id, kind: "aniversario", createdAt: { gte: yearStart } } })) continue;
    const code = `NIVER${baseName(m.name.split(" ")[0], 6)}${rand(3)}`;
    const d = await gqlNew<{ discountCodeBasicCreate: { codeDiscountNode: { id: string } | null; userErrors: { message: string }[] } }>(
      `mutation($input: DiscountCodeBasicInput!){ discountCodeBasicCreate(basicCodeDiscount:$input){ codeDiscountNode{ id } userErrors{ message } } }`,
      { input: { title: `Aniversário ${m.name}`, code, startsAt: new Date().toISOString(), endsAt: endOfMonth().toISOString(), context: m.customerId ? { customers: { add: [m.customerId] } } : { all: "ALL" }, usageLimit: 1, appliesOncePerCustomer: true, customerGets: { value: { percentage: c.birthdayPct / 100 }, items: { all: true } }, combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true } } },
    ).catch((e) => ({ discountCodeBasicCreate: { codeDiscountNode: null, userErrors: [{ message: String(e) }] } }));
    if (!d.discountCodeBasicCreate.codeDiscountNode) continue;
    await db.clubReward.create({ data: { memberId: m.id, code, discountId: d.discountCodeBasicCreate.codeDiscountNode.id, value: 0, points: 0, kind: "aniversario", expiresAt: endOfMonth() } });
    await db.clubEvent.create({ data: { memberId: m.id, kind: "resgate", text: `Cupom de aniversário de ${c.birthdayPct}%: ${code}` } }).catch(() => null);
    if (c.msgBirthday) await enqueue("club-msg", { memberId: m.id, kind: "aniversario", code }, { jobId: `cb-${m.id}-${monthKey()}` }).catch(() => null);
    n++;
  }
  return n;
}

/* ---------- Indicação do club ---------- */

export async function affiliateRows(month = monthKey()) {
  const c = (await getSettings()).club;
  const [y, mo] = month.split("-").map(Number);
  const end = new Date(y, mo, 0, 23, 59, 59);
  const referred = await db.clubMember.findMany({ where: { referredById: { not: null }, joinedAt: { lte: end } }, select: { referredById: true, status: true, paidUntil: true, courtesy: true } });
  const counts = new Map<string, number>();
  for (const r of referred) if (!r.courtesy && isActiveAt(r, end < new Date() ? end : new Date(), c.graceDays)) counts.set(r.referredById!, (counts.get(r.referredById!) ?? 0) + 1);
  const ids = [...counts.keys()];
  const [members, paid] = await Promise.all([
    db.clubMember.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, phone: true, refCode: true } }),
    db.clubAffPayout.findMany({ where: { month, memberId: { in: ids } } }),
  ]);
  const paidBy = new Map(paid.map((p) => [p.memberId, p]));
  return members.map((m) => ({ ...m, count: counts.get(m.id) ?? 0, amount: Math.round((counts.get(m.id) ?? 0) * c.fee * c.affiliatePct) / 100, paidAt: paidBy.get(m.id)?.paidAt ?? null })).sort((a, b) => b.count - a.count);
}

/* ---------- Eventos com pontos ---------- */

export async function joinMeet(memberId: string, meetId: string) {
  const c = (await getSettings()).club;
  const [m, e] = await Promise.all([db.clubMember.findUnique({ where: { id: memberId } }), db.clubMeet.findUnique({ where: { id: meetId }, include: { _count: { select: { tickets: true } } } })]);
  if (!m || !e || !e.active) throw new Error("Evento não encontrado");
  if (!isActiveAt(m, new Date(), c.graceDays)) throw new Error("Sua assinatura precisa estar em dia");
  if (e.date.getTime() < Date.now() - 864e5) throw new Error("Esse evento já passou");
  if (await db.clubTicket.findUnique({ where: { meetId_memberId: { meetId, memberId } } })) throw new Error("Você já está na lista desse evento");
  if (e._count.tickets >= e.slots) throw new Error("As vagas acabaram");
  if (m.points < e.points) throw new Error(`Faltam ${e.points - m.points} pontos para esse evento`);
  await db.clubTicket.create({ data: { meetId, memberId } });
  await addPoints(memberId, -e.points, "evento", e.id, `Entrada: ${e.title}`);
  await db.clubEvent.create({ data: { memberId, kind: "resgate", text: `Trocou ${e.points} pontos pela entrada em ${e.title}` } }).catch(() => null);
}

/* ---------- Sorteio do mês ---------- */

export const parsePrizes = (txt: string) => txt.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [t, n] = l.split("|"); return { title: t.trim(), n: Math.max(1, Math.min(20, Number(n) || 1)) }; });

export async function drawRaffle(month = monthKey()) {
  const c = (await getSettings()).club;
  if (await db.clubRaffle.findUnique({ where: { month } })) throw new Error("O sorteio deste mês já foi feito");
  const pool = (await db.clubMember.findMany({ where: { status: { not: "cancelado" } }, select: { id: true, name: true, status: true, paidUntil: true } })).filter((m) => memberState(m, c.graceDays).k === "em_dia" || memberState(m, c.graceDays).k === "vencendo");
  const bag = [...pool];
  const winners: { prize: string; memberId: string; name: string }[] = [];
  for (const p of parsePrizes(c.rafflePrizes)) {
    for (let i = 0; i < p.n && bag.length; i++) {
      const k = Math.floor(Math.random() * bag.length);
      const w = bag.splice(k, 1)[0];
      winners.push({ prize: p.title, memberId: w.id, name: w.name });
    }
  }
  if (!winners.length) throw new Error("Nenhum membro em dia para sortear");
  await db.clubRaffle.create({ data: { month, winners } });
  for (const w of winners) await db.clubEvent.create({ data: { memberId: w.memberId, kind: "resgate", text: `Ganhou no sorteio: ${w.prize}` } }).catch(() => null);
  return winners;
}

/* ---------- Top compradores e club de cortesia ---------- */

export type TopBuyer = { id: string; name: string; email: string | null; phone: string | null; orders: number; spent: number };
export async function topBuyers(n = 5): Promise<TopBuyer[]> {
  const r = await gql<{ customers: { nodes: { id: string; displayName: string; defaultEmailAddress: { emailAddress: string } | null; defaultPhoneNumber: { phoneNumber: string } | null; numberOfOrders: string; amountSpent: { amount: string } }[] } }>(
    `query($n:Int!){ customers(first:$n, sortKey: AMOUNT_SPENT, reverse: true){ nodes{ id displayName defaultEmailAddress{ emailAddress } defaultPhoneNumber{ phoneNumber } numberOfOrders amountSpent{ amount } } } }`, { n },
  );
  return r.customers.nodes.map((c) => ({ id: c.id, name: c.displayName, email: c.defaultEmailAddress?.emailAddress ?? null, phone: (c.defaultPhoneNumber?.phoneNumber ?? "").replace(/\D/g, "") || null, orders: Number(c.numberOfOrders) || 0, spent: Number(c.amountSpent.amount) || 0 }));
}

// Club de graça por um ano (ex.: top compradores). Cria o membro, cupom, marcação e o kit.
export async function grantCourtesy(b: TopBuyer, months = 12) {
  const c = (await getSettings()).club;
  let m = await db.clubMember.findFirst({ where: { OR: [{ customerId: b.id }, ...(b.email ? [{ email: b.email.toLowerCase() }] : [])] } });
  const until = new Date();
  until.setMonth(until.getMonth() + months);
  if (m) m = await db.clubMember.update({ where: { id: m.id }, data: { status: "ativo", canceledAt: null, courtesy: true, paidUntil: m.paidUntil && m.paidUntil > until ? m.paidUntil : until, customerId: m.customerId ?? b.id } });
  else m = await db.clubMember.create({ data: { name: b.name, email: b.email?.toLowerCase() ?? null, phone: b.phone, customerId: b.id, fee: 0, provider: "cortesia", courtesy: true, paidUntil: until, note: "Club de cortesia (top compradores)" } });
  await tagCustomer(b.id);
  const { ensureMemberCode } = await import("./club");
  await ensureMemberCode(m.id).catch(() => null);
  await ensureRefCode(m.id);
  await ensurePerk(m.id, "kit", c.kitTitle);
  await db.clubEvent.create({ data: { memberId: m.id, kind: "assinou", text: `Ganhou o club de cortesia por ${months} meses` } }).catch(() => null);
  return m;
}

// Rotina diária do club
export async function clubDaily() {
  await runTiers().catch((e) => console.error("[club níveis]", e));
  await runBirthdays().catch((e) => console.error("[club aniversário]", e));
}
