// Modo demonstração: toda chamada para Shopify, Meta, WhatsApp e Appmax é respondida aqui, com dados fictícios.
// Nada sai para fora e nenhuma mensagem é enviada de verdade.
import { demoShopify } from "./shopify";
import { demoGraph } from "./meta";

export const isDemo = () => process.env.DEMO_MODE === "1";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
// QR Code de exemplo (imagem pequena, não é um Pix de verdade)
const QR = "iVBORw0KGgoAAAANSUhEUgAAAOcAAADnAQAAAADNj3yNAAABq0lEQVR42u2ZQW7rMAxEH+MA/jvlBspNlJtZuZl7E+UGzk4BbM9fSG67+X9ZlEW5MWyuBhwOh7SJf4dO/C9+s1+TRSsAphoKmKTC1FLT7hTRKEkmSfME40I63navFXyaZTa7wN1WgmbYzK7+Ofm8ArzMLP+MLhtVQOdxIWXnyvDRR8paR2menPfRy8zswDdWAJmZ3bzWqEeTBKkGzVP/5lW9CSVpZ5SU7Z2DS3SLSJXYBlGcJ1sJJWUYHddINUg6BGIdpRmTFpJf1kHSPmgh6XijUdGtMpQ2geK7JHSBcOvrFpKAUFI21SDlBtNvjZaoLNVQkqx3VbPgflnXtSB22Z4nBr+ITvCyaxLAw/J2fsUC9jJLs1vPUENp5COJoYaStPeH4x122odKlPbhMwf9egaY+qq3Q5DEUPE+Ybvv+Xxn8DxhWyxxnqxr+erX153YzMzsBDxu7JtdHjcYnhfHW/koSUDQfLe+8Z2Bt4xfF8R0bOWSCvQj1+4aUVv8mshlWyE6vtcBMGiJ98z2B97ahP0Zt6DD0Lnej/rduwFrTlzdibtEZL9/W7599i91ALRFrOUPwgAAAABJRU5ErkJggg==";
const appmaxOrders = new Map<number, number>();
let appmaxSeq = 7000;

async function evolution(url: URL, init?: RequestInit) {
  const p = url.pathname;
  if (p.includes("/instance/connectionState")) return json({ instance: { state: "open" } });
  if (p.includes("/instance/fetchInstances")) return json([{ name: "demo", connectionStatus: "open", ownerJid: "552140000000@s.whatsapp.net", profileName: "Maré Alta" }]);
  if (p.includes("/instance/connect")) return json({ code: "demo" });
  if (p.includes("/group/fetchAllGroups")) {
    const { db } = await import("../db");
    const groups = await db.group.findMany({ include: { members: { where: { leftAt: null }, include: { contact: true } } } });
    return json(groups.map((g) => ({ id: g.jid, subject: g.name, desc: g.description, size: g.size, participants: g.members.map((m) => ({ id: `${m.contact.phone}@s.whatsapp.net`, admin: m.isAdmin ? "admin" : null })).concat([{ id: "552140000000@s.whatsapp.net", admin: "superadmin" }]) })));
  }
  if (p.includes("/group/inviteCode")) return json({ inviteCode: "DemoMareAlta" });
  if (p.includes("/message/") || p.includes("/group/")) return json({ key: { id: `DEMO${Date.now()}${Math.floor(Math.random() * 1e6)}` }, status: "PENDING" });
  void init;
  return json({});
}

async function appmax(url: URL, init?: RequestInit) {
  const p = url.pathname;
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (p.includes("/oauth2/token")) return json({ access_token: "demo", expires_in: 3600 });
  if (p.endsWith("/v1/customers")) return json({ data: { customer: { id: appmaxSeq++ } } });
  if (p.endsWith("/v1/orders")) { const id = appmaxSeq++; appmaxOrders.set(id, Date.now()); return json({ data: { order: { id } } }); }
  if (p.endsWith("/v1/payments/pix")) return json({ data: { payment: { pix_qrcode: QR, pix_emv: "00020126580014BR.GOV.BCB.PIX0136demo-mare-alta-assinatura-clube5204000053039865406029.905802BR5909MARE ALTA6014RIO DE JANEIRO62070503***6304DEMO", pix_expiration_date: new Date(Date.now() + 30 * 60_000).toISOString() } } });
  if (p.endsWith("/v1/payments/tokenize")) return json({ data: { token: "demo-token" } });
  if (p.endsWith("/v1/payments/credit-card")) return json({ data: { status: "aprovado" } });
  const m = p.match(/\/v1\/orders\/(\d+)/);
  // o Pix da demonstração "cai" sozinho depois de 8 segundos
  if (m) { const at = appmaxOrders.get(Number(m[1])) ?? 0; return json({ data: { order: { id: Number(m[1]), status: Date.now() - at > 8000 ? "aprovado" : "pendente" } } }); }
  if (p.endsWith("/v1/subscriptions")) return json({ data: { id: appmaxSeq++, next_charge_at: new Date(Date.now() + 30 * 864e5).toISOString() } });
  void body;
  return json({ data: {} });
}

export function installDemoFetch() {
  const g = globalThis as unknown as { __demoFetch?: boolean; fetch: typeof fetch };
  if (g.__demoFetch) return;
  g.__demoFetch = true;
  const real = g.fetch.bind(globalThis);
  g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const host = url.hostname;
    if (host.endsWith(".myshopify.com")) {
      const b = JSON.parse(String(init?.body ?? "{}")) as { query: string; variables?: Record<string, unknown> };
      return json(demoShopify(b.query, b.variables ?? {}));
    }
    if (host === "graph.facebook.com") return json(demoGraph(url));
    if (host.includes("appmax")) return appmax(url, init);
    if (host.includes("evolution") || host.endsWith(".demo.local")) return evolution(url, init);
    if (host === "api.anthropic.com" || host === "api.openai.com") return json({ error: { message: "Desligado na demonstração" } }, 400);
    return real(input as RequestInfo, init);
  }) as typeof fetch;
}
