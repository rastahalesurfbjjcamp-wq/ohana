// Programa de embaixadores: níveis, regras e quem sobe de nível.
import { db } from "./db";

export type Level = { key: string; name: string; pct: number; reachCents: number | null; clientOff: number; perks: string; soon?: boolean };
export type AmbProgram = { levels: Level[]; minWithdrawCents: number; clientOff: number };

const KEY = "_ambassador_program";

export const BELTS = ["Branca", "Cinza", "Amarela", "Laranja", "Verde", "Azul", "Roxa", "Marrom", "Preta", "Coral", "Vermelha", "Não treino jiu-jitsu"] as const;

export function ambDefaults(): AmbProgram {
  return {
    minWithdrawCents: 10000,
    clientOff: 10,
    levels: [
      { key: "bronze", name: "Bronze", pct: 5, reachCents: 0, clientOff: 10, perks: "" },
      { key: "prata", name: "Prata", pct: 8, reachCents: 30000, clientOff: 10, perks: "" },
      { key: "ouro", name: "Ouro", pct: 0, reachCents: null, clientOff: 10, perks: "", soon: true },
      { key: "diamante", name: "Diamante", pct: 0, reachCents: null, clientOff: 10, perks: "", soon: true },
      { key: "esmeralda", name: "Esmeralda", pct: 0, reachCents: null, clientOff: 10, perks: "", soon: true },
    ],
  };
}

export async function ambProgram(): Promise<AmbProgram> {
  const s = await db.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  const d = ambDefaults();
  if (!s) return d;
  const v = s.value as Partial<AmbProgram>;
  return { ...d, ...v, levels: v.levels?.length ? v.levels : d.levels };
}

export async function saveAmbProgram(p: AmbProgram) {
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: p as object }, update: { value: p as object } });
}

// faixa preta + professor começa direto no Prata (regra interna, não aparece no formulário)
export const startLevel = (belt: string | null | undefined, teacher: boolean | null | undefined) => (belt === "Preta" && teacher ? "prata" : "bronze");

// nível pelo que já acumulou de comissão: nunca desce, e quem começou acima mantém
export function levelFor(p: AmbProgram, current: string | null | undefined, lifetimeCents: number): Level {
  const open = p.levels.filter((l) => !l.soon && l.reachCents != null);
  const byEarn = [...open].reverse().find((l) => lifetimeCents >= (l.reachCents ?? 0)) ?? open[0];
  const cur = open.find((l) => l.key === current);
  return cur && open.indexOf(cur) > open.indexOf(byEarn) ? cur : byEarn;
}

export function nextLevel(p: AmbProgram, cur: Level): Level | null {
  const i = p.levels.findIndex((l) => l.key === cur.key);
  return p.levels[i + 1] ?? null;
}
