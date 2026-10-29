import { addDays, isoDayLocal } from "./time";

export type PeriodKey = "hoje" | "ontem" | "7d" | "30d" | "90d" | "mes" | "mes-passado";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "mes-passado", label: "Mês passado" },
  { key: "90d", label: "90 dias" },
];

export function resolvePeriod(p: string | undefined, fallback: PeriodKey = "30d") {
  const key = (PERIODS.find((x) => x.key === p)?.key ?? fallback) as PeriodKey;
  const today = isoDayLocal();
  let from = today;
  let to = today;
  switch (key) {
    case "ontem": from = to = addDays(today, -1); break;
    case "7d": from = addDays(today, -6); break;
    case "30d": from = addDays(today, -29); break;
    case "90d": from = addDays(today, -89); break;
    case "mes": from = `${today.slice(0, 7)}-01`; break;
    case "mes-passado": {
      const first = `${today.slice(0, 7)}-01`;
      to = addDays(first, -1);
      from = `${to.slice(0, 7)}-01`;
      break;
    }
  }
  const label = PERIODS.find((x) => x.key === key)!.label;
  return { key, from, to, label, monthMode: key === "mes" || key === "mes-passado" };
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
