"use server";
// Automações com blocos e listas de contatos.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";
import { addToList, automationEvent, newNodeId, parseCsv, TRIGGERS, type Flow } from "@/lib/automations";
import { PORT_KEYS, type Node } from "@/lib/flowTypes";

async function user() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const go = (id: string, q = "") => { revalidatePath("/automacoes"); revalidatePath(`/automacoes/${id}`); redirect(`/automacoes/${id}${q}`); };

export async function createAutomation(f: FormData) {
  await user();
  const trigger = str(f, "trigger");
  const t = TRIGGERS.find((x) => x.k === trigger);
  if (!t) redirect("/automacoes?novo=1");
  const send = newNodeId();
  const a = await db.automation.create({ data: { name: str(f, "name") || t!.label, trigger, config: { delayMin: trigger === "carrinho_abandonado" ? 30 : 0 }, flow: { start: send, startPos: { x: 60, y: 200 }, nodes: { [send]: { type: "send", parts: [{ text: "Olá {nome}, tudo bem?" }], typing: 5, timeout: 60, x: 380, y: 160 } } } } });
  go(a.id);
}

const TYPES = new Set(["send", "wait", "waitHour", "waitDate", "waitUntil", "cond", "multi", "random", "tag", "list", "chat", "goto", "notify", "webhook", "exit", "note"]);
const cleanRules = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 10).map((x: Record<string, unknown>) => ({ check: String(x.check ?? "pagou").slice(0, 30), value: s200(x.value, 200) || undefined }));
const num = (v: unknown, d: number, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const s200 = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : undefined);

// Limpa o que veio do editor antes de gravar (só campos conhecidos)
function clean(raw: unknown): Flow {
  const r = (raw ?? {}) as { start?: string; startPos?: { x: number; y: number }; nodes?: Record<string, Record<string, unknown>> };
  const nodes: Record<string, Node> = {};
  for (const [id, n] of Object.entries(r.nodes ?? {}).slice(0, 200)) {
    if (!/^[\w-]{1,24}$/.test(id) || !n || !TYPES.has(String(n.type))) continue;
    const o: Record<string, unknown> = { type: n.type, x: Math.round(num(n.x, 0, -20000, 20000)), y: Math.round(num(n.y, 0, -20000, 20000)) };
    if (s200(n.title, 80)) o.title = s200(n.title, 80);
    for (const k of PORT_KEYS) if (typeof n[k] === "string" && n[k]) o[k] = n[k];
    switch (n.type) {
      case "send":
        o.parts = (Array.isArray(n.parts) ? n.parts : []).slice(0, 8).map((p: Record<string, unknown>) => ({ text: s200(p.text) || undefined, mediaUrl: s200(p.mediaUrl, 500) || undefined, mediaType: s200(p.mediaType, 20) || undefined, fileName: s200(p.fileName, 120) || undefined, productImage: p.productImage ? true : undefined }));
        if (s200(n.messageId, 40)) o.messageId = s200(n.messageId, 40);
        if (!(o.parts as unknown[]).length) o.parts = [{ text: "" }];
        o.typing = num(n.typing, 5, 0, 30); o.timeout = num(n.timeout, 60, 1, 10080);
        if (n.utm && typeof n.utm === "object") { const u = n.utm as Record<string, unknown>; o.utm = { source: s200(u.source, 80), medium: s200(u.medium, 80), campaign: s200(u.campaign, 80) }; }
        break;
      case "wait": o.amount = num(n.amount, 1, 1, 999); o.unit = ["min", "h", "d"].includes(String(n.unit)) ? n.unit : "h"; break;
      case "waitHour": o.hour = /^\d{2}:\d{2}$/.test(String(n.hour)) ? n.hour : "10:00"; if (Array.isArray(n.days)) o.days = n.days.map(Number).filter((d) => d >= 0 && d <= 6); break;
      case "cond": {
        const rules = cleanRules(n.rules);
        o.rules = rules.length ? rules : [{ check: "pagou" }]; o.check = (o.rules as { check: string }[])[0].check; o.mode = n.mode === "any" ? "any" : "all"; break;
      }
      case "waitDate": o.at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(n.at)) ? n.at : ""; break;
      case "waitUntil": o.event = ["pagou", "respondeu", "clicou"].includes(String(n.event)) ? n.event : "pagou"; o.amount = num(n.amount, 1, 1, 999); o.unit = ["min", "h", "d"].includes(String(n.unit)) ? n.unit : "d"; break;
      case "multi": {
        const br = (Array.isArray(n.branches) ? n.branches : []).slice(0, 10).map((b: Record<string, unknown>) => ({ label: s200(b.label, 40) || undefined, rules: cleanRules(b.rules), mode: b.mode === "any" ? "any" : "all" }));
        o.branches = br.length ? br : [{ rules: [{ check: "pagou" }], mode: "all" }];
        break;
      }
      case "chat": o.action = ["transfer", "archive", "note", "ai_on", "ai_off"].includes(String(n.action)) ? n.action : "transfer"; o.assignee = s200(n.assignee, 60); o.text = s200(n.text, 1000); break;
      case "goto": o.automationId = s200(n.automationId, 40) ?? ""; break;
      case "notify": o.to = s200(n.to, 60) ?? ""; o.text = s200(n.text, 1500) ?? ""; break;
      case "webhook": o.url = /^https:\/\//.test(String(n.url ?? "")) ? s200(n.url, 500) : ""; break;
      case "random": o.pct = Math.round(num(n.pct, 50, 1, 99)); break;
      case "tag": o.action = n.action === "remove" ? "remove" : "add"; o.tag = (s200(n.tag, 60) ?? "").toLowerCase().trim(); break;
      case "list": o.action = n.action === "remove" ? "remove" : "add"; o.listId = s200(n.listId, 40) ?? ""; break;
      case "note": o.text = s200(n.text, 2000) ?? ""; o.color = s200(n.color, 20); break;
    }
    nodes[id] = o as Node;
  }
  // tira ligações para blocos que não existem
  for (const n of Object.values(nodes) as Record<string, unknown>[]) for (const k of PORT_KEYS) if (n[k] && !nodes[n[k] as string]) delete n[k];
  const start = r.start && nodes[r.start] ? r.start : undefined;
  return { start, startPos: { x: Math.round(num(r.startPos?.x, 60, -20000, 20000)), y: Math.round(num(r.startPos?.y, 200, -20000, 20000)) }, nodes };
}

// Salva tudo que foi feito no editor de blocos
export async function saveFlowAction(id: string, data: { flow: unknown; name: string; trigger: string; config: { delayMin?: number; listId?: string; stopOnPaid?: boolean } }) {
  await user();
  const a = await db.automation.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Automação não encontrada" };
  const trigger = TRIGGERS.some((t) => t.k === data.trigger) ? data.trigger : a.trigger;
  await db.automation.update({ where: { id }, data: { flow: clean(data.flow), name: (data.name || "").trim().slice(0, 80) || a.name, trigger, config: { ...((a.config ?? {}) as object), delayMin: num(data.config?.delayMin, 0, 0, 10080), listId: s200(data.config?.listId, 40) || undefined, stopOnPaid: !!data.config?.stopOnPaid } } });
  revalidatePath("/automacoes");
  revalidatePath(`/automacoes/${id}`);
  return { ok: true, at: new Date().toISOString() };
}

// Sobe a foto/vídeo/PDF de uma parte da mensagem
export async function uploadPartMedia(f: FormData) {
  await user();
  const file = f.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false as const };
  if (file.size > 32 * 1024 * 1024) return { ok: false as const, error: "Arquivo acima de 32 MB" };
  const up = await saveUpload(file);
  const audio = (file.type || "").startsWith("audio/") || /\.(mp3|ogg|webm|m4a|opus)$/i.test(file.name);
  return { ok: true as const, url: up.url, type: audio ? "audio" : up.type, fileName: file.name.slice(0, 120) };
}

export async function setAutomationActive(id: string, active: boolean) {
  await user();
  await db.automation.update({ where: { id }, data: { active } });
  revalidatePath("/automacoes");
  revalidatePath(`/automacoes/${id}`);
  return { ok: true };
}

export async function toggleAutomation(f: FormData) {
  await user();
  const a = await db.automation.findUnique({ where: { id: str(f, "id") } });
  if (a) await db.automation.update({ where: { id: a.id }, data: { active: !a.active } });
  revalidatePath("/automacoes");
  revalidatePath(`/automacoes/${str(f, "id")}`);
}

export async function deleteAutomation(f: FormData) {
  await user();
  await db.automation.delete({ where: { id: str(f, "id") } }).catch(() => null);
  revalidatePath("/automacoes");
  redirect("/automacoes");
}

export async function duplicateAutomation(f: FormData) {
  await user();
  const a = await db.automation.findUnique({ where: { id: str(f, "id") } });
  if (!a) redirect("/automacoes");
  const c = await db.automation.create({ data: { name: `${a!.name} (cópia)`, trigger: a!.trigger, config: a!.config ?? {}, flow: a!.flow ?? {}, active: false } });
  go(c.id);
}

/* Listas */

export async function createList(f: FormData) {
  await user();
  const l = await db.contactList.create({ data: { name: str(f, "name") || "Lista" } });
  revalidatePath("/listas");
  redirect(`/listas?id=${l.id}`);
}

export async function importList(f: FormData) {
  await user();
  const listId = str(f, "listId");
  const file = f.get("file");
  let rows: Record<string, string>[] = [];
  if (file instanceof File && file.size > 0) rows = parseCsv(await file.text());
  const pasted = str(f, "paste");
  if (pasted) rows = rows.concat(parseCsv(pasted.includes("\n") && /nome|telefone|whatsapp/i.test(pasted.split("\n")[0]) ? pasted : `nome,telefone\n${pasted}`));
  const added = rows.length ? await addToList(listId, rows) : 0;
  revalidatePath("/listas");
  redirect(`/listas?id=${listId}&importados=${added}&linhas=${rows.length}`);
}

export async function deleteList(f: FormData) {
  await user();
  await db.contactList.delete({ where: { id: str(f, "id") } }).catch(() => null);
  revalidatePath("/listas");
  redirect("/listas");
}

// Coloca todos da lista numa automação agora (ex.: disparo com sequência)
export async function listToAutomation(f: FormData) {
  await user();
  const listId = str(f, "listId"), automationId = str(f, "automationId");
  const a = await db.automation.findUnique({ where: { id: automationId } });
  const members = await db.listMember.findMany({ where: { listId } });
  let n = 0;
  if (a && (a.flow as Flow)?.start) {
    for (const m of members) {
      try {
        await db.automationRun.create({ data: { automationId, refId: `lista-${listId}-${m.phone}-${Date.now().toString(36)}`, phone: m.phone, name: m.name, ctx: { nome: m.name ?? "", ...((m.fields ?? {}) as Record<string, string>) }, nodeId: (a.flow as Flow).start, nextAt: new Date() } });
        n++;
      } catch {
        // já está
      }
    }
  }
  void automationEvent;
  revalidatePath("/listas");
  redirect(`/listas?id=${listId}&enviados=${n}${a && !a.active ? "&desligada=1" : ""}`);
}
