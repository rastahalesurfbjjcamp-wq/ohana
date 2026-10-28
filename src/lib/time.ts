import { TZDate } from "@date-fns/tz";
import { env } from "./env";

export const tz = () => env.timezone();

// Agora no fuso da loja
export function nowLocal() {
  return new TZDate(new Date(), tz());
}

// Início e fim de um dia (AAAA-MM-DD) no fuso da loja, em UTC
export function dayRange(isoDay: string) {
  const [y, m, d] = isoDay.split("-").map(Number);
  const start = new TZDate(y, m - 1, d, 0, 0, 0, tz());
  const end = new TZDate(y, m - 1, d + 1, 0, 0, 0, tz());
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

export function isoDayLocal(date: Date = new Date()) {
  const t = new TZDate(date, tz());
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

export function addDays(isoDay: string, n: number) {
  const [y, m, d] = isoDay.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function hhmmLocal(date: Date = new Date()) {
  const t = new TZDate(date, tz());
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export function weekdayName(isoDay: string) {
  const [y, m, d] = isoDay.split("-").map(Number);
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function brl(v: number, decimals = 2) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function pct(v: number, decimals = 2) {
  return `${(v * 100).toFixed(decimals).replace(".", ",")}%`;
}
