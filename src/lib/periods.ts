import { addDays, isoDayLocal } from "./time";

export type PeriodKey = "hoje" | "ontem" | "7d" | "30d" | "90d" | "mes" | "mes-passado" | "custom";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "mes-passado", label: "Mês passado" },
  { key: "90d", label: "90 dias" },
];

export function resolvePeriod(p: string | undefined, fallback: PeriodKey = "30d", de?: string, ate?: string) {
  const today = isoDayLocal();
  const okDate = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (p === "custom" && okDate(de)) {
    const from = de!;
    const to = okDate(ate) && ate! >= from ? (ate! > today ? today : ate!) : from;
    const f = (x: string) => `${x.slice(8)}/${x.slice(5, 7)}`;
    return { key: "custom" as PeriodKey, from, to, label: from === to ? f(from) : `${f(from)} a ${f(to)}`, monthMode: from.slice(8) === "01" && from.slice(0, 7) === to.slice(0, 7) && (to === today || addDays(to, 1).slice(8) === "01") };
  }
  const key = (PERIODS.find((x) => x.key === p)?.key ?? fallback) as PeriodKey;
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
  const label = PERIODS.find((x) => x.key === key)?.label ?? "";
  return { key, from, to, label, monthMode: key === "mes" || key === "mes-passado" };
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// Período anterior do mesmo tamanho, para comparar
export function previousPeriod(from: string, to: string) {
  const days = daysBetween(from, to).length;
  // Começo de mês: compara com os mesmos dias do mês anterior
  if (from.slice(8) === "01" && from.slice(0, 7) === to.slice(0, 7)) {
    const pFrom = `${addDays(from, -1).slice(0, 7)}-01`;
    const last = addDays(from, -1);
    const pTo = `${pFrom.slice(0, 8)}${to.slice(8)}` > last ? last : `${pFrom.slice(0, 8)}${to.slice(8)}`;
    return { from: pFrom, to: pTo, days: daysBetween(pFrom, pTo).length };
  }
  const pTo = addDays(from, -1);
  return { from: addDays(pTo, -(days - 1)), to: pTo, days };
}
