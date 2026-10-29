// IA: interpreta comandos do grupo de resultados e transcreve áudios.
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";
import { creds } from "./integrations";

export async function hasAI() {
  return !!(await creds()).ai.key;
}

let _client: { key: string; c: Anthropic } | null = null;
async function client() {
  const key = (await creds()).ai.key ?? "";
  if (!_client || _client.key !== key) _client = { key, c: new Anthropic({ apiKey: key }) };
  return _client.c;
}
async function model() {
  return (await creds()).ai.model ?? env.anthropicModel();
}

export const COMMAND_TOOLS: Anthropic.Tool[] = [
  {
    name: "relatorio",
    description: "Mostra os números da loja (faturamento, pedidos, anúncios, lucro, conversão, produto campeão) de um período.",
    input_schema: {
      type: "object",
      properties: {
        periodo: { type: "string", enum: ["hoje", "ontem", "semana", "mes"], description: "semana = últimos 7 dias; mes = mês atual até hoje" },
      },
      required: ["periodo"],
    },
  },
  {
    name: "lancar_custo_fixo",
    description: "Lança um custo fixo mensal (aluguel, ferramenta, salário). Entra inteiro no lucro do mês.",
    input_schema: {
      type: "object",
      properties: {
        descricao: { type: "string" },
        valor: { type: "number", description: "valor mensal em reais" },
        recorrente: { type: "boolean", description: "true se repete todo mês" },
      },
      required: ["descricao", "valor", "recorrente"],
    },
  },
  {
    name: "lancar_custo",
    description: "Lança um custo avulso de um mês (ex.: sessão de fotos, frete de fornecedor).",
    input_schema: {
      type: "object",
      properties: {
        descricao: { type: "string" },
        valor: { type: "number" },
        mes: { type: "string", description: "AAAA-MM; se não falar, o mês atual" },
      },
      required: ["descricao", "valor"],
    },
  },
  {
    name: "lancar_lote_estoque",
    description:
      "Registra a compra de um lote de produção ou estoque: valor total e quantidade de peças. O sistema divide para achar o custo por peça e liga o lote ao produto pela palavra-chave que aparece no nome do produto.",
    input_schema: {
      type: "object",
      properties: {
        palavra_chave: { type: "string", description: "palavra que estará no nome do produto na loja, ex.: 'pura', 'jamaiclan'" },
        descricao: { type: "string" },
        quantidade: { type: "integer" },
        valor_total: { type: "number" },
        mes: { type: "string", description: "AAAA-MM do pagamento; se não falar, o mês atual" },
      },
      required: ["palavra_chave", "descricao", "quantidade", "valor_total"],
    },
  },
  {
    name: "listar_custos",
    description: "Lista os custos lançados num mês.",
    input_schema: { type: "object", properties: { mes: { type: "string" } } },
  },
];

const SYSTEM = () => `Você é o assistente do ${env.storeName()} Hub, o sistema de gestão da ${env.storeName()}, ${env.storeAbout()}.
Você recebe mensagens do grupo de resultados no WhatsApp, digitadas ou transcritas de áudio.
Quando a mensagem pedir números ou um lançamento, chame a ferramenta certa. Valores sempre em reais.
Se faltar uma informação necessária (como o valor), pergunte de forma curta, em português simples.
Se a mensagem não for um pedido para você (conversa entre a equipe), responda exatamente: IGNORAR.
Nunca invente números.`;

export async function interpretCommand(text: string, todayIso: string) {
  const res = await (await client()).messages.create({
    model: await model(),
    max_tokens: 600,
    system: `${SYSTEM()}\nHoje é ${todayIso}.`,
    tools: COMMAND_TOOLS,
    messages: [{ role: "user", content: text }],
  });
  const tool = res.content.find((c) => c.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  const textOut = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as Anthropic.TextBlock).text)
    .join("\n")
    .trim();
  return { tool: tool ? { name: tool.name, input: tool.input as Record<string, unknown> } : null, text: textOut };
}

export async function shortTip(numbersText: string): Promise<string | undefined> {
  if (!(await hasAI())) return undefined;
  const res = await (await client()).messages.create({
    model: await model(),
    max_tokens: 160,
    system:
      "Você analisa os números do dia de um e-commerce de moda. Responda com UMA frase curta e prática, em português simples, começando com 'Para amanhã:'. Sem travessões, sem emojis, sem inventar números que não estão no texto.",
    messages: [{ role: "user", content: numbersText }],
  });
  const t = res.content.find((c) => c.type === "text") as Anthropic.TextBlock | undefined;
  return t?.text.trim();
}

// Transcrição de áudio (API compatível com OpenAI: OpenAI, Groq e outras)
export async function transcribe(base64: string, mimetype = "audio/ogg"): Promise<string> {
  const t = (await creds()).transcribe;
  const key = t.key;
  if (!key) throw new Error("Transcrição não configurada (TRANSCRIBE_API_KEY)");
  const buf = Buffer.from(base64, "base64");
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mimetype }), mimetype.includes("ogg") ? "audio.ogg" : "audio.mp3");
  form.append("model", t.model ?? env.transcribeModel());
  form.append("language", "pt");
  const res = await fetch(t.url ?? env.transcribeUrl(), { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`Transcrição falhou: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

// Entende uma frase falada ou digitada com custos de produtos e liga cada valor ao produto certo
export async function parseCostsText(text: string, products: string[]): Promise<{ product: string; cost: number }[]> {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (await hasAI()) {
    const c = await client();
    const res = await c.messages.create({
      model: await model(),
      max_tokens: 800,
      system: `Você recebe uma frase em português com custos de produção de peças de roupa e a lista de produtos da loja.
Responda SOMENTE com JSON: [{"product": "nome exato da lista", "cost": número em reais}].
Use só produtos da lista. Se um valor não bater com nenhum produto, ignore. "58 reais" = 58; "cinquenta e dois" = 52.`,
      messages: [{ role: "user", content: `Produtos:\n${products.map((p) => `- ${p}`).join("\n")}\n\nFrase: ${text}` }],
    });
    const out = res.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("");
    try {
      const j = JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1)) as { product: string; cost: number }[];
      return j.filter((x) => products.includes(x.product) && x.cost > 0);
    } catch {
      /* cai no modo simples */
    }
  }
  // Modo simples, sem IA: "nome do produto 58" separados por vírgula ou "e"
  const out: { product: string; cost: number }[] = [];
  for (const part of text.split(/,|;|\n| e (?=[a-zA-ZÀ-ú])/)) {
    const m = part.match(/(\d+(?:[.,]\d{1,2})?)/);
    if (!m) continue;
    const words = norm(part.replace(m[0], "")).split(/\s+/).filter((w) => w.length > 2 && !["custou", "reais", "custa", "por", "peca"].includes(w));
    let best: [string, number] | null = null;
    for (const p of products) {
      const score = words.filter((w) => norm(p).includes(w)).length;
      if (score && (!best || score > best[1])) best = [p, score];
    }
    if (best) out.push({ product: best[0], cost: Number(m[1].replace(",", ".")) });
  }
  return out;
}
