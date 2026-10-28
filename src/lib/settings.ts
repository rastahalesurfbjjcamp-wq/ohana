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
