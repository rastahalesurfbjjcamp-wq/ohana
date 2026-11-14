// Programa de embaixadores: níveis, regras e quem pode subir de nível.
// Toda subida passa pela aprovação da equipe: o sistema só mostra quem bateu a meta.
import { db } from "./db";

export type Level = {
  key: string;
  name: string;
  pct: number; // comissão
  orders: number | null; // meta: pedidos no cupom nos últimos 3 meses (null = sem meta)
  how: string; // como entrar pelos requisitos
  siteOff: number; // desconto pessoal no site, em peças avulsas (%)
  perks: string; // outros benefícios
  invite?: boolean; // só convidados
  soon?: boolean;
  clientOff: number;
};
export type AmbProgram = { v: 2; levels: Level[]; minWithdrawCents: number; clientOff: number };

const KEY = "_ambassador_program";
export const WINDOW_DAYS = 90;

export const BELTS = ["Branca", "Azul", "Roxa", "Marrom", "Preta", "Coral (vermelha e preta)", "Coral (vermelha e branca)", "Vermelha"] as const;

export function ambDefaults(): AmbProgram {
  return {
    v: 2,
    minWithdrawCents: 10000,
    clientOff: 10,
    levels: [
      { key: "bronze", name: "Bronze", pct: 5, orders: 0, how: "Faça conteúdos interativos nas redes sociais", siteOff: 0, perks: "", clientOff: 10 },
      { key: "prata", name: "Prata", pct: 6, orders: 60, how: "Tenha conteúdos relevantes, seja faixa preta e/ou esteja bem alinhado com os nossos princípios", siteOff: 20, perks: "", clientOff: 10 },
      { key: "ouro", name: "Ouro", pct: 7, orders: 90, how: "Seja professor de jiu-jitsu em alguma academia ou seja muito relevante nas redes sociais", siteOff: 35, perks: "", clientOff: 10 },
      { key: "premium", name: "Premium", pct: 8, orders: 120, how: "Tenha características dos outros níveis e seja relevante no surf ou no jiu-jitsu nas redes sociais", siteOff: 0, perks: "2 conjuntos grátis por drop", clientOff: 10 },
      { key: "team", name: "Rasta Hale Professional Team", pct: 8, orders: null, how: "Apenas convidados", siteOff: 0, perks: "", invite: true, clientOff: 10 },
    ],
  };
}

export async function ambProgram(): Promise<AmbProgram> {
  const s = await db.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  const d = ambDefaults();
  if (!s) return d;
  const v = s.value as Partial<AmbProgram>;
  // regras antigas (sobe por comissão acumulada): troca pelos níveis novos, mantém saque mínimo e desconto do cliente
  if (v.v !== 2 || !v.levels?.length) return { ...d, minWithdrawCents: v.minWithdrawCents ?? d.minWithdrawCents, clientOff: v.clientOff ?? d.clientOff };
  return { ...d, ...v, v: 2 } as AmbProgram;
}

export async function saveAmbProgram(p: AmbProgram) {
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: p as object }, update: { value: p as object } });
}

// sugestão de nível no cadastro (a equipe confirma ao aprovar): professor → Ouro, faixa preta → Prata
export const startLevel = (belt: string | null | undefined, teacher: boolean | null | undefined) =>
  teacher ? "ouro" : /^(Preta|Coral|Vermelha)/.test(belt ?? "") ? "prata" : "bronze";

export const levelOf = (p: AmbProgram, key: string | null | undefined) => p.levels.find((l) => l.key === key) ?? p.levels[0];

export function nextLevel(p: AmbProgram, cur: Level): Level | null {
  const i = p.levels.findIndex((l) => l.key === cur.key);
  const n = p.levels[i + 1];
  return n && !n.invite && !n.soon ? n : null;
}

// maior nível cuja meta de pedidos já foi batida (acima do atual)
export function eligibleFor(p: AmbProgram, cur: Level, orders90: number): Level | null {
  const i = p.levels.findIndex((l) => l.key === cur.key);
  let best: Level | null = null;
  for (const l of p.levels.slice(i + 1)) if (!l.invite && !l.soon && l.orders != null && orders90 >= l.orders) best = l;
  return best;
}

// pedidos pagos no cupom/link nos últimos 3 meses (estornos descontados)
export async function orders90(ids: string[]): Promise<Map<string, number>> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000);
  const rows = await db.partnerEarning.groupBy({ by: ["referralId", "kind"], where: { referralId: { in: ids }, kind: { in: ["venda", "estorno"] }, orderAt: { gte: since } }, _count: { _all: true } }).catch(() => []);
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.referralId, (m.get(r.referralId) ?? 0) + (r.kind === "venda" ? 1 : -1) * r._count._all);
  return m;
}
