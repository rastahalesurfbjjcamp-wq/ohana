// IA: interpreta comandos do grupo de resultados e transcreve áudios.
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export function hasAI() {
  return !!env.anthropicKey();
}

let _client: Anthropic | null = null;
function client() {
  if (!_client) _client = new Anthropic({ apiKey: env.anthropicKey() });
  return _client;
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

const SYSTEM = `Você é o assistente da Tribo, o sistema de gestão da Rasta Hale, uma marca de roupas de surf e jiu-jitsu.
Você recebe mensagens do grupo de resultados no WhatsApp, digitadas ou transcritas de áudio.
Quando a mensagem pedir números ou um lançamento, chame a ferramenta certa. Valores sempre em reais.
Se faltar uma informação necessária (como o valor), pergunte de forma curta, em português simples.
Se a mensagem não for um pedido para você (conversa entre a equipe), responda exatamente: IGNORAR.
Nunca invente números.`;

export async function interpretCommand(text: string, todayIso: string) {
  const res = await client().messages.create({
    model: env.anthropicModel(),
    max_tokens: 600,
    system: `${SYSTEM}\nHoje é ${todayIso}.`,
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
  if (!hasAI()) return undefined;
  const res = await client().messages.create({
    model: env.anthropicModel(),
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
  const key = env.transcribeKey();
  if (!key) throw new Error("Transcrição não configurada (TRANSCRIBE_API_KEY)");
  const buf = Buffer.from(base64, "base64");
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mimetype }), mimetype.includes("ogg") ? "audio.ogg" : "audio.mp3");
  form.append("model", env.transcribeModel());
  form.append("language", "pt");
  const res = await fetch(env.transcribeUrl(), { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`Transcrição falhou: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}
