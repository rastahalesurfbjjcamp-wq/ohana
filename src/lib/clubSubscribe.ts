// Assinatura do clube pela página pública: cria a cobrança na Appmax e, quando paga, ativa o membro no Hub.
import { db } from "./db";
import { getSettings } from "./settings";
import { createCustomer, createOrder, createSubscription, FAILED, orderStatus, PAID, payCard, payPix } from "./appmax";
import { cpfValid, digits, ensureMemberCode, findShopifyCustomer, registerPayment, setCodeActive } from "./club";
import { redis } from "./queue";
import { normalizePhone } from "./segments";

export type StartInput = { name: string; cpf: string; phone: string; email: string; method: "pix" | "cartao"; ip?: string; card?: { number: string; cvv: string; month: string; year: string; holder: string } };

export function validate(i: StartInput): string | null {
  if (i.name.trim().split(/\s+/).length < 2) return "Coloque nome e sobrenome";
  if (!cpfValid(digits(i.cpf))) return "CPF inválido";
  if (!normalizePhone(i.phone)) return "WhatsApp inválido";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim())) return "E-mail inválido";
  if (i.method === "cartao") {
    const c = i.card;
    if (!c || digits(c.number).length < 13 || digits(c.cvv).length < 3 || !c.month || !c.year || !c.holder.trim()) return "Confira os dados do cartão";
  }
  return null;
}

export async function startCheckout(i: StartInput) {
  const s = (await getSettings()).club;
  const cpf = digits(i.cpf);
  const phone = normalizePhone(i.phone)!;
  const email = i.email.trim().toLowerCase();
  const already = await db.clubMember.findUnique({ where: { cpf } });
  if (already && already.status !== "cancelado" && already.paidUntil && already.paidUntil.getTime() > Date.now()) {
    return { error: "Esse CPF já é membro do clube e está em dia." };
  }
  const ck = await db.clubCheckout.create({ data: { name: i.name.trim(), cpf, phone, email, method: i.method, cardLast4: i.card ? digits(i.card.number).slice(-4) : null } });
  try {
    const customerId = await createCustomer({ name: ck.name, email, phone, cpf, ip: i.ip });
    const orderId = await createOrder(customerId, { sku: "CLUBE-MENSAL", name: `${s.name} - mensalidade`, value: s.fee });
    await db.clubCheckout.update({ where: { id: ck.id }, data: { orderId } });
    if (i.method === "pix") {
      const pix = await payPix(orderId, cpf, 30);
      await db.clubCheckout.update({ where: { id: ck.id }, data: { pixEmv: pix.emv, pixQr: pix.qr, pixExpires: pix.expires } });
      return { id: ck.id, pix: { emv: pix.emv, qr: pix.qr, expires: pix.expires.toISOString() } };
    }
    const c = i.card!;
    const r = await payCard(orderId, customerId, { number: digits(c.number), cvv: digits(c.cvv), month: c.month.padStart(2, "0"), year: c.year.slice(-2), holder: c.holder.trim(), cpf });
    if (PAID.has(r.status)) {
      const m = await activate(ck.id);
      return { id: ck.id, paid: true, code: m?.code ?? null, gerando: !m?.code };
    }
    if (FAILED.has(r.status)) {
      await db.clubCheckout.update({ where: { id: ck.id }, data: { status: "recusado", error: "Cartão recusado" } });
      return { id: ck.id, error: "O cartão foi recusado. Tente outro cartão ou pague com Pix." };
    }
    return { id: ck.id, waiting: true }; // em análise: a Appmax avisa pelo webhook
  } catch (e) {
    const msg = String(e).replace(/^Error: /, "").slice(0, 200);
    await db.clubCheckout.update({ where: { id: ck.id }, data: { status: "erro", error: msg } });
    return { id: ck.id, error: msg.includes("APPMAX_NAO_CONFIGURADA") ? "Pagamento indisponível no momento." : "Não conseguimos processar o pagamento. Tente de novo em instantes." };
  }
}

// Confere o pedido na Appmax (o webhook também chama activate)
export async function checkStatus(id: string) {
  const ck = await db.clubCheckout.findUnique({ where: { id } });
  if (!ck) return { status: "nao-encontrado" as const };
  if (ck.status === "pago") {
    const m = ck.memberId ? await db.clubMember.findUnique({ where: { id: ck.memberId } }) : null;
    const code = m?.code ?? (m ? await ensureMemberCode(m.id).catch(() => null) : null);
    return { status: "pago" as const, code, gerando: !code };
  }
  if (ck.status !== "pendente" || !ck.orderId) return { status: ck.status };
  if (ck.pixExpires && ck.pixExpires.getTime() < Date.now() - 60_000) {
    await db.clubCheckout.update({ where: { id }, data: { status: "expirado" } });
    return { status: "expirado" as const };
  }
  // muita gente esperando ao mesmo tempo: no máximo uma consulta à Appmax a cada 5 s por pedido (o aviso da Appmax também ativa)
  const fresh = await redis().set(`clube:chk:${id}`, "1", "EX", 5, "NX").catch(() => "OK");
  if (!fresh) return { status: "pendente" as const };
  try {
    const st = await orderStatus(ck.orderId);
    if (PAID.has(st)) { const m = await activate(ck.id); return { status: "pago" as const, code: m?.code ?? null, gerando: !m?.code }; }
    if (FAILED.has(st)) { await db.clubCheckout.update({ where: { id }, data: { status: "recusado" } }); return { status: "recusado" as const }; }
  } catch {
    // tenta de novo no próximo pedido de status
  }
  return { status: "pendente" as const };
}

async function event(memberId: string, kind: string, text: string, value?: number) {
  await db.clubEvent.create({ data: { memberId, kind, text, value } }).catch(() => null);
}

// Pagamento confirmado: cria ou reativa o membro, cupom de membro, assinatura mensal e pontos do mês
export async function activate(checkoutId: string) {
  const ck = await db.clubCheckout.findUnique({ where: { id: checkoutId } });
  if (!ck) return null;
  if (ck.status === "pago" && ck.memberId) return db.clubMember.findUnique({ where: { id: ck.memberId } });
  // trava contra duas ativações ao mesmo tempo (webhook + consulta da página)
  const lock = await db.clubCheckout.updateMany({ where: { id: ck.id, status: { not: "pago" } }, data: { status: "pago" } });
  if (!lock.count) { const again = await db.clubCheckout.findUnique({ where: { id: ck.id } }); return again?.memberId ? db.clubMember.findUnique({ where: { id: again.memberId } }) : null; }
  const s = (await getSettings()).club;
  let m = await db.clubMember.findUnique({ where: { cpf: ck.cpf } });
  if (!m) {
    // só e-mail e telefone aqui (rápido); o cupom é criado logo abaixo, com novas tentativas se a Shopify demorar
    const shop = await findShopifyCustomer({ email: ck.email, phone: ck.phone, cpf: null }).catch(() => null);
    m = await db.clubMember.create({ data: { name: ck.name, cpf: ck.cpf, phone: ck.phone, email: ck.email, customerId: shop?.id ?? null, fee: s.fee, provider: "appmax", payMethod: ck.method, cardLast4: ck.cardLast4 } });
  } else {
    m = await db.clubMember.update({ where: { id: m.id }, data: { status: "ativo", canceledAt: null, provider: "appmax", payMethod: ck.method, cardLast4: ck.cardLast4 ?? m.cardLast4, email: m.email ?? ck.email, phone: m.phone ?? ck.phone } });
    if (m.discountId && !m.codeActive) await setCodeActive(m.discountId, true).then(() => db.clubMember.update({ where: { id: m!.id }, data: { codeActive: true } })).catch(() => null);
  }
  await registerPayment(m.id, 1, "assinatura", `pedido-${ck.orderId}`);
  try {
    const sub = await createSubscription(ck.orderId!);
    await db.clubMember.update({ where: { id: m.id }, data: { subscriptionId: sub.id, nextChargeAt: sub.next, lastChargeAt: new Date(), lastChargeStatus: "pago", failReason: null } });
  } catch (e) {
    await event(m.id, "falhou", `Pagamento recebido, mas a assinatura mensal não foi criada na Appmax: ${String(e).replace(/^Error: /, "").slice(0, 120)}`);
  }
  await db.clubCheckout.update({ where: { id: ck.id }, data: { memberId: m.id } });
  if (!m.code) await ensureMemberCode(m.id).catch(() => null);
  await event(m.id, "assinou", `Assinou o clube pelo ${ck.method === "pix" ? "Pix" : `cartão final ${ck.cardLast4 ?? ""}`}`, s.fee);
  return db.clubMember.findUnique({ where: { id: m.id } });
}

type Hook = { event?: string; data?: Record<string, unknown> };

// Avisos da Appmax: Pix pago, pedido aprovado, cobrança mensal paga ou recusada, cancelamento
export async function handleAppmaxEvent(h: Hook) {
  // a Appmax manda tanto "order_paid_by_pix" quanto o formato antigo "OrderPaidByPix"
  const ev = String(h.event ?? "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().replace(/^appstore_|_appstore$/g, "");
  const d = h.data ?? {};
  const orderId = Number(d.order_id ?? (d.order as { id?: number } | undefined)?.id ?? d.id ?? 0) || null;
  const subId = d.subscription_id != null ? String(d.subscription_id) : (d.subscription as { id?: number } | undefined)?.id != null ? String((d.subscription as { id: number }).id) : null;

  if ((ev === "order_paid_by_pix" || ev === "order_approved" || ev === "order_paid" || ev === "order_integrated") && orderId) {
    const ck = await db.clubCheckout.findFirst({ where: { orderId } });
    // não confia só no aviso: confere o pedido na Appmax antes de ativar
    if (ck) return (await checkStatus(ck.id)).status;
  }
  if (ev === "order_pix_expired" && orderId) {
    await db.clubCheckout.updateMany({ where: { orderId, status: "pendente" }, data: { status: "expirado" } });
    return "expirado";
  }
  const m = subId ? await db.clubMember.findFirst({ where: { subscriptionId: subId } }) : null;
  if (!m) return "ignorado";
  const value = Number(d.value ?? d.total ?? 0) || undefined;
  if (ev === "subscription_charge_success") {
    await registerPayment(m.id, 1, "appmax", `cobranca-${orderId ?? Date.now()}`);
    const next = d.next_charge_at ? new Date(String(d.next_charge_at)) : null;
    await db.clubMember.update({ where: { id: m.id }, data: { lastChargeAt: new Date(), lastChargeStatus: "pago", failReason: null, ...(next ? { nextChargeAt: next } : {}) } });
    await event(m.id, "pagou", "Mensalidade paga", value);
    return "pago";
  }
  if (ev === "subscription_charge_failed") {
    const reason = String(d.reason ?? d.message ?? d.status_reason ?? "cobrança recusada").slice(0, 140);
    await db.clubMember.update({ where: { id: m.id }, data: { lastChargeAt: new Date(), lastChargeStatus: "falhou", failReason: reason } });
    await event(m.id, "falhou", `Cobrança recusada: ${reason}`, value);
    return "falhou";
  }
  if (ev === "subscription_cancelation" || ev === "subscription_canceled" || ev === "subscription_cancelled") {
    await db.clubMember.update({ where: { id: m.id }, data: { status: "cancelado", canceledAt: new Date(), codeActive: false } });
    if (m.discountId) await setCodeActive(m.discountId, false).catch(() => null);
    await event(m.id, "cancelou", "Cancelou a assinatura");
    return "cancelado";
  }
  if (ev === "subscription_delayed" || ev === "subscription_late") {
    await db.clubMember.update({ where: { id: m.id }, data: { lastChargeStatus: "falhou", failReason: "mensalidade atrasada" } });
    await event(m.id, "falhou", "Mensalidade atrasada", value);
    return "atrasado";
  }
  if (ev === "subscription_paused") { await event(m.id, "pausou", "Assinatura pausada"); return "pausado"; }
  if (ev === "subscription_resumed") { await event(m.id, "voltou", "Assinatura reativada"); return "reativado"; }
  if (ev === "subscription_payment_method_updated") { await event(m.id, "voltou", "Trocou a forma de pagamento"); return "ok"; }
  return "ignorado";
}

