import { db } from "./db";

// Configurações editáveis no painel, com valores padrão.
export const DEFAULTS = {
  winback: {
    enabled: true,
    delayMinutes: 10,
    // {loja} vira o nome da loja, {nome} o primeiro nome da pessoa, {grupo} o nome do grupo, {link} o convite
    text: "Oi {nome}, aqui é da {loja}. Vimos que você saiu do {grupo}. Se quiser voltar, o link é este: {link}",
    onlyIfNotRemovedByAdmin: true,
  },
  report: {
    enabled: true,
    time: "22:00",
    weeklyEnabled: true,
    weeklyDay: 1, // segunda
    weeklyTime: "08:00",
    items: {
      revenue: true,
      ads: true,
      profit: true,
      conversion: true,
      champion: true,
      tip: true,
      groups: false,
    },
  },
  sending: {
    // proteção contra bloqueio do número
    maxPerHour: 200,
    minDelayMs: 4000,
    maxDelayMs: 12000,
  },
  leads: {
    welcomeEnabled: true,
    // {nome} vira o primeiro nome e {link} o link que leva ao grupo com vaga
    welcomeText: "Oi {nome}, aqui é da {loja}! Seu cadastro no Grupo VIP foi feito. Entre no grupo por este link: {link}",
  },
  recovery: {
    cartEnabled: false,
    cartSteps: [
      { delayMin: 30, text: "Oi {nome}, tudo bem? Vi que você deixou {produto} no carrinho da {loja}. Ainda dá tempo de garantir: {link}" },
      { delayMin: 720, text: "{nome}, seu carrinho ainda está guardado. Se ficou alguma dúvida de tamanho ou frete, é só responder aqui. {link}" },
      { delayMin: 1440, text: "Última chamada, {nome}: o {produto} pode esgotar no seu tamanho. Finalize aqui: {link}" },
    ],
    pixEnabled: false,
    pixSteps: [
      { delayMin: 20, text: "Oi {nome}! Seu pedido {pedido} na {loja} está aguardando o pagamento de {valor}. Para pagar ou gerar um novo Pix: {link}" },
      { delayMin: 360, text: "{nome}, o pagamento do pedido {pedido} ainda não caiu. Se precisar de ajuda, responda aqui. {link}" },
    ],
    trackingEnabled: false,
    trackingText: "Oi {nome}! Seu pedido {pedido} da {loja} já foi enviado. Acompanhe a entrega aqui: {rastreio}",
    delayedDays: 10,
  },
  postsale: {
    reviewEnabled: false,
    reviewDelayDays: 2,
    reviewText: "Oi {nome}! Seu pedido {pedido} chegou? Conta pra gente o que achou e manda uma foto usando. Como agradecimento, use o cupom {cupom} na próxima compra.",
    coupon: "VOLTEI10",
    repurchaseEnabled: false,
    repurchaseDays: 45,
    repurchaseText: "Oi {nome}, sentimos sua falta na {loja}! Chegaram novidades e separamos o cupom {cupom} para você: {link}",
    storeUrl: "https://rastahale.com.br",
  },
  referral: {
    enabled: true,
    percent: 10,
    commission: 10,
    releaseDays: 7,
    shareText: "Oi {nome}! Você ganhou um código para indicar a {loja}: {codigo}. Quem usar ganha {percent}% de desconto e você acompanha suas indicações com a gente.",
  },
  assistant: {
    enabled: false,
    instructions: "Responda como a equipe da Rasta Hale, de forma simples e simpática. Trocas em até 7 dias pelo WhatsApp. Envio em até 2 dias úteis pela Olist.",
    useOrders: true,
    useStock: true,
    useSizes: false,
    sizeTable: "",
    useExchange: false,
    exchangeText: "",
    handoff: true,
  },
  costs: {
    taxRate: 0.06, // imposto sobre o faturamento
    paymentFeeRate: 0.045, // média das taxas de pagamento
    packagingPerItem: 4,
  },
} as const;

export type Settings = {
  winback: { enabled: boolean; delayMinutes: number; text: string; onlyIfNotRemovedByAdmin: boolean };
  report: {
    enabled: boolean;
    time: string;
    weeklyEnabled: boolean;
    weeklyDay: number;
    weeklyTime: string;
    items: Record<keyof (typeof DEFAULTS)["report"]["items"], boolean>;
  };
  sending: { maxPerHour: number; minDelayMs: number; maxDelayMs: number };
  costs: { taxRate: number; paymentFeeRate: number; packagingPerItem: number };
  leads: { welcomeEnabled: boolean; welcomeText: string };
  recovery: {
    cartEnabled: boolean;
    cartSteps: { delayMin: number; text: string }[];
    pixEnabled: boolean;
    pixSteps: { delayMin: number; text: string }[];
    trackingEnabled: boolean;
    trackingText: string;
    delayedDays: number;
  };
  postsale: {
    reviewEnabled: boolean;
    reviewDelayDays: number;
    reviewText: string;
    coupon: string;
    repurchaseEnabled: boolean;
    repurchaseDays: number;
    repurchaseText: string;
    storeUrl: string;
  };
  referral: { enabled: boolean; percent: number; commission: number; releaseDays: number; shareText: string };
  assistant: { enabled: boolean; instructions: string; useOrders: boolean; useStock: boolean; useSizes: boolean; sizeTable: string; useExchange: boolean; exchangeText: string; handoff: boolean };
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const out = structuredClone(DEFAULTS) as unknown as Settings;
  for (const r of rows) {
    if (r.key in out) {
      (out as Record<string, unknown>)[r.key] = { ...(out as Record<string, object>)[r.key], ...(r.value as object) };
    }
  }
  return out;
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Partial<Settings[K]>) {
  const current = (await getSettings())[key];
  const merged = { ...current, ...value };
  await db.setting.upsert({
    where: { key },
    create: { key, value: merged as object },
    update: { value: merged as object },
  });
  return merged;
}
