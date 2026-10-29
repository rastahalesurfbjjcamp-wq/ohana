import type { Customer } from "./store";

export const SEGMENTS = {
  todos: { label: "Todos", desc: "Todo mundo que já comprou" },
  vip: { label: "VIP", desc: "3 compras ou mais, ou R$ 1.000 gastos" },
  recorrentes: { label: "Recorrentes", desc: "2 compras ou mais" },
  novos: { label: "Novos", desc: "Primeira compra nos últimos 60 dias" },
  inativos: { label: "Inativos", desc: "Sem comprar há mais de 120 dias" },
} as const;
export type SegmentKey = keyof typeof SEGMENTS;

const DAY = 864e5;
export function inSegment(c: Customer, seg: SegmentKey): boolean {
  const last = c.lastOrderAt ? Date.parse(c.lastOrderAt) : 0;
  switch (seg) {
    case "vip": return c.orders >= 3 || c.spent >= 1000;
    case "recorrentes": return c.orders >= 2;
    case "novos": return c.orders === 1 && Date.now() - last < 60 * DAY;
    case "inativos": return Date.now() - last > 120 * DAY;
    default: return true;
  }
}

// Telefone brasileiro em formato só dígitos com 55
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith("55") || d.length < 12 || d.length > 13) return null;
  return d;
}
