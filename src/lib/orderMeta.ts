// Status próprios dos pedidos (quadro tipo kanban) e leitura do controle interno
import { db } from "./db";

export type OrderStatus = { id: string; label: string; color: string };
export const DEFAULT_STATUSES: OrderStatus[] = [
  { id: "novo", label: "Novo", color: "#60a5fa" },
  { id: "separando", label: "Separando", color: "#f7c928" },
  { id: "embalado", label: "Embalado", color: "#a78bfa" },
  { id: "enviado", label: "Enviado", color: "#34c26a" },
  { id: "problema", label: "Problema", color: "#ef4444" },
  { id: "troca", label: "Troca", color: "#fb8c00" },
];

export async function orderStatuses(): Promise<OrderStatus[]> {
  const s = await db.setting.findUnique({ where: { key: "_order_statuses" } }).catch(() => null);
  const v = s?.value as OrderStatus[] | undefined;
  return Array.isArray(v) && v.length ? v : DEFAULT_STATUSES;
}

export async function metaFor(ids: string[]) {
  if (!ids.length) return new Map<string, { status: string | null; assignee: string | null; flagged: boolean; archived: boolean; note: string | null }>();
  const rows = await db.orderMeta.findMany({ where: { refId: { in: ids } } });
  return new Map(rows.map((r) => [r.refId, r]));
}
