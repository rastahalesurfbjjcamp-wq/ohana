// Indique e ganhe: cada cliente ganha um cupom próprio para indicar amigos.
import { db } from "./db";
import { env } from "./env";
import { getSettings } from "./settings";
import { customers, gql } from "./store";
import { inSegment, normalizePhone, type SegmentKey } from "./segments";

function codeFor(name: string, percent: number) {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8) || "AMIGO";
  return `${base}${percent}${Math.floor(Math.random() * 90 + 10)}`;
}

async function createDiscount(code: string, percent: number) {
  const d = await gql<{ discountCodeBasicCreate: { codeDiscountNode: { id: string } | null; userErrors: { message: string }[] } }>(
    `mutation($input: DiscountCodeBasicInput!){ discountCodeBasicCreate(basicCodeDiscount:$input){ codeDiscountNode{ id } userErrors{ message } } }`,
    {
      input: {
        title: `Indique e ganhe ${code}`,
        code,
        startsAt: new Date().toISOString(),
        context: { all: "ALL" },
        appliesOncePerCustomer: true,
        customerGets: { value: { percentage: percent / 100 }, items: { all: true } },
        tags: ["indique-e-ganhe"],
      },
    },
  );
  const err = d.discountCodeBasicCreate.userErrors[0];
  if (err) throw new Error(err.message);
  return d.discountCodeBasicCreate.codeDiscountNode?.id ?? null;
}

export async function generateReferrals(segment: SegmentKey, limit = 50) {
  const s = await getSettings();
  const list = (await customers()).filter((c) => inSegment(c, segment) && normalizePhone(c.phone));
  const existing = new Set((await db.referral.findMany({ select: { phone: true } })).map((r) => r.phone));
  let created = 0;
  for (const c of list) {
    if (created >= limit) break;
    const phone = normalizePhone(c.phone)!;
    if (existing.has(phone)) continue;
    const code = codeFor(c.name.split(" ")[0], s.referral.percent);
    const discountId = await createDiscount(code, s.referral.percent);
    await db.referral.create({ data: { phone, name: c.name, email: c.email, code, discountId } });
    created++;
  }
  return created;
}

// Conta quantas vezes cada cupom foi usado nos últimos 120 dias
export async function refreshReferralUsage() {
  const refs = await db.referral.findMany();
  if (!refs.length) return;
  const since = new Date(Date.now() - 120 * 864e5).toISOString();
  const usage = new Map<string, { n: number; v: number }>();
  let after: string | null = null;
  do {
    type P = { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { discountCodes: string[]; currentSubtotalPriceSet: { shopMoney: { amount: string } } }[] } };
    const d: P = await gql<P>(
      `query($q:String,$after:String){ orders(first:250, after:$after, query:$q){ pageInfo{hasNextPage endCursor} nodes{ discountCodes currentSubtotalPriceSet{shopMoney{amount}} } } }`,
      { q: `created_at:>='${since}' discount_code:*`, after },
    );
    for (const o of d.orders.nodes) {
      for (const code of o.discountCodes) {
        const k = code.toUpperCase();
        const cur = usage.get(k) ?? { n: 0, v: 0 };
        cur.n++; cur.v += Number(o.currentSubtotalPriceSet.shopMoney.amount);
        usage.set(k, cur);
      }
    }
    after = d.orders.pageInfo.hasNextPage ? d.orders.pageInfo.endCursor : null;
  } while (after);
  for (const r of refs) {
    const u = usage.get(r.code.toUpperCase());
    await db.referral.update({ where: { id: r.id }, data: { uses: u?.n ?? 0, revenue: u?.v ?? 0 } });
  }
}

export function shareMessage(text: string, r: { name: string | null; code: string }, percent: number) {
  return text
    .replace(/\{nome\}/g, (r.name ?? "").split(" ")[0] || "tudo bem")
    .replace(/\{loja\}/g, env.storeName())
    .replace(/\{codigo\}/g, r.code)
    .replace(/\{percent\}/g, String(percent));
}
