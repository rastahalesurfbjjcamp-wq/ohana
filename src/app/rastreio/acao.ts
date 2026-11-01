"use server";
// Consulta pública do pedido: precisa do número e do e-mail ou WhatsApp do pedido.
import { ordersBetween, recentOrders, shipments, type Order } from "@/lib/store";

const SHIP: Record<string, string> = { DELIVERED: "Entregue", IN_TRANSIT: "Em trânsito", OUT_FOR_DELIVERY: "Saiu para entrega", FULFILLED: "Postado", CONFIRMED: "Postado", ATTEMPTED_DELIVERY: "Tentativa de entrega", READY_FOR_PICKUP: "Aguardando retirada", FAILURE: "Problema na entrega", LABEL_PRINTED: "Etiqueta emitida" };
const EVENT: Record<string, string> = { IN_TRANSIT: "Objeto em trânsito", OUT_FOR_DELIVERY: "Saiu para entrega ao destinatário", DELIVERED: "Entregue ao destinatário", ATTEMPTED_DELIVERY: "Tentativa de entrega sem sucesso", READY_FOR_PICKUP: "Aguardando retirada", CONFIRMED: "Postado", FAILURE: "Problema na entrega", LABEL_PRINTED: "Etiqueta emitida" };

export type Track = {
  ok: true; order: string; first: string; createdAt: string; paid: boolean; cancelled: boolean;
  items: { title: string; variant: string; qty: number }[]; image: string | null;
  stage: number; status: string; company: string | null; number: string | null; url: string | null;
  events: { label: string; message: string | null; at: string }[]; statusUrl: string | null;
};
export type TrackResult = Track | { ok: false; error: string } | null;

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export async function lookup(_: TrackResult, f: FormData): Promise<TrackResult> {
  const num = digits(String(f.get("pedido") ?? ""));
  const who = String(f.get("contato") ?? "").trim().toLowerCase();
  if (!num || who.length < 4) return { ok: false, error: "Preencha o número do pedido e o e-mail ou WhatsApp usado na compra." };
  let list: Order[] = await recentOrders(10, `name:${num}`).catch(() => []);
  let o = list.find((x) => digits(x.name) === num);
  if (!o && process.env.DEMO_MODE === "1") { list = await ordersBetween(new Date(Date.now() - 60 * 864e5), new Date()).catch(() => []); o = list.find((x) => digits(x.name) === num); }
  const match = o && (who.includes("@") ? (o.email ?? "").toLowerCase() === who : digits(who).length >= 8 && digits(o.phone).endsWith(digits(who).slice(-8)));
  if (!o || !match) return { ok: false, error: "Não encontramos esse pedido com esses dados. Confira o número e o contato usado na compra." };
  const sh = o.tracking ? (await shipments(120).catch(() => [])).find((s) => s.order === o!.name) : undefined;
  const st = sh?.status ?? o.shipStatus ?? (o.tracking ? "FULFILLED" : null);
  const paid = o.financial === "PAID" || o.financial === "PARTIALLY_REFUNDED";
  const stage = o.cancelled ? 0 : st === "DELIVERED" ? 4 : st && st !== "LABEL_PRINTED" ? 3 : paid ? 2 : 1;
  const events = (sh?.events ?? (sh?.lastEvent ? [sh.lastEvent] : []))
    .slice().sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((e) => ({ label: EVENT[e.status] ?? SHIP[e.status] ?? e.status, message: e.message, at: e.at }));
  return {
    ok: true, order: o.name, first: (o.customer || "").split(" ")[0], createdAt: o.createdAt, paid, cancelled: o.cancelled,
    items: o.lines.map((l) => ({ title: l.title, variant: l.variant, qty: l.quantity })), image: o.images[0] ?? null,
    stage, status: o.cancelled ? "Pedido cancelado" : st ? SHIP[st] ?? "Enviado" : paid ? "Preparando o envio" : "Aguardando pagamento",
    company: o.tracking?.company ?? sh?.company ?? null, number: o.tracking?.number ?? sh?.number ?? null, url: o.tracking?.url ?? sh?.url ?? null,
    events, statusUrl: o.statusUrl,
  };
}
