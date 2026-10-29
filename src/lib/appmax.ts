// Appmax: cobrança da assinatura do clube (Pix e cartão) pela API, sem tirar o cliente do site.
// Fluxo: cliente -> pedido -> pagamento (Pix ou cartão) -> quando aprovado, assinatura mensal a partir do pedido.
import { creds } from "./integrations";

const URLS = {
  producao: { auth: "https://auth.appmax.com.br", api: "https://api.appmax.com.br" },
  sandbox: { auth: "https://auth.sandboxappmax.com.br", api: "https://api.sandboxappmax.com.br" },
};
let tok: { key: string; value: string; until: number } | null = null;

export async function hasAppmax() {
  const c = (await creds()).appmax;
  return !!c.clientId && !!c.clientSecret;
}

async function base() {
  const c = (await creds()).appmax;
  if (!c.clientId || !c.clientSecret) throw new Error("APPMAX_NAO_CONFIGURADA");
  const u = URLS[c.mode === "sandbox" ? "sandbox" : "producao"];
  // endereços alternativos só para teste local
  return { c, u: { auth: process.env.APPMAX_AUTH_URL || u.auth, api: process.env.APPMAX_API_URL || u.api } };
}

async function token(force = false) {
  const { c, u } = await base();
  const key = `${c.mode}:${c.clientId}`;
  if (!force && tok && tok.key === key && tok.until > Date.now()) return tok.value;
  const r = await fetch(`${u.auth}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: c.clientId!, client_secret: c.clientSecret! }),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; message?: string };
  if (!r.ok || !j.access_token) throw new Error(`A Appmax recusou as credenciais (${r.status})${j.message ? `: ${j.message}` : ""}`);
  tok = { key, value: j.access_token, until: Date.now() + Math.max(60, (j.expires_in ?? 3600) - 120) * 1000 };
  return tok.value;
}

// Chamada à API. Nunca registra o corpo (pode ter dados de cartão).
export async function appmax<T = Record<string, unknown>>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const { u } = await base();
  const r = await fetch(`${u.api}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (r.status === 401 && retry) { await token(true); return appmax<T>(method, path, body, false); }
  const j = (await r.json().catch(() => ({}))) as T & { message?: string; errors?: unknown };
  if (!r.ok) {
    const m = (j as { message?: string }).message ?? JSON.stringify((j as { errors?: unknown }).errors ?? {}).slice(0, 160);
    throw new Error(`Appmax ${r.status}: ${m || "erro"}`);
  }
  return j;
}

// Procura um campo em qualquer nível da resposta (a documentação não mostra todos os formatos)
export function pick<T = unknown>(o: unknown, ...keys: string[]): T | undefined {
  if (!o || typeof o !== "object") return undefined;
  for (const k of keys) if (k in (o as Record<string, unknown>) && (o as Record<string, unknown>)[k] != null) return (o as Record<string, T>)[k];
  for (const v of Object.values(o as Record<string, unknown>)) {
    if (v && typeof v === "object") { const f = pick<T>(v, ...keys); if (f !== undefined) return f; }
  }
  return undefined;
}

const cents = (v: number) => Math.round(v * 100);

export async function createCustomer(p: { name: string; email: string; phone: string; cpf: string; ip?: string }) {
  const [first, ...rest] = p.name.trim().split(/\s+/);
  const j = await appmax("POST", "/v1/customers", { first_name: first, last_name: rest.join(" ") || first, email: p.email, phone: p.phone.replace(/^55/, ""), document_number: p.cpf, ip: p.ip ?? "127.0.0.1" });
  const id = pick<number>(j, "customer_id") ?? pick<number>(pick(j, "customer"), "id") ?? pick<number>(j, "id");
  if (!id) throw new Error("A Appmax não devolveu o cliente");
  return Number(id);
}

export async function createOrder(customerId: number, item: { sku: string; name: string; value: number }) {
  const j = await appmax("POST", "/v1/orders", { customer_id: customerId, products_value: cents(item.value), discount_value: 0, shipping_value: 0, products: [{ sku: item.sku, name: item.name, quantity: 1, unit_value: cents(item.value), type: "digital" }] });
  const id = pick<number>(pick(j, "order"), "id") ?? pick<number>(j, "order_id");
  if (!id) throw new Error("A Appmax não devolveu o pedido");
  return Number(id);
}

export async function payPix(orderId: number, cpf: string, minutes = 30) {
  const exp = new Date(Date.now() + minutes * 60_000);
  const local = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(exp);
  const j = await appmax("POST", "/v1/payments/pix", { order_id: orderId, payment_data: { pix: { document_number: cpf, expiration_date: local } } });
  const emv = pick<string>(j, "pix_emv");
  const qr = pick<string>(j, "pix_qrcode");
  if (!emv) throw new Error("A Appmax não gerou o Pix");
  return { emv, qr: qr ?? null, expires: exp };
}

// O número do cartão só passa por aqui para virar token na Appmax. Não é salvo nem registrado.
export async function payCard(orderId: number, customerId: number, card: { number: string; cvv: string; month: string; year: string; holder: string; cpf: string }) {
  const t = await appmax("POST", "/v1/payments/tokenize", { payment_data: { credit_card: { number: card.number, cvv: card.cvv, expiration_month: card.month, expiration_year: card.year, holder_name: card.holder } } });
  const token = pick<string>(t, "token");
  if (!token) throw new Error("O cartão não foi aceito. Confira os dados.");
  const j = await appmax("POST", "/v1/payments/credit-card", { order_id: orderId, customer_id: customerId, payment_data: { credit_card: { token, holder_document_number: card.cpf, holder_name: card.holder, installments: 1, soft_descriptor: "RASTAHALE" } } });
  const status = String(pick<string>(j, "status") ?? "").toLowerCase();
  return { status, raw: j };
}

export async function orderStatus(orderId: number) {
  const j = await appmax("GET", `/v1/orders/${orderId}`);
  return String(pick<string>(pick(j, "order") ?? j, "status") ?? "").toLowerCase();
}

export async function createSubscription(orderId: number) {
  const j = await appmax("POST", "/v1/subscriptions", { order_id: orderId, interval: "month", interval_count: 1 });
  const id = pick<number>(pick(j, "data") ?? j, "id");
  const next = pick<string>(j, "next_charge_at");
  return { id: id ? String(id) : null, next: next ? new Date(next) : null };
}

export async function cancelSubscription(id: string, reason = "Cancelado pelo painel") {
  await appmax("PATCH", `/v1/subscriptions/${id}/cancel`, { reason });
}

export const PAID = new Set(["aprovado", "integrado", "pendente_integracao", "paid", "approved"]);
export const FAILED = new Set(["cancelado", "recusado_por_risco", "estornado", "refused", "failed"]);
