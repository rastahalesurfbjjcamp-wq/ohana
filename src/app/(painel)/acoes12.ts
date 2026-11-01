"use server";
// Listas por regra, matriz RFM e campanhas de WhatsApp (lista + mensagem + data).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { FIELDS, RFM_SEGMENTS, contacts, matches, refreshList, rfmLabel, type ARule } from "@/lib/audience";
import type { Flow } from "@/lib/flowTypes";

async function user() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function cleanRules(raw: unknown): ARule[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 12).filter((r: Record<string, unknown>) => FIELDS.some((x) => x.k === r.field)).map((r: Record<string, unknown>) => ({ field: String(r.field), op: String(r.op ?? "eq").slice(0, 10), value: typeof r.value === "string" ? r.value.slice(0, 80) : undefined }));
}

/* ---------- Listas por regra ---------- */

export async function previewRules(rules: unknown, mode: string) {
  await user();
  const rs = cleanRules(rules);
  const all = await contacts();
  const hit = all.filter((c) => matches(c, rs, mode === "any" ? "any" : "all"));
  return { total: hit.length, sample: hit.sort((a, b) => b.spent - a.spent).slice(0, 6).map((c) => ({ name: c.name || c.phone, spent: c.spent, rfm: c.rfm ? rfmLabel(c.rfm) : "" })) };
}

export async function saveListRules(listId: string, rules: unknown, mode: string) {
  await user();
  await db.contactList.update({ where: { id: listId }, data: { dynamic: true, rules: cleanRules(rules), mode: mode === "any" ? "any" : "all" } });
  const r = await refreshList(listId);
  revalidatePath("/listas");
  return { ok: true, ...r };
}

export async function createDynamicList(f: FormData) {
  await user();
  const l = await db.contactList.create({ data: { name: str(f, "name") || "Lista por regras", dynamic: true, rules: [{ field: "orders", op: "gte", value: "2" }], mode: "all" } });
  await refreshList(l.id);
  revalidatePath("/listas");
  redirect(`/listas?id=${l.id}`);
}

async function rfmList(seg: string) {
  const name = `RFM: ${rfmLabel(seg)}`;
  const found = await db.contactList.findFirst({ where: { name, dynamic: true } });
  const l = found ?? (await db.contactList.create({ data: { name, dynamic: true, rules: [{ field: "rfm", op: "eq", value: seg }], mode: "all" } }));
  await refreshList(l.id);
  return l;
}

export async function createRfmList(f: FormData) {
  await user();
  const seg = str(f, "seg");
  if (!RFM_SEGMENTS.some((s) => s.k === seg)) redirect("/clientes");
  const l = await rfmList(seg);
  revalidatePath("/listas");
  redirect(`/listas?id=${l.id}`);
}

export async function refreshListNow(f: FormData) {
  await user();
  const id = str(f, "id");
  const r = await refreshList(id);
  revalidatePath("/listas");
  redirect(`/listas?id=${id}&atualizada=${r.total}`);
}

/* ---------- Campanhas ---------- */

export type CampaignCfg = { campaign: true; listId?: string; at?: string; state: "rascunho" | "agendada" | "enviando" | "pausada" | "enviada" | "cancelada"; startedAt?: string; total?: number };

export async function createCampaign(f: FormData) {
  await user();
  const name = str(f, "name") || "Campanha";
  let listId = str(f, "listId");
  const rfm = str(f, "rfm");
  if (!listId && rfm) listId = (await rfmList(rfm)).id;
  const messageId = str(f, "messageId");
  const flow: Flow = messageId
    ? { start: "s1", startPos: { x: 20, y: 200 }, nodes: { s1: { type: "send", messageId, parts: [], typing: 4, timeout: 60, x: 340, y: 160, next: "x1" }, x1: { type: "exit", x: 700, y: 300 } } }
    : { start: "s1", startPos: { x: 20, y: 200 }, nodes: { s1: { type: "send", parts: [{ text: "Oi {nome}, tudo bem?" }], typing: 4, timeout: 60, x: 340, y: 160, next: "x1" }, x1: { type: "exit", x: 700, y: 300 } } };
  const at = str(f, "at");
  const cfg: CampaignCfg = { campaign: true, listId: listId || undefined, at: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at) ? at : undefined, state: "rascunho" };
  const a = await db.automation.create({ data: { name, trigger: "manual", config: cfg, flow, active: false } });
  revalidatePath("/campanhas-whatsapp");
  redirect(`/campanhas-whatsapp/${a.id}`);
}

async function getCampaign(id: string) {
  const a = await db.automation.findUnique({ where: { id } });
  if (!a || !(a.config as CampaignCfg | null)?.campaign) redirect("/campanhas-whatsapp");
  return { a: a!, cfg: a!.config as CampaignCfg };
}
async function setCfg(id: string, cfg: CampaignCfg, active?: boolean) {
  await db.automation.update({ where: { id }, data: { config: cfg, ...(active === undefined ? {} : { active }) } });
  revalidatePath("/campanhas-whatsapp");
  revalidatePath(`/campanhas-whatsapp/${id}`);
}

export async function updateCampaign(f: FormData) {
  await user();
  const id = str(f, "id");
  const { a, cfg } = await getCampaign(id);
  if (cfg.state !== "rascunho" && cfg.state !== "agendada") redirect(`/campanhas-whatsapp/${id}`);
  const at = str(f, "at");
  let listId = str(f, "listId");
  const rfm = str(f, "rfm");
  if (!listId && rfm) listId = (await rfmList(rfm)).id;
  await db.automation.update({ where: { id }, data: { name: str(f, "name") || a.name } });
  await setCfg(id, { ...cfg, listId: listId || cfg.listId, at: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at) ? at : cfg.at });
  redirect(`/campanhas-whatsapp/${id}?salvo=1`);
}

// Agendar (ou mandar agora): o worker coloca a lista inteira na sequência na hora marcada
export async function scheduleCampaign(f: FormData) {
  await user();
  const id = str(f, "id");
  const now = str(f, "now") === "1";
  const { a, cfg } = await getCampaign(id);
  if (!cfg.listId) redirect(`/campanhas-whatsapp/${id}?erro=publico`);
  const flow = (a.flow ?? {}) as Flow;
  if (!flow.start) redirect(`/campanhas-whatsapp/${id}?erro=mensagem`);
  const at = now ? new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 16) : cfg.at;
  if (!at) redirect(`/campanhas-whatsapp/${id}?erro=data`);
  await setCfg(id, { ...cfg, at, state: "agendada" });
  redirect(`/campanhas-whatsapp/${id}?agendada=1`);
}

export async function pauseCampaign(f: FormData) {
  await user();
  const id = str(f, "id");
  const { cfg } = await getCampaign(id);
  if (cfg.state === "agendada") await setCfg(id, { ...cfg, state: "rascunho" }, false);
  else if (cfg.state === "enviando") await setCfg(id, { ...cfg, state: "pausada" }, false);
  redirect(`/campanhas-whatsapp/${id}`);
}

export async function resumeCampaign(f: FormData) {
  await user();
  const id = str(f, "id");
  const { cfg } = await getCampaign(id);
  if (cfg.state === "pausada") await setCfg(id, { ...cfg, state: "enviando" }, true);
  redirect(`/campanhas-whatsapp/${id}`);
}

export async function cancelCampaign(f: FormData) {
  await user();
  const id = str(f, "id");
  const { cfg } = await getCampaign(id);
  await db.automationRun.updateMany({ where: { automationId: id, status: "ativo" }, data: { status: "fim", nextAt: null } });
  await setCfg(id, { ...cfg, state: "cancelada" }, false);
  redirect(`/campanhas-whatsapp/${id}`);
}

export async function deleteCampaign(f: FormData) {
  await user();
  const id = str(f, "id");
  const { cfg } = await getCampaign(id);
  if (cfg.state === "enviando") redirect(`/campanhas-whatsapp/${id}`);
  await db.automationRun.deleteMany({ where: { automationId: id } });
  await db.automation.delete({ where: { id } }).catch(() => null);
  revalidatePath("/campanhas-whatsapp");
  redirect("/campanhas-whatsapp");
}

export async function duplicateCampaign(f: FormData) {
  await user();
  const { a, cfg } = await getCampaign(str(f, "id"));
  const c = await db.automation.create({ data: { name: `${a.name} (cópia)`, trigger: "manual", config: { campaign: true, listId: cfg.listId, state: "rascunho" }, flow: a.flow ?? {}, active: false } });
  redirect(`/campanhas-whatsapp/${c.id}`);
}
