// Assistente de atendimento com IA no WhatsApp: responde dúvidas com os dados reais da loja
// e passa para a equipe quando precisa.
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { env } from "./env";
import { evolution } from "./evolution";
import { creds } from "./integrations";
import { getSettings } from "./settings";
import { gql, products } from "./store";
import { sendText } from "./send";
import { transcribe } from "./ai";

async function catalog(): Promise<string> {
  try {
    const list = await products();
    return list
      .slice(0, 60)
      .map((p) => {
        const sizes = p.variants.filter((v) => v.stock > 0).map((v) => (v.title === "Default Title" ? "único" : v.title));
        const price = p.variants[0]?.price ?? 0;
        return `- ${p.title}: R$ ${price.toFixed(2).replace(".", ",")}; disponível: ${sizes.length ? sizes.join(", ") : "esgotado"}`;
      })
      .join("\n");
  } catch {
    return "(catálogo indisponível agora)";
  }
}

async function lastOrderOf(phone: string): Promise<string> {
  try {
    const d = await gql<{ customers: { nodes: { displayName: string; lastOrder: { name: string; displayFinancialStatus: string; displayFulfillmentStatus: string; createdAt: string; fulfillments: { trackingInfo: { url: string | null; number: string }[]; deliveredAt: string | null }[] } | null }[] } }>(
      `query($q:String){ customers(first:1, query:$q){ nodes{ displayName lastOrder{ name displayFinancialStatus displayFulfillmentStatus createdAt fulfillments(first:1){ deliveredAt trackingInfo{ url number } } } } } }`,
      { q: `phone:+${phone}` },
    );
    const c = d.customers.nodes[0];
    if (!c?.lastOrder) return "Cliente sem pedido encontrado por este número.";
    const o = c.lastOrder;
    const t = o.fulfillments[0]?.trackingInfo[0];
    return `Cliente: ${c.displayName}. Último pedido ${o.name} de ${o.createdAt.slice(0, 10)}, pagamento ${o.displayFinancialStatus}, envio ${o.displayFulfillmentStatus}${t ? `, rastreio ${t.url ?? t.number}` : ""}${o.fulfillments[0]?.deliveredAt ? ", já entregue" : ""}.`;
  } catch {
    return "";
  }
}

export async function assistantReply(phone: string, audioId?: string | null) {
  const s = await getSettings();
  if (!s.assistant.enabled) return;
  const c = await creds();
  if (!c.ai.key) return;
  const thread = await db.chatThread.findUnique({ where: { phone } });
  if (!thread || !thread.aiEnabled || thread.status === "resolvido") return;

  // Áudio: transcreve e troca o texto guardado
  if (audioId) {
    try {
      const media = await evolution.mediaBase64(audioId);
      const t = await transcribe(media.base64, media.mimetype ?? "audio/ogg");
      if (t) await db.chatMessage.updateMany({ where: { messageId: audioId }, data: { text: `[áudio] ${t}` } });
    } catch {
      /* sem transcrição */
    }
  }

  const history = await db.chatMessage.findMany({ where: { phone }, orderBy: { createdAt: "desc" }, take: 14 });
  if (!history.length || history[0].fromMe) return; // já respondido
  // Se a equipe respondeu nos últimos 30 minutos, a IA não se mete
  const teamRecent = history.find((m) => m.by === "equipe" && Date.now() - m.createdAt.getTime() < 30 * 60_000);
  if (teamRecent) return;

  const msgs: Anthropic.MessageParam[] = [];
  for (const m of history.reverse()) {
    const role = m.fromMe ? "assistant" : "user";
    const last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n${m.text}`;
    else msgs.push({ role, content: m.text });
  }
  if (msgs[0]?.role === "assistant") msgs.shift();
  if (!msgs.length) return;

  const [cat, order] = await Promise.all([catalog(), lastOrderOf(phone)]);
  const system = `Você é o atendimento da ${env.storeName()} no WhatsApp (${env.storeAbout()}).
Regras da loja, definidas pelo dono:
${s.assistant.instructions}

Produtos ativos, preços e tamanhos disponíveis agora:
${cat}

${order}

Como responder:
- Português simples e simpático, frases curtas, como uma pessoa da equipe. Sem travessões, sem listas longas, no máximo um emoji se fizer sentido.
- Use só as informações acima. Se não souber, não invente.
- Se for troca, devolução, reclamação, problema com pedido, pedido de desconto especial ou algo que você não consiga resolver, responda só com uma frase curta avisando que vai chamar alguém da equipe e termine a mensagem com [HUMANO].
- Nunca peça dados de cartão ou senhas.`;

  const client = new Anthropic({ apiKey: c.ai.key });
  const res = await client.messages.create({ model: c.ai.model ?? env.anthropicModel(), max_tokens: 400, system, messages: msgs });
  let text = res.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("\n").trim();
  if (!text) return;
  const handoff = text.includes("[HUMANO]");
  text = text.replace("[HUMANO]", "").trim();

  await sendText(phone, text);
  await db.chatMessage.create({ data: { phone, fromMe: true, by: "ia", text } });
  await db.chatThread.update({ where: { phone }, data: { lastText: text.slice(0, 200), lastAt: new Date(), ...(handoff ? { aiEnabled: false } : { unread: 0 }) } });

  if (handoff) {
    const groups = await db.group.findMany({ where: { isResults: true } });
    const lastClient = history.filter((m) => !m.fromMe).pop()?.text ?? "";
    for (const g of groups) await sendText(g.jid, `*Atendimento precisa de você*\n${thread.name ?? phone}: "${lastClient.slice(0, 200)}"\nResponda pelo painel em Atendimento.`);
  }
}
