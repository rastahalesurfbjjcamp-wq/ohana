// Atletas e influenciadores: vendas pelo cupom de cada um, lucro e comissão.
import { db } from "./db";
import { costResolver } from "./report";
import { getSettings } from "./settings";
import { gql, ordersBetween, type Order } from "./store";
import { dayRange, isoDayLocal } from "./time";

export type PartnerRow = {
  id: string; name: string; code: string; kind: string; instagram: string | null; phone: string; payout: string; discountPct: number | null; active: boolean;
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
    rows.set(p.id, { id: p.id, name: p.name ?? p.code, code: p.code, kind: p.kind, instagram: p.instagram, phone: p.phone, payout: p.payout, discountPct: p.discountPct, active: p.active, orders: 0, pieces: 0, revenue: 0, discount: 0, profit: 0, commission: 0, lastOrder: null });
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

// Procura um cupom que já existe na Shopify (para vincular a um atleta)
export async function findShopifyCode(code: string): Promise<{ id: string; percent: number | null; title: string } | null> {
  const d = await gql<{ codeDiscountNodeByCode: { id: string; codeDiscount: { title?: string; customerGets?: { value?: { percentage?: number } } } } | null }>(
    `query($c:String!){ codeDiscountNodeByCode(code:$c){ id codeDiscount{ ... on DiscountCodeBasic { title customerGets{ value{ ... on DiscountPercentage { percentage } } } } } } }`,
    { c: code },
  );
  const n = d.codeDiscountNodeByCode;
  if (!n) return null;
  const p = n.codeDiscount.customerGets?.value?.percentage;
  return { id: n.id, percent: p != null ? Math.round(p * 100) : null, title: n.codeDiscount.title ?? code };
}

// Ajusta o desconto de um cupom existente para o padrão do programa
export async function setCodePercent(discountId: string, percent: number) {
  const d = await gql<{ discountCodeBasicUpdate: { userErrors: { message: string }[] } }>(
    `mutation($id:ID!,$input:DiscountCodeBasicInput!){ discountCodeBasicUpdate(id:$id, basicCodeDiscount:$input){ userErrors{ message } } }`,
    { id: discountId, input: { customerGets: { value: { percentage: percent / 100 }, items: { all: true } } } },
  );
  const e = d.discountCodeBasicUpdate.userErrors[0];
  if (e) throw new Error(e.message);
}

// Link da loja que já abre com o cupom aplicado
export function partnerLink(storeUrl: string, code: string, path = "/") {
  return `${storeUrl.replace(/\/$/, "")}/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(path)}`;
}

// Cupons ativos na Shopify que ainda não estão ligados a nenhum atleta
export async function unlinkedCodes(): Promise<{ code: string; title: string; uses: number; percent: number | null }[]> {
  const linked = new Set((await db.referral.findMany({ select: { code: true } })).map((r) => r.code.toUpperCase()));
  const d = await gql<{ discountNodes: { nodes: { discount: { __typename: string; title?: string; status?: string; asyncUsageCount?: number; codes?: { nodes: { code: string }[] }; customerGets?: { value?: { percentage?: number } } } }[] } }>(
    `query{ discountNodes(first:250, reverse:true, query:"status:active"){ nodes{ discount{ __typename ... on DiscountCodeBasic { title status asyncUsageCount codes(first:1){ nodes{ code } } customerGets{ value{ ... on DiscountPercentage { percentage } } } } } } } }`,
  ).catch(() => null);
  const generic = /^(IG-EMAIL|BLACK|VOLT|OFF\d|QUERO|CARRINHO|FINALIZE|BEMVINDO|C[óo]pia|RASTA\d|VIP$)/i;
  return (d?.discountNodes.nodes ?? [])
    .filter((n) => n.discount.__typename === "DiscountCodeBasic" && n.discount.codes?.nodes[0])
    .map((n) => ({ code: n.discount.codes!.nodes[0].code, title: n.discount.title ?? "", uses: n.discount.asyncUsageCount ?? 0, percent: n.discount.customerGets?.value?.percentage != null ? Math.round(n.discount.customerGets.value.percentage * 100) : null }))
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
      await db.referral.create({ data: { name: t.name, code: found ? t.code : t.code.toUpperCase(), phone: `sem-${t.code.toLowerCase()}`, discountId: found?.id ?? null, discountPct: found?.percent ?? null, kind: "atleta", payout: "pix", instagram: t.instagram } });
    } catch {
      // segue para o próximo
    }
  }
  await db.setting.upsert({ where: { key: "_partners_seeded" }, create: { key: "_partners_seeded", value: { at: new Date().toISOString() } }, update: {} });
}

// Mensagem pronta para mandar ao atleta explicando como funciona
export function partnerMessage(p: { name: string | null; code: string; discountPct: number | null; payout: string }, link: string, commission: number) {
  const first = (p.name ?? "").split(" ")[0] || "tudo certo";
  const desc = p.discountPct ? `${p.discountPct}% de desconto` : "desconto";
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
