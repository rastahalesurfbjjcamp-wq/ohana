// Mensagens manuais: o botão no pedido ou no carrinho manda a mensagem escolhida e fica verde.
import { db } from "./db";
import { env } from "./env";
import { getSettings } from "./settings";
import { sendMedia, sendText } from "./send";

export type QuickPart = { text?: string; mediaUrl?: string; mediaType?: string; productImage?: boolean };
export type QuickCtx = { nome?: string; produtos?: string; valor?: string; link?: string; pedido?: string; rastreio?: string; imagem?: string };

export const QUICK_VARS = ["{nome}", "{produtos}", "{valor}", "{link}", "{pedido}", "{rastreio}", "{loja}"];

const DEFAULTS: { name: string; kind: string; show: string; parts: QuickPart[] }[] = [
  { name: "Recuperação de carrinho", kind: "carrinho", show: "todos", parts: [
    { productImage: true },
    { text: "Olá {nome}, tudo bem? 😊\n\nReservamos o seu pedido, mas não conseguimos segurar por muito tempo porque a procura está grande.\n\nÉ só acessar o link abaixo para finalizar 👇" },
    { text: "{link}" },
  ] },
  { name: "Cartão recusado", kind: "carrinho", show: "todos", parts: [
    { text: "Olá {nome}, tudo bem? Vimos que o pagamento no cartão não passou, mas reservamos o seu pedido.\n\nVocê pode tentar de novo ou pagar com Pix pelo link abaixo 👇" },
    { text: "{link}" },
  ] },
  { name: "Pix ou boleto pendente", kind: "pedido", show: "pendente", parts: [
    { text: "Olá {nome}, tudo bem? 😊\n\nSeu pedido {pedido} ({produtos}) está reservado, só falta a confirmação do pagamento de {valor} para prepararmos o envio.\n\nPara pagar ou ver o código, acesse 👇" },
    { text: "{link}" },
  ] },
  { name: "Pedido confirmado", kind: "pedido", show: "pago", parts: [
    { text: "Olá {nome}, tudo bem? 😊\n\nSeu pedido {pedido} na {loja} foi confirmado e já está sendo preparado para o envio. Assim que sair, te mandamos o rastreio por aqui." },
  ] },
  { name: "Rastreio", kind: "pedido", show: "enviado", parts: [
    { text: "Olá {nome}! 👋\n\nSeu pedido {pedido} já está com a transportadora 🚚\n\nRastreio: {rastreio}" },
  ] },
];

export async function quickMessages() {
  let list = await db.quickMessage.findMany({ orderBy: [{ kind: "asc" }, { position: "asc" }, { createdAt: "asc" }] });
  if (!list.length) {
    await db.quickMessage.createMany({ data: DEFAULTS.map((d, i) => ({ ...d, parts: d.parts, position: i })) });
    list = await db.quickMessage.findMany({ orderBy: [{ kind: "asc" }, { position: "asc" }, { createdAt: "asc" }] });
  }
  return list;
}

export function fill(text: string, c: QuickCtx, loja: string) {
  return text
    .replaceAll("{nome}", (c.nome ?? "").split(" ")[0] || "tudo bem")
    .replaceAll("{produtos}", c.produtos ?? "")
    .replaceAll("{valor}", c.valor ?? "")
    .replaceAll("{link}", c.link ?? "")
    .replaceAll("{pedido}", c.pedido ?? "")
    .replaceAll("{rastreio}", c.rastreio ?? "")
    .replaceAll("{loja}", loja)
    .trim();
}

// Manda as partes da mensagem, na ordem, e registra o envio
export async function sendQuick(messageId: string, refId: string, phone: string, ctx: QuickCtx, by?: string) {
  const m = await db.quickMessage.findUnique({ where: { id: messageId } });
  if (!m) throw new Error("Mensagem não encontrada");
  const loja = env.storeName();
  const base = env.appUrl().replace(/\/$/, "");
  void (await getSettings());
  try {
    const parts = (m.parts ?? []) as QuickPart[];
    for (const [i, p] of parts.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1500));
      const text = p.text ? fill(p.text, ctx, loja) : "";
      const url = p.productImage ? ctx.imagem : p.mediaUrl ? (p.mediaUrl.startsWith("http") ? p.mediaUrl : `${base}${p.mediaUrl}`) : null;
      if (url) await sendMedia(phone, { url, type: (p.productImage ? "image" : p.mediaType ?? "image") as "image" | "video" | "document", caption: text });
      else if (text) await sendText(phone, text);
    }
    await db.quickSend.create({ data: { messageId, refId, phone, by } });
  } catch (e) {
    await db.quickSend.create({ data: { messageId, refId, phone, by, error: String(e).replace(/^Error: /, "").slice(0, 200) } });
    throw e;
  }
}

export async function sentFor(refIds: string[]) {
  if (!refIds.length) return new Map<string, { messageId: string; at: Date; by: string | null; error: string | null }[]>();
  const rows = await db.quickSend.findMany({ where: { refId: { in: refIds } }, orderBy: { createdAt: "asc" } });
  const out = new Map<string, { messageId: string; at: Date; by: string | null; error: string | null }[]>();
  for (const r of rows) out.set(r.refId, [...(out.get(r.refId) ?? []), { messageId: r.messageId, at: r.createdAt, by: r.by, error: r.error }]);
  return out;
}
