"use server";
// Automações com blocos e listas de contatos.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";
import { addToList, automationEvent, newNodeId, parseCsv, TRIGGERS, type Flow, type Node, type Part } from "@/lib/automations";

async function user() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const go = (id: string, q = "") => { revalidatePath("/automacoes"); revalidatePath(`/automacoes/${id}`); redirect(`/automacoes/${id}${q}`); };

async function load(id: string) {
  const a = await db.automation.findUnique({ where: { id } });
  if (!a) redirect("/automacoes");
  const fl = (a!.flow ?? {}) as Partial<Flow>;
  return { a: a!, flow: { start: fl.start, nodes: fl.nodes ?? {} } as Flow };
}
async function saveFlow(id: string, flow: Flow) {
  await db.automation.update({ where: { id }, data: { flow } });
}

export async function createAutomation(f: FormData) {
  await user();
  const trigger = str(f, "trigger");
  const t = TRIGGERS.find((x) => x.k === trigger);
  if (!t) redirect("/automacoes?novo=1");
  const send = newNodeId();
  const a = await db.automation.create({ data: { name: str(f, "name") || t!.label, trigger, config: { delayMin: trigger === "carrinho_abandonado" ? 30 : 0 }, flow: { start: send, nodes: { [send]: { type: "send", parts: [{ text: "Olá {nome}, tudo bem?" }] } } } } });
  go(a.id, `?node=${send}`);
}

const DEFAULT: Record<string, Node> = {
  send: { type: "send", parts: [{ text: "" }] },
  wait: { type: "wait", amount: 1, unit: "h" },
  waitHour: { type: "waitHour", hour: "10:00" },
  cond: { type: "cond", check: "pagou" },
  tag: { type: "tag", action: "add", tag: "" },
  list: { type: "list", action: "add", listId: "" },
  exit: { type: "exit" },
};
const nextOf = (n: Node) => (n.type === "cond" ? n.yes ?? n.no : n.type === "exit" ? undefined : n.next);

// Coloca um bloco novo no ponto clicado (entre o bloco de cima e o que já estava ali)
export async function addNode(f: FormData) {
  await user();
  const id = str(f, "id"), parent = str(f, "parent"), port = str(f, "port"), type = str(f, "type");
  const { flow } = await load(id);
  const nid = newNodeId();
  const node = structuredClone(DEFAULT[type] ?? DEFAULT.send) as Node;
  let old: string | undefined;
  if (parent === "start") { old = flow.start; flow.start = nid; }
  else {
    const p = flow.nodes[parent] as Record<string, unknown> | undefined;
    if (!p) go(id);
    old = p![port] as string | undefined;
    p![port] = nid;
  }
  if (old) { if (node.type === "cond") node.yes = old; else if (node.type !== "exit") (node as { next?: string }).next = old; }
  flow.nodes[nid] = node;
  await saveFlow(id, flow);
  go(id, `?node=${nid}`);
}

export async function deleteNode(f: FormData) {
  await user();
  const id = str(f, "id"), nid = str(f, "node");
  const { flow } = await load(id);
  const n = flow.nodes[nid];
  if (!n) go(id);
  const repl = nextOf(n!);
  if (flow.start === nid) flow.start = repl;
  for (const x of Object.values(flow.nodes) as Record<string, unknown>[]) for (const k of ["next", "yes", "no"]) if (x[k] === nid) x[k] = repl;
  delete flow.nodes[nid];
  // tira blocos que ficaram soltos
  const seen = new Set<string>();
  const walk = (k?: string) => { if (!k || seen.has(k) || !flow.nodes[k]) return; seen.add(k); const x = flow.nodes[k] as Record<string, string>; walk(x.next); walk(x.yes); walk(x.no); };
  walk(flow.start);
  for (const k of Object.keys(flow.nodes)) if (!seen.has(k)) delete flow.nodes[k];
  await saveFlow(id, flow);
  go(id);
}

export async function saveNode(f: FormData) {
  await user();
  const id = str(f, "id"), nid = str(f, "node");
  const { flow } = await load(id);
  const n = flow.nodes[nid];
  if (!n) go(id);
  if (n!.type === "send") {
    const count = Math.min(6, Math.max(1, Number(str(f, "n")) || 1));
    const parts: Part[] = [];
    for (let i = 0; i < count; i++) {
      const text = str(f, `text_${i}`);
      const productImage = f.get(`img_${i}`) === "on";
      const file = f.get(`file_${i}`);
      let mediaUrl = f.get(`keep_${i}`) === "1" ? n!.parts[i]?.mediaUrl : undefined;
      let mediaType = f.get(`keep_${i}`) === "1" ? n!.parts[i]?.mediaType : undefined;
      if (file instanceof File && file.size > 0) { const up = await saveUpload(file); mediaUrl = up.url; mediaType = up.type; }
      if (text || productImage || mediaUrl) parts.push({ text: text || undefined, productImage: productImage || undefined, mediaUrl, mediaType });
    }
    n!.parts = parts.length ? parts : [{ text: "" }];
  }
  if (n!.type === "wait") { n!.amount = Math.max(1, Number(str(f, "amount")) || 1); n!.unit = (["min", "h", "d"].includes(str(f, "unit")) ? str(f, "unit") : "h") as "min" | "h" | "d"; }
  if (n!.type === "waitHour") n!.hour = /^\d{2}:\d{2}$/.test(str(f, "hour")) ? str(f, "hour") : "10:00";
  if (n!.type === "cond") { n!.check = (["pagou", "respondeu", "clicou", "etiqueta", "lista"].includes(str(f, "check")) ? str(f, "check") : "pagou") as typeof n.check; n!.value = (n!.check === "lista" ? str(f, "value_list") : n!.check === "etiqueta" ? str(f, "value_tag").toLowerCase() : "") || undefined; }
  if (n!.type === "tag") { n!.action = str(f, "action") === "remove" ? "remove" : "add"; n!.tag = str(f, "tag").toLowerCase(); }
  if (n!.type === "list") { n!.action = str(f, "action") === "remove" ? "remove" : "add"; n!.listId = str(f, "listId"); }
  await saveFlow(id, flow);
  go(id, `?node=${nid}&salvo=1`);
}

export async function saveAutomation(f: FormData) {
  await user();
  const id = str(f, "id");
  const { a } = await load(id);
  const trigger = TRIGGERS.some((t) => t.k === str(f, "trigger")) ? str(f, "trigger") : a.trigger;
  await db.automation.update({ where: { id }, data: { name: str(f, "name") || a.name, trigger, config: { delayMin: Math.max(0, Number(str(f, "delayMin")) || 0), listId: str(f, "listId") || undefined } } });
  go(id, "?salvo=1");
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
