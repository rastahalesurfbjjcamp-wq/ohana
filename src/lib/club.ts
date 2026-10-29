// Clube de fidelidade: membros, pontos, cupom de membro e cupom de resgate na Shopify.
import { db } from "./db";
import { getSettings } from "./settings";
import { gql, ordersBetween, type Order } from "./store";
import { normalizePhone } from "./segments";

export const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
export const maskCpf = (c: string | null) => (c && c.length === 11 ? `${c.slice(0, 3)}.***.***-${c.slice(9)}` : c ?? "");
export const fmtCpf = (c: string | null) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c ?? "");
const rand = (n: number) => Array.from({ length: n }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

export function cpfValid(c: string) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

// Situação do membro hoje
export function memberState(m: { status: string; paidUntil: Date | null }, graceDays: number) {
  if (m.status === "cancelado") return { k: "cancelado", label: "Cancelado", tone: "n" };
  if (!m.paidUntil) return { k: "pendente", label: "Sem pagamento", tone: "s" };
  const now = Date.now();
  if (m.paidUntil.getTime() >= now) return { k: "em_dia", label: "Em dia", tone: "l" };
  if (m.paidUntil.getTime() + graceDays * 864e5 >= now) return { k: "vencendo", label: "Venceu, na tolerância", tone: "s" };
  return { k: "atrasado", label: "Atrasado", tone: "c" };
}
export const isActiveAt = (m: { status: string; paidUntil: Date | null }, at: Date, graceDays: number) =>
  m.status !== "cancelado" && !!m.paidUntil && m.paidUntil.getTime() + graceDays * 864e5 >= at.getTime();

// Procura o membro por CPF, telefone, e-mail ou nome
export async function findMembers(q: string) {
  const t = q.trim();
  if (!t) return [];
  const d = digits(t);
  const phone = normalizePhone(t);
  const or: object[] = [];
  if (d.length === 11) or.push({ cpf: d });
  if (phone) or.push({ phone });
  if (t.includes("@")) or.push({ email: { equals: t.toLowerCase(), mode: "insensitive" } });
  if (!/^\d+$/.test(t.replace(/[\s().-]/g, ""))) or.push({ name: { contains: t, mode: "insensitive" } }, { code: { equals: t, mode: "insensitive" } });
  if (!or.length) return [];
  return db.clubMember.findMany({ where: { OR: or }, take: 8, orderBy: { joinedAt: "desc" } });
}

export type ShopCustomer = { id: string; name: string; email: string | null; phone: string | null; cpf: string | null; orders: number; spent: number };

// Procura a pessoa na Shopify (e-mail, telefone ou CPF que aparece nos pedidos)
export async function findShopifyCustomer(p: { email?: string | null; phone?: string | null; cpf?: string | null }): Promise<ShopCustomer | null> {
  const tryQuery = async (q: string) => {
    const r = await gql<{ customers: { nodes: { id: string; displayName: string; defaultEmailAddress: { emailAddress: string } | null; defaultPhoneNumber: { phoneNumber: string } | null; numberOfOrders: string; amountSpent: { amount: string } }[] } }>(
      `query($q:String){ customers(first:1, query:$q){ nodes{ id displayName defaultEmailAddress{ emailAddress } defaultPhoneNumber{ phoneNumber } numberOfOrders amountSpent{ amount } } } }`,
      { q },
    ).catch(() => null);
    const c = r?.customers.nodes[0];
    return c ? { id: c.id, name: c.displayName, email: c.defaultEmailAddress?.emailAddress ?? null, phone: c.defaultPhoneNumber?.phoneNumber ?? null, cpf: null, orders: Number(c.numberOfOrders) || 0, spent: Number(c.amountSpent.amount) || 0 } : null;
  };
  if (p.email) { const c = await tryQuery(`email:${p.email}`); if (c) return c; }
  if (p.phone) { const c = await tryQuery(`phone:+${p.phone}`); if (c) return c; }
  if (p.cpf) {
    // o CPF fica no pedido: procura nos pedidos do último ano
    const orders = await ordersBetween(new Date(Date.now() - 365 * 864e5), new Date()).catch(() => [] as Order[]);
    const hit = orders.filter((o) => o.cpf === p.cpf && o.customerId);
    if (hit.length) {
      const o = hit[0];
      return { id: o.customerId!, name: o.customer, email: o.email, phone: o.phone, cpf: p.cpf, orders: hit.length, spent: hit.reduce((a, x) => a + x.subtotal, 0) };
    }
  }
  return null;
}

async function discountCreate(input: Record<string, unknown>) {
  const d = await gql<{ discountCodeBasicCreate: { codeDiscountNode: { id: string } | null; userErrors: { message: string }[] } }>(
    `mutation($input: DiscountCodeBasicInput!){ discountCodeBasicCreate(basicCodeDiscount:$input){ codeDiscountNode{ id } userErrors{ message } } }`,
    { input },
  );
  const e = d.discountCodeBasicCreate.userErrors[0];
  if (e) throw new Error(e.message);
  return d.discountCodeBasicCreate.codeDiscountNode?.id ?? null;
}
const contextFor = (customerId: string | null) => (customerId ? { customers: { add: [customerId] } } : { all: "ALL" });

// Cupom de membro: desconto em toda compra, só vale para o próprio cliente na Shopify
export async function createMemberCode(name: string, customerId: string | null, percent: number) {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8) || "MEMBRO";
  const code = `CLUBE${base}${rand(2)}`;
  const id = await discountCreate({ title: `Clube ${name}`, code, startsAt: new Date().toISOString(), context: contextFor(customerId), customerGets: { value: { percentage: percent / 100 }, items: { all: true } }, tags: ["clube"] });
  return { code, id };
}

export async function setCodeActive(discountId: string, on: boolean) {
  const m = on ? "discountCodeActivate" : "discountCodeDeactivate";
  const d = await gql<Record<string, { userErrors: { message: string }[] }>>(`mutation($id:ID!){ ${m}(id:$id){ userErrors{ message } } }`, { id: discountId });
  const e = d[m]?.userErrors[0];
  if (e) throw new Error(e.message);
}

export async function tagCustomer(customerId: string, tag = "clube") {
  await gql(`mutation($id:ID!,$t:[String!]!){ tagsAdd(id:$id, tags:$t){ userErrors{ message } } }`, { id: customerId, t: [tag] }).catch(() => null);
}

// Lança pontos uma vez só por motivo + referência
export async function addPoints(memberId: string, delta: number, reason: string, ref = "", note?: string, by?: string) {
  if (!delta && reason !== "evento") return false;
  try {
    await db.$transaction([
      db.clubPoints.create({ data: { memberId, delta, reason, ref, note, createdBy: by } }),
      db.clubMember.update({ where: { id: memberId }, data: { points: { increment: delta } } }),
    ]);
    return true;
  } catch {
    return false; // já lançado
  }
}

// Troca pontos por um cupom de valor fixo, de uso único
export async function createReward(memberId: string, points: number, by?: string) {
  const s = (await getSettings()).club;
  const m = await db.clubMember.findUnique({ where: { id: memberId } });
  if (!m) throw new Error("Membro não encontrado");
  if (points < s.minRedeem) throw new Error(`O mínimo para resgatar é ${s.minRedeem} pontos`);
  if (points > m.points) throw new Error("Pontos insuficientes");
  const value = Math.round(((points / 100) * s.valuePer100) * 100) / 100;
  const code = `RESGATE${rand(6)}`;
  const id = await discountCreate({
    title: `Resgate de pontos ${m.name}`, code, startsAt: new Date().toISOString(), context: contextFor(m.customerId),
    usageLimit: 1, appliesOncePerCustomer: true,
    customerGets: { value: { discountAmount: { amount: value.toFixed(2), appliesOnEachItem: false } }, items: { all: true } },
    combinesWith: { orderDiscounts: false, productDiscounts: true, shippingDiscounts: true }, tags: ["clube", "resgate"],
  });
  const r = await db.clubReward.create({ data: { memberId, code, discountId: id, value, points } });
  await addPoints(memberId, -points, "resgate", r.id, `Cupom ${code} de R$ ${value.toFixed(2).replace(".", ",")}`, by);
  return r;
}

// Mensalidade paga: estende a validade, religa o cupom de membro e dá os pontos do mês
export async function registerPayment(memberId: string, months: number, by?: string, ref?: string) {
  const s = (await getSettings()).club;
  const m = await db.clubMember.findUnique({ where: { id: memberId } });
  if (!m) throw new Error("Membro não encontrado");
  const base = m.paidUntil && m.paidUntil.getTime() > Date.now() ? new Date(m.paidUntil) : new Date();
  const until = new Date(base);
  until.setMonth(until.getMonth() + months);
  await db.clubMember.update({ where: { id: m.id }, data: { paidUntil: until, status: "ativo" } });
  if (m.discountId && !m.codeActive) {
    await setCodeActive(m.discountId, true).catch(() => null);
    await db.clubMember.update({ where: { id: m.id }, data: { codeActive: true } });
  }
  const month = new Date().toISOString().slice(0, 7);
  for (let i = 0; i < months; i++) await addPoints(m.id, s.monthlyPoints, "mensalidade", ref ? `${ref}-${i}` : `${month}-${i}-${Date.now()}`, `Mensalidade paga`, by);
  return until;
}

const PAID = new Set(["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED"]);

// Roda de tempos em tempos: pontos das compras, estornos, cupons usados e cupom de quem atrasou
export async function scanClub(days = 4) {
  const s = (await getSettings()).club;
  if (!s.enabled) return { points: 0 };
  const members = await db.clubMember.findMany({ where: { status: { not: "cancelado" } } });
  if (!members.length) return { points: 0 };
  const byCustomer = new Map(members.filter((m) => m.customerId).map((m) => [m.customerId!, m]));
  const byCpf = new Map(members.filter((m) => m.cpf).map((m) => [m.cpf!, m]));
  const byEmail = new Map(members.filter((m) => m.email).map((m) => [m.email!.toLowerCase(), m]));
  const byPhone = new Map(members.filter((m) => m.phone).map((m) => [m.phone!, m]));
  const rewards = await db.clubReward.findMany({ where: { usedAt: null } });
  const rewardBy = new Map(rewards.map((r) => [r.code.toUpperCase(), r]));
  const orders = await ordersBetween(new Date(Date.now() - days * 864e5), new Date());
  let given = 0;
  for (const o of orders) {
    for (const c of o.codes) {
      const r = rewardBy.get(c);
      if (r) await db.clubReward.update({ where: { id: r.id }, data: { usedAt: new Date(o.createdAt), orderName: o.name } });
    }
    const m = (o.customerId && byCustomer.get(o.customerId)) || (o.cpf && byCpf.get(o.cpf)) || (o.email && byEmail.get(o.email.toLowerCase())) || (normalizePhone(o.phone) && byPhone.get(normalizePhone(o.phone)!)) || null;
    if (!m) continue;
    if (!m.customerId && o.customerId) { await db.clubMember.update({ where: { id: m.id }, data: { customerId: o.customerId } }); m.customerId = o.customerId; }
    if (!m.cpf && o.cpf) await db.clubMember.update({ where: { id: m.id }, data: { cpf: o.cpf } }).catch(() => null);
    const lost = o.cancelled || o.financial === "REFUNDED" || o.financial === "VOIDED";
    if (lost) {
      const e = await db.clubPoints.findUnique({ where: { memberId_reason_ref: { memberId: m.id, reason: "compra", ref: o.id } } });
      if (e && e.delta > 0) await addPoints(m.id, -e.delta, "estorno", o.id, `Pedido ${o.name} cancelado ou estornado`);
      continue;
    }
    if (!PAID.has(o.financial) || !isActiveAt(m, new Date(o.createdAt), s.graceDays)) continue;
    const pts = Math.floor(o.subtotal * s.pointsPerReal);
    if (await addPoints(m.id, pts, "compra", o.id, `Pedido ${o.name}`)) given += pts;
  }
  // cupom de membro: desliga de quem passou da tolerância, religa de quem está em dia
  for (const m of members) {
    if (!m.discountId) continue;
    const ok = isActiveAt(m, new Date(), s.graceDays);
    if (ok !== m.codeActive) {
      try {
        await setCodeActive(m.discountId, ok);
        await db.clubMember.update({ where: { id: m.id }, data: { codeActive: ok } });
      } catch {
        // tenta de novo na próxima rodada
      }
    }
  }
  return { points: given };
}

export function clubMessage(m: { name: string; code: string | null; points: number }, c: { name: string; discountPct: number; valuePer100: number; earlyHours: number }, store: string) {
  const first = m.name.split(" ")[0];
  return [
    `Oi, ${first}! Bem-vindo ao ${c.name}.`,
    "",
    m.code ? `Seu cupom de membro: ${m.code} (${c.discountPct}% em toda compra, só funciona na sua conta)` : "",
    m.code ? `Link que já aplica o cupom: ${store.replace(/\/$/, "")}/discount/${m.code}` : "",
    "",
    "Como funciona:",
    `1. Você tem acesso antecipado aos lançamentos, ${c.earlyHours} horas antes de todo mundo.`,
    `2. Cada compra soma pontos. A cada 100 pontos você troca por R$ ${c.valuePer100.toFixed(2).replace(".", ",")} de desconto.`,
    "3. Nos eventos, é só falar o seu CPF para resgatar os pontos ou entrar.",
    `Seu saldo hoje: ${m.points} pontos.`,
  ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
}

// Troca pontos por uma peça do catálogo: cupom de 100% só para aquele produto, uso único, só na conta do membro
export async function createPrizeReward(memberId: string, prizeId: string, by?: string) {
  const [m, p] = await Promise.all([db.clubMember.findUnique({ where: { id: memberId } }), db.clubPrize.findUnique({ where: { id: prizeId } })]);
  if (!m || !p || !p.active) throw new Error("Recompensa não encontrada");
  if (m.points < p.points) throw new Error(`Faltam ${p.points - m.points} pontos para essa peça`);
  if (!p.productId) throw new Error("Essa recompensa não está ligada a um produto da loja");
  const code = `PECA${rand(6)}`;
  const id = await discountCreate({
    title: `Resgate ${p.title} - ${m.name}`, code, startsAt: new Date().toISOString(), context: contextFor(m.customerId),
    usageLimit: 1, appliesOncePerCustomer: true,
    customerGets: { value: { percentage: 1 }, items: { products: { productsToAdd: [p.productId] } } },
    combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true }, tags: ["clube", "resgate", "peca"],
  });
  const r = await db.clubReward.create({ data: { memberId, code, discountId: id, value: 0, points: p.points } });
  await addPoints(memberId, -p.points, "resgate", r.id, `${p.title} (cupom ${code})`, by);
  await db.clubEvent.create({ data: { memberId, kind: "resgate", text: `Trocou ${p.points} pontos por ${p.title}` } }).catch(() => null);
  return r;
}
