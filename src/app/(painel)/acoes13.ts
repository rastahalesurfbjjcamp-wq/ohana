"use server";
// Status próprio dos pedidos, responsável, bandeira e arquivo.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_STATUSES, type OrderStatus } from "@/lib/orderMeta";

async function user() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function setOrderMeta(refId: string, data: { status?: string | null; assignee?: string | null; flagged?: boolean; archived?: boolean; note?: string | null; kind?: string }) {
  await user();
  const row = {
    ...(data.status !== undefined ? { status: data.status || null } : {}),
    ...(data.assignee !== undefined ? { assignee: data.assignee || null } : {}),
    ...(data.flagged !== undefined ? { flagged: data.flagged } : {}),
    ...(data.archived !== undefined ? { archived: data.archived } : {}),
    ...(data.note !== undefined ? { note: data.note?.slice(0, 500) || null } : {}),
  };
  await db.orderMeta.upsert({ where: { refId }, create: { refId, kind: data.kind === "carrinho" ? "carrinho" : "pedido", ...row }, update: row });
  revalidatePath("/pedidos");
  return { ok: true };
}

export async function saveStatuses(list: OrderStatus[]) {
  await user();
  const clean = list.slice(0, 15).map((s, i) => ({ id: (s.id || `s${Date.now().toString(36)}${i}`).slice(0, 20), label: (s.label || "Status").slice(0, 30), color: /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#7d8781" }));
  await db.setting.upsert({ where: { key: "_order_statuses" }, create: { key: "_order_statuses", value: clean.length ? clean : DEFAULT_STATUSES }, update: { value: clean.length ? clean : DEFAULT_STATUSES } });
  revalidatePath("/pedidos");
  return { ok: true };
}

/* ---------- Atendimento: etiquetas, listas, notas e mensagens agendadas ---------- */

const back = (phone: string) => { revalidatePath("/atendimento"); redirect(`/atendimento?p=${phone}`); };

export async function chatTag(f: FormData) {
  await user();
  const phone = String(f.get("phone") ?? "");
  const tag = String(f.get("tag") ?? "").trim().toLowerCase().slice(0, 40);
  const act = String(f.get("act") ?? "add");
  if (phone && tag) {
    if (act === "remove") await db.contactTag.deleteMany({ where: { phone, tag } });
    else await db.contactTag.upsert({ where: { phone_tag: { phone, tag } }, create: { phone, tag }, update: {} });
  }
  back(phone);
}

export async function chatList(f: FormData) {
  await user();
  const phone = String(f.get("phone") ?? "");
  const listId = String(f.get("listId") ?? "");
  const act = String(f.get("act") ?? "add");
  const name = String(f.get("name") ?? "") || null;
  if (phone && listId) {
    if (act === "remove") await db.listMember.deleteMany({ where: { listId, phone } });
    else {
      const { addToList } = await import("@/lib/automations");
      await addToList(listId, [{ telefone: phone, nome: name ?? "" }]);
    }
  }
  back(phone);
}

export async function chatNote(f: FormData) {
  const s = await user();
  const phone = String(f.get("phone") ?? "");
  const text = String(f.get("text") ?? "").trim().slice(0, 2000);
  if (phone && text) {
    await db.chatThread.upsert({ where: { phone }, create: { phone }, update: {} });
    await db.chatMessage.create({ data: { phone, fromMe: true, by: "nota", text: `${s.name}: ${text}` } });
  }
  back(phone);
}

export async function chatSchedule(f: FormData) {
  const s = await user();
  const phone = String(f.get("phone") ?? "");
  const text = String(f.get("text") ?? "").trim().slice(0, 4000);
  const at = String(f.get("at") ?? "");
  if (phone && text && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) {
    await db.chatSchedule.create({ data: { phone, text, at: new Date(`${at}:00-03:00`), cancelOnReply: f.get("cReply") === "on", cancelOnAgent: f.get("cAgent") === "on", cancelOnArchive: f.get("cArchive") === "on", by: s.name } });
  }
  back(phone);
}

export async function chatScheduleCancel(f: FormData) {
  await user();
  const id = String(f.get("id") ?? "");
  const row = await db.chatSchedule.update({ where: { id }, data: { status: "cancelada", note: "cancelada à mão" } }).catch(() => null);
  back(row?.phone ?? "");
}
