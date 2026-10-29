// Atletas e influenciadores: vendas pelo cupom de cada um, lucro e comissão.
import { db } from "./db";
import { costResolver } from "./report";
import { getSettings } from "./settings";
import { gql, ordersBetween, type Order } from "./store";
import { dayRange, isoDayLocal } from "./time";
import { swr } from "./cache";

export type PartnerRow = {
  id: string; name: string; code: string; kind: string; instagram: string | null; phone: string; payout: string; discountPct: number | null; discountType: string | null; discountAmount: number | null; minSubtotal: number | null; active: boolean;
  orders: number; pieces: number; revenue: number; discount: number; profit: number; commission: number; lastOrder: string | null;
};

// Vendas de cada parceiro no período, pelo cupom usado no pedido
export async function partnerStats(fromIso: string, toIso: string) {
  const s = await getSettings();
  const partners = await db.referral.findMany({ where: { kind: { in: ["atleta", "influenciador"] } }, orderBy: { createdAt: "asc" } });
  const byCode = new Map(partners.map((p) => [p.code.toUpperCase(), p]));
  const orders = (await ordersBetween(dayRange(fromIso).start, dayRange(toIso).end)).filter((o) => !o.cancelled && o.financial !== "REFUNDED" && o.financial !== "VOIDED");
  const resolve = await costResolver();
  const rate = s.costs.taxRate + s.costs.paymentFeeRate;
  const pct = s.referral.commission / 100;
  const rows = new Map<string, PartnerRow>();
  for (const p of partners) {
    rows.set(p.id, { id: p.id, name: p.name ?? p.code, code: p.code, kind: p.kind, instagram: p.instagram, phone: p.phone, payout: p.payout, discountPct: p.discountPct, discountType: p.discountType, discountAmount: p.discountAmount, minSubtotal: p.minSubtotal, active: p.active, orders: 0, pieces: 0, revenue: 0, discount: 0, profit: 0, commission: 0, lastOrder: null });
  }
  const daily = new Map<string, number>();
  const list: { order: Order; partner: string }[] = [];
  for (const o of orders) {
    const code = o.codes.find((c) => byCode.has(c));
    if (!code) continue;
    const p = byCode.get(code)!;
    const r = rows.get(p.id)!;
    const net = o.subtotal; // já com o desconto do cupom, sem frete
    let cogs = 0, pieces = 0;
    for (const l of o.lines) { pieces += l.quantity; cogs += (resolve(l.title, l.unitCost) ?? 0) * l.quantity; }
    const commission = net * pct;
    r.orders++; r.pieces += pieces; r.revenue += net; r.commission += commission;
    r.profit += net - cogs - net * rate - pieces * s.costs.packagingPerItem - commission;
    if (!r.lastOrder || o.createdAt > r.lastOrder) r.lastOrder = o.createdAt;
    const d = isoDayLocal(new Date(o.createdAt));
    daily.set(d, (daily.get(d) ?? 0) + net);
    list.push({ order: o, partner: r.name });
  }
  return { rows: [...rows.values()].sort((a, b) => b.revenue - a.revenue), daily, orders: list.sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt)), commissionPct: s.referral.commission, discountPct: s.referral.percent };
}

/* Tipos de desconto, como na Shopify: porcentagem, valor fixo, frete grátis, compre X leve Y */
export type DiscType = "percent" | "fixed" | "shipping" | "bxgy" | "other";
export type Disc = { type: DiscType; value: number | null; min: number | null };
export const DISC_LABEL: Record<DiscType, string> = { percent: "Porcentagem", fixed: "Valor fixo (R$)", shipping: "Frete grátis", bxgy: "Compre X, leve Y", other: "Outro (app)" };
const money = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;

export function describeDisc(d: { type?: string | null; value?: number | null; min?: number | null }) {
  const min = d.min ? ` em compras acima de ${money(d.min)}` : "";
  switch (d.type) {
    case "percent": return d.value != null ? `${d.value}% de desconto${min}` : "desconto";
    case "fixed": return d.value != null ? `${money(d.value)} de desconto${min}` : "desconto";
    case "shipping": return `frete grátis${min}`;
    case "bxgy": return "compre e ganhe (leve mais pagando menos)";
    default: return "desconto";
  }
}
export const discOf = (r: { discountType?: string | null; discountPct?: number | null; discountAmount?: number | null; minSubtotal?: number | null }): Disc => {
  const type = (r.discountType as DiscType) ?? (r.discountPct != null ? "percent" : "other");
  return { type, value: type === "percent" ? r.discountPct ?? null : type === "fixed" ? r.discountAmount ?? null : null, min: r.minSubtotal ?? null };
};
export const sameDisc = (a: Disc, b: Disc) => a.type === b.type && (a.value ?? 0) === (b.value ?? 0) && (a.min ?? 0) === (b.min ?? 0);
export async function ruleDisc(): Promise<Disc> {
  const r = (await getSettings()).referral;
  const type = (r.discountType as DiscType) || "percent";
  return { type, value: type === "percent" ? r.percent : type === "fixed" ? r.fixedAmount : null, min: r.minSubtotal || null };
}
// Campos para gravar no banco
export const discFields = (d: Disc) => ({ discountType: d.type, discountPct: d.type === "percent" ? d.value : null, discountAmount: d.type === "fixed" ? d.value : null, minSubtotal: d.min });

type RawDisc = { __typename: string; title?: string; customerGets?: { value?: { __typename: string; percentage?: number; amount?: { amount: string } } }; minimumRequirement?: { __typename: string; greaterThanOrEqualToSubtotal?: { amount: string } } | null };
const DISC_FIELDS = `__typename ... on DiscountCodeBasic { title customerGets{ value{ __typename ... on DiscountPercentage { percentage } ... on DiscountAmount { amount{ amount } } } } minimumRequirement{ __typename ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal{ amount } } } } ... on DiscountCodeFreeShipping { title minimumRequirement{ __typename ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal{ amount } } } } ... on DiscountCodeBxgy { title } ... on DiscountCodeApp { title }`;
function parseDisc(c: RawDisc): Disc {
  const min = c.minimumRequirement?.greaterThanOrEqualToSubtotal ? Number(c.minimumRequirement.greaterThanOrEqualToSubtotal.amount) || null : null;
  if (c.__typename === "DiscountCodeFreeShipping") return { type: "shipping", value: null, min };
  if (c.__typename === "DiscountCodeBxgy") return { type: "bxgy", value: null, min: null };
  if (c.__typename !== "DiscountCodeBasic") return { type: "other", value: null, min: null };
  const v = c.customerGets?.value;
  if (v?.__typename === "DiscountPercentage" && v.percentage != null) return { type: "percent", value: Math.round(v.percentage * 1000) / 10, min };
  if (v?.__typename === "DiscountAmount" && v.amount) return { type: "fixed", value: Number(v.amount.amount), min };
  return { type: "other", value: null, min };
}

// Procura um cupom que já existe na Shopify (qualquer tipo)
export async function findShopifyCode(code: string): Promise<{ id: string; title: string; disc: Disc; percent: number | null } | null> {
  const d = await gql<{ codeDiscountNodeByCode: { id: string; codeDiscount: RawDisc } | null }>(`query($c:String!){ codeDiscountNodeByCode(code:$c){ id codeDiscount{ ${DISC_FIELDS} } } }`, { c: code });
  const n = d.codeDiscountNodeByCode;
  if (!n) return null;
  const disc = parseDisc(n.codeDiscount);
  return { id: n.id, title: n.codeDiscount.title ?? code, disc, percent: disc.type === "percent" ? disc.value : null };
}

const minReq = (min: number | null) => (min ? { subtotal: { greaterThanOrEqualToSubtotal: min.toFixed(2) } } : null);
const getsFor = (d: Disc) => ({ value: d.type === "fixed" ? { discountAmount: { amount: (d.value ?? 0).toFixed(2), appliesOnEachItem: false } } : { percentage: (d.value ?? 0) / 100 }, items: { all: true } });
const errOf = (x: { userErrors: { message: string }[] } | undefined) => { const e = x?.userErrors[0]; if (e) throw new Error(e.message); };

// Cria o cupom do atleta no tipo escolhido
export async function createPartnerCode(code: string, d: Disc, title = `Atleta ${code}`) {
  const base = { title, code, startsAt: new Date().toISOString(), context: { all: "ALL" }, minimumRequirement: minReq(d.min), tags: ["atleta"] };
  if (d.type === "shipping") {
    const r = await gql<{ discountCodeFreeShippingCreate: { codeDiscountNode: { id: string } | null; userErrors: { message: string }[] } }>(
      `mutation($i:DiscountCodeFreeShippingInput!){ discountCodeFreeShippingCreate(freeShippingCodeDiscount:$i){ codeDiscountNode{ id } userErrors{ message } } }`, { i: { ...base, destination: { all: true } } });
    errOf(r.discountCodeFreeShippingCreate);
    return r.discountCodeFreeShippingCreate.codeDiscountNode?.id ?? null;
  }
  if (d.type !== "percent" && d.type !== "fixed") throw new Error("Esse tipo de cupom precisa ser criado direto na Shopify. Depois é só vincular aqui.");
  const r = await gql<{ discountCodeBasicCreate: { codeDiscountNode: { id: string } | null; userErrors: { message: string }[] } }>(
    `mutation($i:DiscountCodeBasicInput!){ discountCodeBasicCreate(basicCodeDiscount:$i){ codeDiscountNode{ id } userErrors{ message } } }`, { i: { ...base, customerGets: getsFor(d) } });
  errOf(r.discountCodeBasicCreate);
  return r.discountCodeBasicCreate.codeDiscountNode?.id ?? null;
}

// Muda o desconto de um cupom que já existe. Se o tipo muda (ex.: porcentagem para frete grátis), apaga e cria de novo com o mesmo código.
export async function setPartnerDisc(discountId: string, code: string, current: Disc, d: Disc) {
  const basic = (t: DiscType) => t === "percent" || t === "fixed";
  if (basic(current.type) && basic(d.type)) {
    const r = await gql<{ discountCodeBasicUpdate: { userErrors: { message: string }[] } }>(
      `mutation($id:ID!,$i:DiscountCodeBasicInput!){ discountCodeBasicUpdate(id:$id, basicCodeDiscount:$i){ userErrors{ message } } }`, { id: discountId, i: { customerGets: getsFor(d), minimumRequirement: minReq(d.min) } });
    errOf(r.discountCodeBasicUpdate);
    return discountId;
  }
  if (current.type === "shipping" && d.type === "shipping") {
    const r = await gql<{ discountCodeFreeShippingUpdate: { userErrors: { message: string }[] } }>(
      `mutation($id:ID!,$i:DiscountCodeFreeShippingInput!){ discountCodeFreeShippingUpdate(id:$id, freeShippingCodeDiscount:$i){ userErrors{ message } } }`, { id: discountId, i: { minimumRequirement: minReq(d.min) } });
    errOf(r.discountCodeFreeShippingUpdate);
    return discountId;
  }
  const del = await gql<{ discountCodeDelete: { userErrors: { message: string }[] } }>(`mutation($id:ID!){ discountCodeDelete(id:$id){ userErrors{ message } } }`, { id: discountId });
  errOf(del.discountCodeDelete);
  return createPartnerCode(code, d);
}

// Compatível com o que já existia: deixa em X%
export async function setCodePercent(discountId: string, percent: number) {
  const r = await gql<{ discountCodeBasicUpdate: { userErrors: { message: string }[] } }>(
    `mutation($id:ID!,$i:DiscountCodeBasicInput!){ discountCodeBasicUpdate(id:$id, basicCodeDiscount:$i){ userErrors{ message } } }`, { id: discountId, i: { customerGets: { value: { percentage: percent / 100 }, items: { all: true } } } });
  errOf(r.discountCodeBasicUpdate);
}

// Confere na Shopify o desconto atual de cada atleta (se alguém mudou lá, o Hub acompanha)
export async function syncPartnerDiscounts() {
  return swr("partners:disc", 5 * 60_000, async () => {
    const list = await db.referral.findMany({ where: { kind: { in: ["atleta", "influenciador"] } } });
    for (const r of list) {
      const f = await findShopifyCode(r.code).catch(() => null);
      if (!f) continue;
      const cur = discOf(r);
      if (!sameDisc(cur, f.disc) || r.discountId !== f.id || !r.discountType) await db.referral.update({ where: { id: r.id }, data: { discountId: f.id, ...discFields(f.disc) } });
    }
    return true;
  });
}

// Link da loja que já abre com o cupom aplicado
export function partnerLink(storeUrl: string, code: string, path = "/") {
  return `${storeUrl.replace(/\/$/, "")}/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(path)}`;
}

// Cupons ativos na Shopify que ainda não estão ligados a nenhum atleta (qualquer tipo)
export async function unlinkedCodes(): Promise<{ code: string; title: string; uses: number; percent: number | null; disc: Disc }[]> {
  const linked = new Set((await db.referral.findMany({ select: { code: true } })).map((r) => r.code.toUpperCase()));
  const d = await gql<{ discountNodes: { nodes: { discount: RawDisc & { asyncUsageCount?: number; codes?: { nodes: { code: string }[] } } }[] } }>(
    `query{ discountNodes(first:250, reverse:true, query:"status:active"){ nodes{ discount{ ${DISC_FIELDS.replace(/\.\.\. on (DiscountCode\w+) \{ title/g, "... on $1 { title asyncUsageCount codes(first:1){ nodes{ code } }")} } } } }`,
  ).catch(() => null);
  const generic = /^(IG-EMAIL|BLACK|VOLT|OFF\d|QUERO|CARRINHO|FINALIZE|BEMVINDO|C[óo]pia|RASTA\d|VIP$|CLUBE|RESGATE)/i;
  return (d?.discountNodes.nodes ?? [])
    .filter((n) => n.discount.codes?.nodes[0])
    .map((n) => { const disc = parseDisc(n.discount); return { code: n.discount.codes!.nodes[0].code, title: n.discount.title ?? "", uses: n.discount.asyncUsageCount ?? 0, percent: disc.type === "percent" ? disc.value : null, disc }; })
    .filter((c) => !linked.has(c.code.toUpperCase()) && !generic.test(c.code))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 16);
}

// Time que já usa cupom na loja: entra sozinho na primeira vez que a tela abre
const TEAM = [
  { name: "Mestre Azul", code: "MESTREAZUL", instagram: null },
  { name: "Bernardo Mastrangelo", code: "Mastrangelo", instagram: "bernardomastrangelo" },
  { name: "Bernardo Goulart", code: "BGOULART", instagram: "bgoulart_bjj" },
];
export async function ensureTeam() {
  const flag = await db.setting.findUnique({ where: { key: "_partners_seeded" } });
  if (flag) return;
  for (const t of TEAM) {
    try {
      if (await db.referral.findFirst({ where: { code: { equals: t.code, mode: "insensitive" } } })) continue;
      const found = await findShopifyCode(t.code).catch(() => null);
      await db.referral.create({ data: { name: t.name, code: found ? t.code : t.code.toUpperCase(), phone: `sem-${t.code.toLowerCase()}`, discountId: found?.id ?? null, ...(found ? discFields(found.disc) : {}), kind: "atleta", payout: "pix", instagram: t.instagram } });
    } catch {
      // segue para o próximo
    }
  }
  await db.setting.upsert({ where: { key: "_partners_seeded" }, create: { key: "_partners_seeded", value: { at: new Date().toISOString() } }, update: {} });
}

// Mensagem pronta para mandar ao atleta explicando como funciona
export function partnerMessage(p: { name: string | null; code: string; discountPct: number | null; discountType?: string | null; discountAmount?: number | null; minSubtotal?: number | null; payout: string }, link: string, commission: number) {
  const first = (p.name ?? "").split(" ")[0] || "tudo certo";
  const desc = describeDisc(discOf(p));
  const pay = p.payout === "credito" ? "em crédito na loja" : "por Pix";
  return [
    `Fala, ${first}! Seu cupom da Rasta Hale está ativo.`,
    "",
    `Cupom: ${p.code}`,
    `Link: ${link}`,
    "",
    "Como funciona:",
    `1. Quem compra pelo seu link ou com o cupom ${p.code} ganha ${desc}. O link já abre a loja com o cupom aplicado.`,
    `2. Você ganha ${commission}% de comissão sobre o valor dos produtos de cada venda com o seu cupom (frete não entra).`,
    "3. Pedido cancelado ou devolvido não conta.",
    `4. A comissão do mês é paga todo dia 1 do mês seguinte, ${pay}.`,
    "",
    "Dica: deixa o link na bio, usa nos stories e fala o cupom nos vídeos e nos treinos.",
    "Qualquer dúvida é só chamar.",
  ].join("\n");
}

export function waLink(phone: string, text: string) {
  const num = phone.startsWith("sem-") ? "" : phone.replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}
