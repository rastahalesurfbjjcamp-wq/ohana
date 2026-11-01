"use server";
// Biblioteca de mensagens, modelos prontos de automação e testes no grupo interno.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { mainPath, type Flow, type Node, type Part } from "@/lib/flowTypes";
import { FLOW_TEMPLATES, buildFlow } from "@/lib/flowTemplates";
import { orderCtx, partsOf, sendParts, type Ctx } from "@/lib/automations";
import { ordersBetween } from "@/lib/store";

async function user() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
const KINDS = new Set(["nenhum", "pedido", "carrinho", "rastreio", "resposta"]);
const cut = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

function cleanParts(raw: unknown): Part[] {
  const parts = (Array.isArray(raw) ? raw : []).slice(0, 8).map((p: Record<string, unknown>) => ({
    text: cut(p.text, 4000) || undefined,
    mediaUrl: cut(p.mediaUrl, 500) || undefined,
    mediaType: ["image", "video", "document", "audio"].includes(String(p.mediaType)) ? String(p.mediaType) : undefined,
    fileName: cut(p.fileName, 120) || undefined,
    productImage: p.productImage ? true : undefined,
  }));
  return parts.filter((p) => p.text || p.mediaUrl || p.productImage);
}

/* ---------- Biblioteca ---------- */

export async function saveTemplate(data: { id?: string; name: string; folder?: string; kind?: string; parts: unknown }) {
  await user();
  const parts = cleanParts(data.parts);
  const row = { name: (data.name || "").trim().slice(0, 80) || "Sem nome", folder: (data.folder || "").trim().slice(0, 60), kind: KINDS.has(String(data.kind)) ? String(data.kind) : "nenhum", parts };
  const t = data.id ? await db.messageTemplate.update({ where: { id: data.id }, data: row }) : await db.messageTemplate.create({ data: row });
  revalidatePath("/mensagens");
  return { ok: true, id: t.id };
}

export async function deleteTemplate(f: FormData) {
  await user();
  const id = String(f.get("id") ?? "");
  await db.messageTemplate.delete({ where: { id } }).catch(() => null);
  revalidatePath("/mensagens");
  const folder = String(f.get("folder") ?? "");
  redirect(folder ? `/mensagens?pasta=${encodeURIComponent(folder)}` : "/mensagens");
}

export async function duplicateTemplate(f: FormData) {
  await user();
  const t = await db.messageTemplate.findUnique({ where: { id: String(f.get("id") ?? "") } });
  if (!t) redirect("/mensagens");
  const c = await db.messageTemplate.create({ data: { name: `${t!.name} (cópia)`, folder: t!.folder, kind: t!.kind, parts: t!.parts ?? [] } });
  redirect(`/mensagens/${c.id}`);
}

export async function moveTemplate(f: FormData) {
  await user();
  const id = String(f.get("id") ?? "");
  const folder = String(f.get("folder") ?? "").trim().slice(0, 60);
  await db.messageTemplate.update({ where: { id }, data: { folder } }).catch(() => null);
  revalidatePath("/mensagens");
}

export async function renameFolder(f: FormData) {
  await user();
  const from = String(f.get("from") ?? "");
  const to = String(f.get("to") ?? "").trim().slice(0, 60);
  if (from) await db.messageTemplate.updateMany({ where: { folder: from }, data: { folder: to } });
  revalidatePath("/mensagens");
  redirect(to ? `/mensagens?pasta=${encodeURIComponent(to)}` : "/mensagens");
}

export async function importTemplates(f: FormData) {
  await user();
  const file = f.get("file");
  let n = 0;
  if (file instanceof File && file.size > 0 && file.size < 2_000_000) {
    try {
      const arr = JSON.parse(await file.text()) as { name?: string; folder?: string; kind?: string; parts?: unknown }[];
      for (const x of (Array.isArray(arr) ? arr : []).slice(0, 300)) {
        const parts = cleanParts(x.parts);
        if (!parts.length) continue;
        await db.messageTemplate.create({ data: { name: cut(x.name, 80) || "Importada", folder: cut(x.folder, 60), kind: KINDS.has(String(x.kind)) ? String(x.kind) : "nenhum", parts } });
        n++;
      }
    } catch {
      // arquivo inválido
    }
  }
  revalidatePath("/mensagens");
  redirect(`/mensagens?importadas=${n}`);
}

/* ---------- Testes no grupo interno ---------- */

async function testTarget() {
  const g = await db.group.findFirst({ where: { name: { contains: "teste", mode: "insensitive" } }, orderBy: { name: "asc" } });
  return g ? { jid: g.jid, name: g.name } : null;
}
async function sampleCtx(): Promise<Ctx> {
  const orders = await ordersBetween(new Date(Date.now() - 10 * 864e5), new Date()).catch(() => []);
  const o = orders.find((x) => x.tracking) ?? orders[0];
  if (o) return { ...orderCtx(o), link: o.statusUrl ?? "https://rastahale.com.br" };
  return { nome: "Leonardo Teste", nome_completo: "Leonardo Teste", pedido: "#0000", produtos: "Rashguard Hawaii 808", produtos_variante: "Rashguard Hawaii 808 (G)", valor: "R$ 199,90", link: "https://rastahale.com.br", rastreio: "AA000000000BR" };
}

export async function testTemplate(id: string) {
  await user();
  const target = await testTarget();
  if (!target) return { ok: false, error: "Não achei o grupo de teste (um grupo com \"Teste\" no nome)." };
  const t = await db.messageTemplate.findUnique({ where: { id } });
  if (!t) return { ok: false, error: "Mensagem não encontrada" };
  try {
    await sendParts(target.jid, (t.parts ?? []) as Part[], await sampleCtx(), { typing: 1 });
    return { ok: true, msg: `Enviada no grupo ${target.name}` };
  } catch (e) {
    return { ok: false, error: String(e).replace(/^Error: /, "").slice(0, 160) };
  }
}

// Manda as mensagens do caminho principal da automação no grupo de teste, sem esperar os tempos
export async function testAutomation(id: string) {
  await user();
  const target = await testTarget();
  if (!target) return { ok: false, error: "Não achei o grupo de teste (um grupo com \"Teste\" no nome)." };
  const a = await db.automation.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Automação não encontrada" };
  const flow = (a.flow ?? {}) as Flow;
  const ctx = await sampleCtx();
  const sends = mainPath(flow).map((k) => flow.nodes[k]).filter((n): n is Extract<Node, { type: "send" }> => n.type === "send").slice(0, 6);
  if (!sends.length) return { ok: false, error: "Esta automação ainda não tem mensagem no caminho principal." };
  try {
    const { sendText } = await import("@/lib/send");
    await sendText(target.jid, `Teste da automação "${a.name}" (${sends.length} mensage${sends.length > 1 ? "ns" : "m"}, sem esperar os tempos)`);
    for (const n of sends) await sendParts(target.jid, await partsOf(n), ctx, { typing: 1 });
    return { ok: true, msg: `${sends.length} mensage${sends.length > 1 ? "ns enviadas" : "m enviada"} no grupo ${target.name}` };
  } catch (e) {
    return { ok: false, error: String(e).replace(/^Error: /, "").slice(0, 160) };
  }
}

/* ---------- Modelos prontos de automação ---------- */

async function fromTemplate(key: string) {
  const t = FLOW_TEMPLATES.find((x) => x.key === key);
  if (!t) return null;
  const ids: Record<string, string> = {};
  for (const m of t.msgs) {
    const row = await db.messageTemplate.create({ data: { name: m.name, folder: `Automação: ${t.name}`, kind: m.kind, parts: m.parts } });
    ids[m.key] = row.id;
  }
  return db.automation.create({ data: { name: t.name, trigger: t.trigger, config: t.config, flow: buildFlow(t, ids), active: false } });
}

export async function applyFlowTemplate(f: FormData) {
  await user();
  const a = await fromTemplate(String(f.get("key") ?? ""));
  revalidatePath("/automacoes");
  redirect(a ? `/automacoes/${a.id}` : "/automacoes");
}

export async function addSuggestions(f: FormData) {
  await user();
  const keys = f.getAll("key").map(String).slice(0, 12);
  for (const k of keys) await fromTemplate(k);
  revalidatePath("/automacoes");
  redirect(`/automacoes?adicionadas=${keys.length}`);
}
