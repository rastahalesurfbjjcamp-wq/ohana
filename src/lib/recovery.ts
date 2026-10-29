// Recuperação de vendas e avisos automáticos pelo WhatsApp.
// O worker roda scanRecovery() a cada 5 minutos e sendDueRecovery() a cada minuto.
import { db } from "./db";
import { env } from "./env";
import { getSettings } from "./settings";
import { gql, hasShopify } from "./store";
import { normalizePhone } from "./segments";
import { humanDelay, reserveSlot, sendText } from "./send";
import { brl } from "./time";

const DAY = 864e5;
const first = (n?: string | null) => (n ?? "").trim().split(" ")[0] || "tudo bem";

export function fillTemplate(t: string, c: { name?: string | null; value?: number; url?: string | null; product?: string | null; orderName?: string | null; tracking?: string | null }, extra: Record<string, string> = {}) {
  let out = t
    .replace(/\{nome\}/g, first(c.name))
    .replace(/\{loja\}/g, env.storeName())
    .replace(/\{valor\}/g, brl(c.value ?? 0))
    .replace(/\{link\}/g, c.url ?? "")
    .replace(/\{produto\}/g, c.product ?? "seu pedido")
    .replace(/\{pedido\}/g, c.orderName ?? "")
    .replace(/\{rastreio\}/g, c.tracking ?? c.url ?? "");
  for (const [k, v] of Object.entries(extra)) out = out.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  return out.trim();
}

type Checkout = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  abandonedCheckoutUrl: string;
  totalPriceSet: { shopMoney: { amount: string } };
  customer: { displayName: string; defaultPhoneNumber: { phoneNumber: string } | null; defaultEmailAddress: { emailAddress: string } | null } | null;
  shippingAddress: { phone: string | null; firstName: string | null } | null;
  billingAddress: { phone: string | null } | null;
  lineItems: { nodes: { title: string }[] };
};

type PendingOrder = {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  statusPageUrl: string;
  email: string | null;
  phone: string | null;
  currentTotalPriceSet: { shopMoney: { amount: string } };
  customer: { displayName: string; defaultPhoneNumber: { phoneNumber: string } | null } | null;
  shippingAddress: { phone: string | null; firstName: string | null } | null;
  lineItems: { nodes: { title: string }[] };
  fulfillments: { createdAt: string; displayStatus: string; deliveredAt: string | null; trackingInfo: { number: string; url: string | null }[] }[];
};

const ORDER_Q = `id name createdAt displayFinancialStatus statusPageUrl email phone currentTotalPriceSet{shopMoney{amount}}
  customer{ displayName defaultPhoneNumber{phoneNumber} } shippingAddress{ phone firstName } lineItems(first:3){ nodes{ title } }
  fulfillments(first:3){ createdAt displayStatus deliveredAt trackingInfo{ number url } }`;

async function upsertCase(data: {
  kind: string; refId: string; phone: string; name?: string | null; email?: string | null; value?: number; url?: string | null; product?: string | null; orderName?: string | null; tracking?: string | null; nextAt: Date | null; createdAt?: Date;
}) {
  const exists = await db.recoveryCase.findUnique({ where: { kind_refId: { kind: data.kind, refId: data.refId } } });
  if (exists) return exists;
  return db.recoveryCase.create({ data });
}

export async function scanRecovery() {
  if (!(await hasShopify())) return;
  const s = await getSettings();
  if (!s.recovery.cartEnabled && !s.recovery.pixEnabled && !s.recovery.trackingEnabled && !s.postsale.reviewEnabled) return;
  // Só trata o que aconteceu depois que a recuperação foi ligada (evita mandar mensagem para casos antigos)
  let mark = await db.setting.findUnique({ where: { key: "_recovery_start" } });
  if (!mark) mark = await db.setting.create({ data: { key: "_recovery_start", value: { at: new Date(Date.now() - 60 * 60_000).toISOString() } } });
  const startedAt = new Date((mark.value as { at: string }).at);
  const since = new Date(Math.max(Date.now() - 3 * DAY, startedAt.getTime() - 3 * DAY)).toISOString();

  // 1. Carrinhos abandonados
  if (s.recovery.cartEnabled && s.recovery.cartSteps.length) {
    const d = await gql<{ abandonedCheckouts: { nodes: Checkout[] } }>(
      `query($q:String){ abandonedCheckouts(first:100, reverse:true, sortKey:CREATED_AT, query:$q){ nodes{ id createdAt completedAt abandonedCheckoutUrl totalPriceSet{shopMoney{amount}}
        customer{ displayName defaultPhoneNumber{phoneNumber} defaultEmailAddress{emailAddress} } shippingAddress{ phone firstName } billingAddress{ phone } lineItems(first:3){ nodes{ title } } } } }`,
      { q: `created_at:>='${since}'` },
    ).catch(() => null);
    for (const c of d?.abandonedCheckouts.nodes ?? []) {
      if (c.completedAt || new Date(c.createdAt) < startedAt) continue;
      const phone = normalizePhone(c.customer?.defaultPhoneNumber?.phoneNumber ?? c.shippingAddress?.phone ?? c.billingAddress?.phone);
      if (!phone) continue;
      const created = new Date(c.createdAt);
      await upsertCase({
        kind: "carrinho",
        refId: c.id,
        phone,
        name: c.shippingAddress?.firstName ?? c.customer?.displayName,
        email: c.customer?.defaultEmailAddress?.emailAddress,
        value: Number(c.totalPriceSet.shopMoney.amount),
        url: c.abandonedCheckoutUrl,
        product: c.lineItems.nodes[0]?.title,
        createdAt: created,
        nextAt: new Date(created.getTime() + s.recovery.cartSteps[0].delayMin * 60_000),
      });
    }
  }

  // 2. Pedidos aguardando pagamento (Pix e boleto) e 3. pedidos enviados (rastreio)
  const d2 = await gql<{ orders: { nodes: PendingOrder[] } }>(
    `query($q:String){ orders(first:150, reverse:true, sortKey:UPDATED_AT, query:$q){ nodes{ ${ORDER_Q} } } }`,
    { q: `updated_at:>='${since}'` },
  ).catch(() => null);
  for (const o of d2?.orders.nodes ?? []) {
    const phone = normalizePhone(o.customer?.defaultPhoneNumber?.phoneNumber ?? o.shippingAddress?.phone ?? o.phone);
    if (!phone) continue;
    const name = o.shippingAddress?.firstName ?? o.customer?.displayName;
    const value = Number(o.currentTotalPriceSet.shopMoney.amount);
    if (s.recovery.pixEnabled && o.displayFinancialStatus === "PENDING" && s.recovery.pixSteps.length && new Date(o.createdAt) >= startedAt) {
      const created = new Date(o.createdAt);
      await upsertCase({
        kind: "pix", refId: o.id, phone, name, email: o.email, value, url: o.statusPageUrl, product: o.lineItems.nodes[0]?.title, orderName: o.name,
        createdAt: created, nextAt: new Date(created.getTime() + s.recovery.pixSteps[0].delayMin * 60_000),
      });
    }
    const f = o.fulfillments.find((x) => x.trackingInfo.length);
    if (s.recovery.trackingEnabled && f && new Date(f.createdAt) >= startedAt && !f.deliveredAt) {
      const t = f.trackingInfo[0];
      await upsertCase({ kind: "rastreio", refId: o.id, phone, name, value, url: o.statusPageUrl, orderName: o.name, tracking: t.url ?? t.number, nextAt: new Date() });
    }
    const delivered = o.fulfillments.find((x) => x.deliveredAt);
    if (s.postsale.reviewEnabled && delivered?.deliveredAt && new Date(delivered.deliveredAt) >= startedAt) {
      await upsertCase({
        kind: "avaliacao", refId: o.id, phone, name, value, url: o.statusPageUrl, orderName: o.name,
        nextAt: new Date(new Date(delivered.deliveredAt).getTime() + s.postsale.reviewDelayDays * DAY),
      });
    }
  }

  await markRecovered();
}

// Quem pagou ou comprou depois do aviso vira "recuperado"
async function markRecovered() {
  const open = await db.recoveryCase.findMany({ where: { kind: { in: ["carrinho", "pix"] }, status: "ativo" }, take: 200 });
  if (!open.length) return;
  const pix = open.filter((c) => c.kind === "pix");
  if (pix.length) {
    const ids = pix.map((c) => c.refId);
    const d = await gql<{ nodes: ({ id: string; displayFinancialStatus: string; cancelledAt: string | null } | null)[] }>(
      `query($ids:[ID!]!){ nodes(ids:$ids){ ... on Order { id displayFinancialStatus cancelledAt } } }`,
      { ids },
    ).catch(() => null);
    for (const n of d?.nodes ?? []) {
      if (!n) continue;
      const c = pix.find((x) => x.refId === n.id)!;
      if (n.displayFinancialStatus === "PAID") {
        await db.recoveryCase.update({ where: { id: c.id }, data: { status: c.sentCount ? "recuperado" : "concluido", recoveredAt: new Date(), recoveredValue: c.value } });
      } else if (n.cancelledAt || ["VOIDED", "EXPIRED"].includes(n.displayFinancialStatus)) {
        await db.recoveryCase.update({ where: { id: c.id }, data: { status: "parado" } });
      }
    }
  }
  const carts = open.filter((c) => c.kind === "carrinho");
  if (carts.length) {
    const since = new Date(Math.min(...carts.map((c) => c.createdAt.getTime()))).toISOString();
    const d = await gql<{ orders: { nodes: { createdAt: string; email: string | null; phone: string | null; currentSubtotalPriceSet: { shopMoney: { amount: string } }; shippingAddress: { phone: string | null } | null; customer: { defaultPhoneNumber: { phoneNumber: string } | null } | null }[] } }>(
      `query($q:String){ orders(first:250, query:$q){ nodes{ createdAt email phone currentSubtotalPriceSet{shopMoney{amount}} shippingAddress{phone} customer{ defaultPhoneNumber{phoneNumber} } } } }`,
      { q: `created_at:>='${since}'` },
    ).catch(() => null);
    for (const o of d?.orders.nodes ?? []) {
      const phone = normalizePhone(o.customer?.defaultPhoneNumber?.phoneNumber ?? o.shippingAddress?.phone ?? o.phone);
      const match = carts.find((c) => (phone && c.phone === phone) || (o.email && c.email && o.email.toLowerCase() === c.email.toLowerCase()));
      if (match && new Date(o.createdAt) >= match.createdAt && match.status === "ativo") {
        match.status = "x";
        await db.recoveryCase.update({
          where: { id: match.id },
          data: { status: match.sentCount ? "recuperado" : "concluido", recoveredAt: new Date(o.createdAt), recoveredValue: Number(o.currentSubtotalPriceSet.shopMoney.amount) },
        });
      }
    }
  }
  // Carrinhos e Pix com mais de 4 dias sem resposta
  await db.recoveryCase.updateMany({ where: { kind: { in: ["carrinho", "pix"] }, status: "ativo", createdAt: { lt: new Date(Date.now() - 4 * DAY) } }, data: { status: "sem_resposta", nextAt: null } });
}

export async function sendDueRecovery() {
  const due = await db.recoveryCase.findMany({ where: { status: "ativo", nextAt: { lte: new Date() } }, orderBy: { nextAt: "asc" }, take: 15 });
  if (!due.length) return;
  const s = await getSettings();
  const opted = new Set((await db.optOut.findMany({ where: { phone: { in: due.map((c) => c.phone) } } })).map((o) => o.phone));
  for (const c of due) {
    if (opted.has(c.phone)) {
      await db.recoveryCase.update({ where: { id: c.id }, data: { status: "parado", nextAt: null } });
      continue;
    }
    if ((await reserveSlot()) > 0) return;
    let text = "";
    let next: Date | null = null;
    let done = false;
    if (c.kind === "carrinho" || c.kind === "pix") {
      const steps = c.kind === "carrinho" ? s.recovery.cartSteps : s.recovery.pixSteps;
      const step = steps[c.step];
      if (!step) {
        await db.recoveryCase.update({ where: { id: c.id }, data: { status: "sem_resposta", nextAt: null } });
        continue;
      }
      text = fillTemplate(step.text, c);
      const after = steps[c.step + 1];
      next = after ? new Date(c.createdAt.getTime() + after.delayMin * 60_000) : null;
      done = !after;
    } else if (c.kind === "rastreio") {
      text = fillTemplate(s.recovery.trackingText, c);
      done = true;
    } else if (c.kind === "avaliacao") {
      text = fillTemplate(s.postsale.reviewText, c, { cupom: s.postsale.coupon });
      done = true;
    } else if (c.kind === "recompra") {
      text = fillTemplate(s.postsale.repurchaseText, c, { cupom: s.postsale.coupon });
      done = true;
    }
    if (!text) continue;
    try {
      await sendText(c.phone, text);
      await db.recoveryCase.update({
        where: { id: c.id },
        data: { step: { increment: 1 }, sentCount: { increment: 1 }, lastSentAt: new Date(), nextAt: next, status: done && ["rastreio", "avaliacao", "recompra"].includes(c.kind) ? "concluido" : "ativo" },
      });
      await logChat(c.phone, c.name, text, "sistema");
    } catch (e) {
      console.error("[recuperação]", e);
      await db.recoveryCase.update({ where: { id: c.id }, data: { nextAt: new Date(Date.now() + 30 * 60_000) } });
    }
    await humanDelay();
  }
}

// Guarda a mensagem enviada no histórico do atendimento
export async function logChat(phone: string, name: string | null | undefined, text: string, by: string) {
  await db.chatThread.upsert({
    where: { phone },
    create: { phone, name: name ?? undefined, lastText: text.slice(0, 200), lastAt: new Date() },
    update: { lastText: text.slice(0, 200), lastAt: new Date() },
  });
  await db.chatMessage.create({ data: { phone, fromMe: true, by, text } });
}

// Chamar de volta quem completou X dias sem comprar (roda uma vez por dia)
export async function scanRepurchase() {
  const s = await getSettings();
  if (!s.postsale.repurchaseEnabled || !(await hasShopify())) return;
  const { customers } = await import("./store");
  const target = s.postsale.repurchaseDays;
  for (const c of await customers()) {
    if (!c.lastOrderAt) continue;
    const days = Math.floor((Date.now() - Date.parse(c.lastOrderAt)) / DAY);
    if (days !== target) continue;
    const phone = normalizePhone(c.phone);
    if (!phone) continue;
    await upsertCase({ kind: "recompra", refId: `${c.id}:${c.lastOrderAt.slice(0, 10)}`, phone, name: c.name, email: c.email, url: s.postsale.storeUrl, nextAt: new Date() });
  }
}

// Primeira compra: dispara funis com esse gatilho
export async function scanFirstPurchases() {
  if (!(await hasShopify())) return;
  const since = new Date(Date.now() - 2 * 3600_000).toISOString();
  const d = await gql<{ orders: { nodes: { customer: { displayName: string; numberOfOrders: string; defaultPhoneNumber: { phoneNumber: string } | null } | null; shippingAddress: { phone: string | null } | null }[] } }>(
    `query($q:String){ orders(first:100, query:$q){ nodes{ customer{ displayName numberOfOrders defaultPhoneNumber{phoneNumber} } shippingAddress{ phone } } } }`,
    { q: `created_at:>='${since}' financial_status:paid` },
  ).catch(() => null);
  const { funnelEvent } = await import("./funnels");
  for (const o of d?.orders.nodes ?? []) {
    if (o.customer?.numberOfOrders !== "1") continue;
    const phone = normalizePhone(o.customer.defaultPhoneNumber?.phoneNumber ?? o.shippingAddress?.phone);
    if (phone) await funnelEvent("primeira_compra", phone, o.customer.displayName);
  }
}
