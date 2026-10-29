// API oficial do WhatsApp (Cloud API da Meta): mensagens com selo de empresa, botões e modelos aprovados.
// Fora da janela de 24 h desde a última mensagem do cliente, só modelo aprovado pode ser enviado.
import { creds } from "./integrations";

const GRAPH = "https://graph.facebook.com/v23.0";

export async function hasWaba() {
  const c = (await creds()).waba;
  return !!c.phoneId && !!c.token;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const c = (await creds()).waba;
  if (!c.phoneId || !c.token) throw new Error("WABA_NAO_CONFIGURADA");
  const r = await fetch(`${GRAPH}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } };
  if (!r.ok) throw new Error(j.error?.message ?? `WhatsApp respondeu ${r.status}`);
  return j;
}

const phoneId = async () => (await creds()).waba.phoneId!;
const to = (phone: string) => phone.replace(/\D/g, "");

export async function wabaInfo() {
  return call<{ display_phone_number?: string; verified_name?: string; quality_rating?: string; code_verification_status?: string }>("GET", `${await phoneId()}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`);
}

export async function wabaText(phone: string, text: string) {
  return call<{ messages?: { id: string }[] }>("POST", `${await phoneId()}/messages`, { messaging_product: "whatsapp", to: to(phone), type: "text", text: { body: text, preview_url: true } });
}

// Até 3 botões de resposta rápida
export async function wabaButtons(phone: string, text: string, buttons: { id: string; title: string }[]) {
  return call<{ messages?: { id: string }[] }>("POST", `${await phoneId()}/messages`, {
    messaging_product: "whatsapp", to: to(phone), type: "interactive",
    interactive: { type: "button", body: { text }, action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) } })) } },
  });
}

// Botão com link (ex.: voltar ao carrinho)
export async function wabaLinkButton(phone: string, text: string, label: string, url: string) {
  return call<{ messages?: { id: string }[] }>("POST", `${await phoneId()}/messages`, {
    messaging_product: "whatsapp", to: to(phone), type: "interactive",
    interactive: { type: "cta_url", body: { text }, action: { name: "cta_url", parameters: { display_text: label.slice(0, 20), url } } },
  });
}

// Modelo aprovado na Meta (necessário fora da janela de 24 h)
export async function wabaTemplate(phone: string, name: string, params: string[] = [], lang = "pt_BR") {
  return call<{ messages?: { id: string }[] }>("POST", `${await phoneId()}/messages`, {
    messaging_product: "whatsapp", to: to(phone), type: "template",
    template: { name, language: { code: lang }, components: params.length ? [{ type: "body", parameters: params.map((t) => ({ type: "text", text: t })) }] : [] },
  });
}

export async function wabaTemplates() {
  const c = (await creds()).waba;
  if (!c.wabaId) return [];
  const j = await call<{ data?: { name: string; status: string; category: string; language: string }[] }>("GET", `${c.wabaId}/message_templates?fields=name,status,category,language&limit=100`);
  return j.data ?? [];
}
