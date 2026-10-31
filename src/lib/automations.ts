// Automações: gatilho -> blocos (enviar WhatsApp, aguardar, condição, etiqueta, lista, sair).
// O worker roda os passos que chegaram na hora; nada sai com a automação desligada.
import { db } from "./db";
import { env } from "./env";
import { reserveSlot, sendMedia, sendText } from "./send";
import { normalizePhone } from "./segments";
import { ordersBetween } from "./store";
import { isoDayLocal } from "./time";

export type Part = { text?: string; mediaUrl?: string; mediaType?: string; productImage?: boolean };
export type Node =
  | { type: "send"; parts: Part[]; next?: string }
  | { type: "wait"; amount: number; unit: "min" | "h" | "d"; next?: string }
  | { type: "waitHour"; hour: string; next?: string }
  | { type: "cond"; check: "pagou" | "respondeu" | "clicou" | "etiqueta" | "lista"; value?: string; yes?: string; no?: string }
  | { type: "tag"; action: "add" | "remove"; tag: string; next?: string }
  | { type: "list"; action: "add" | "remove"; listId: string; next?: string }
  | { type: "exit" };
export type Flow = { start?: string; nodes: Record<string, Node> };
export type Ctx = Record<string, string>;

export const TRIGGERS: { k: string; group: string; label: string; desc: string }[] = [
  { k: "pedido_criado", group: "Pedido", label: "Pedido criado", desc: "Quando entra um pedido novo" },
  { k: "pedido_pix", group: "Pedido", label: "Pedido criado (Pix)", desc: "Pedido com Pix gerado e ainda não pago" },
  { k: "pedido_boleto", group: "Pedido", label: "Pedido criado (Boleto)", desc: "Pedido com boleto gerado e ainda não pago" },
  { k: "pedido_pago", group: "Pedido", label: "Pedido pago", desc: "Quando o pagamento é aprovado" },
  { k: "primeira_compra", group: "Pedido", label: "Primeira compra", desc: "Primeiro pedido pago do cliente" },
  { k: "pedido_entregue", group: "Pedido", label: "Pedido entregue", desc: "Quando a transportadora marca como entregue" },
  { k: "carrinho_abandonado", group: "Carrinho abandonado", label: "Carrinho abandonado criado", desc: "Quando alguém sai do checkout sem pagar" },
  { k: "rastreio_criado", group: "Número de rastreio", label: "Número de rastreio criado", desc: "Quando o pedido ganha rastreio" },
  { k: "lead_novo", group: "Lead", label: "Lead inserido", desc: "Quem preenche o formulário do Grupo VIP" },
  { k: "lista", group: "Lead", label: "Adicionado à lista", desc: "Quem entra numa lista (planilha, API ou bloco)" },
  { k: "entrou_grupo", group: "Comunidade", label: "Entrou no grupo", desc: "Entrou num grupo da comunidade" },
  { k: "saiu_grupo", group: "Comunidade", label: "Saiu do grupo", desc: "Saiu de um grupo da comunidade" },
  { k: "assinou_club", group: "Club", label: "Assinou o club", desc: "Pagamento da assinatura confirmado" },
];
export const triggerLabel = (k: string) => TRIGGERS.find((t) => t.k === k)?.label ?? k;
export const VARS = ["{nome}", "{produtos}", "{valor}", "{link}", "{pedido}", "{rastreio}", "{loja}"];

const rid = () => Math.random().toString(36).slice(2, 9);
export const newNodeId = rid;
const base = () => env.appUrl().replace(/\/$/, "");

// Troca {campo} pelos dados do contato; links viram link rastreado para contar clique
function fill(text: string, ctx: Ctx, runId?: string, links?: string[]) {
  let t = text.replace(/\{(\w+)\}/g, (_, k: string) => (k === "nome" ? (ctx.nome ?? "").split(" ")[0] || "tudo bem" : k === "loja" ? env.storeName() : ctx[k] ?? ""));
  if (runId && links) t = t.replace(/https?:\/\/[^\s]+/g, (u) => { links.push(u); return `${base()}/a/${runId}/${links.length - 1}`; });
  return t.trim();
}

/* ---------- Entrada na automação ---------- */

export async function automationEvent(trigger: string, refId: string, phoneRaw: string | null | undefined, ctx: Ctx = {}, opts: { listId?: string } = {}) {
  const phone = normalizePhone(phoneRaw ?? "");
  if (!phone) return 0;
  const list = await db.automation.findMany({ where: { trigger, active: true } });
  let n = 0;
  for (const a of list) {
    const cfg = (a.config ?? {}) as { delayMin?: number; listId?: string };
    if (trigger === "lista" && cfg.listId && cfg.listId !== opts.listId) continue;
    const flow = (a.flow ?? {}) as Flow;
    if (!flow.start) continue;
    if (await db.optOut.findUnique({ where: { phone } })) continue;
    try {
      await db.automationRun.create({ data: { automationId: a.id, refId, phone, name: ctx.nome ?? null, ctx, nodeId: flow.start, nextAt: new Date(Date.now() + (cfg.delayMin ?? 0) * 60_000) } });
      n++;
    } catch {
      // já entrou nessa automação por esse pedido/carrinho
    }
  }
  return n;
}

// Pagou durante a automação: marca a conversão nas automações ativas desse telefone
export async function markConverted(phoneRaw: string | null | undefined, value: number) {
  const phone = normalizePhone(phoneRaw ?? "");
  if (!phone) return;
  await db.automationRun.updateMany({ where: { phone, convertedAt: null, createdAt: { gte: new Date(Date.now() - 7 * 864e5) }, sent: { gt: 0 } }, data: { convertedAt: new Date(), value } });
}

/* ---------- Execução dos passos ---------- */

async function check(run: { id: string; phone: string; createdAt: Date; lastSentAt: Date | null; clicks: number; convertedAt: Date | null }, n: Extract<Node, { type: "cond" }>) {
  if (n.check === "pagou") return !!run.convertedAt;
  if (n.check === "clicou") return run.clicks > 0;
  if (n.check === "respondeu") return !!(await db.chatMessage.findFirst({ where: { phone: run.phone, fromMe: false, createdAt: { gte: run.lastSentAt ?? run.createdAt } } }));
  if (n.check === "etiqueta") return !!(await db.contactTag.findUnique({ where: { phone_tag: { phone: run.phone, tag: (n.value ?? "").trim().toLowerCase() } } }));
  if (n.check === "lista") return !!(n.value && (await db.listMember.findUnique({ where: { listId_phone: { listId: n.value, phone: run.phone } } })));
  return false;
}

export async function runDue(limit = 30) {
  const due = await db.automationRun.findMany({ where: { status: "ativo", nextAt: { lte: new Date() }, automation: { active: true } }, include: { automation: true }, take: limit, orderBy: { nextAt: "asc" } });
  for (const run of due) {
    const flow = (run.automation.flow ?? {}) as Flow;
    const ctx = (run.ctx ?? {}) as Ctx;
    const log = (run.log ?? []) as { at: string; t: string }[];
    let nodeId = run.nodeId;
    let nextAt: Date | null = null;
    let status = "ativo";
    let sent = run.sent;
    let lastSentAt = run.lastSentAt;
    let error: string | null = null;
    const links: string[] = ((ctx._links ?? "") ? JSON.parse(ctx._links) : []) as string[];
    try {
      for (let steps = 0; steps < 25; steps++) {
        const n = nodeId ? flow.nodes[nodeId] : null;
        if (!n || n.type === "exit") { status = "fim"; break; }
        if (n.type === "send") {
          const wait = await reserveSlot();
          if (wait > 0) { nextAt = new Date(Date.now() + wait); break; }
          for (const [i, p] of n.parts.entries()) {
            if (i > 0) await new Promise((r) => setTimeout(r, 1500));
            const text = p.text ? fill(p.text, ctx, run.id, links) : "";
            const url = p.productImage ? ctx.imagem : p.mediaUrl ? (p.mediaUrl.startsWith("http") ? p.mediaUrl : `${base()}${p.mediaUrl}`) : null;
            if (url) await sendMedia(run.phone, { url, type: (p.productImage ? "image" : p.mediaType ?? "image") as "image" | "video" | "document", caption: text });
            else if (text) await sendText(run.phone, text);
          }
          sent++; lastSentAt = new Date();
          log.push({ at: new Date().toISOString(), t: "Mensagem enviada" });
          nodeId = n.next ?? null;
          continue;
        }
        if (n.type === "wait") {
          const ms = n.amount * (n.unit === "d" ? 864e5 : n.unit === "h" ? 3600_000 : 60_000);
          nodeId = n.next ?? null;
          nextAt = new Date(Date.now() + Math.max(60_000, ms));
          break;
        }
        if (n.type === "waitHour") {
          const [h, m] = n.hour.split(":").map(Number);
          const today = isoDayLocal();
          let at = new Date(`${today}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00-03:00`);
          if (at.getTime() <= Date.now()) at = new Date(at.getTime() + 864e5);
          nodeId = n.next ?? null;
          nextAt = at;
          break;
        }
        if (n.type === "cond") {
          const ok = await check({ ...run, lastSentAt, clicks: run.clicks }, n);
          log.push({ at: new Date().toISOString(), t: `Condição ${n.check}: ${ok ? "sim" : "não"}` });
          nodeId = (ok ? n.yes : n.no) ?? null;
          continue;
        }
        if (n.type === "tag") {
          const tag = n.tag.trim().toLowerCase();
          if (tag) { if (n.action === "add") await db.contactTag.upsert({ where: { phone_tag: { phone: run.phone, tag } }, create: { phone: run.phone, tag }, update: {} }); else await db.contactTag.deleteMany({ where: { phone: run.phone, tag } }); }
          nodeId = n.next ?? null;
          continue;
        }
        if (n.type === "list") {
          if (n.listId) {
            if (n.action === "add") await db.listMember.upsert({ where: { listId_phone: { listId: n.listId, phone: run.phone } }, create: { listId: n.listId, phone: run.phone, name: run.name }, update: {} });
            else await db.listMember.deleteMany({ where: { listId: n.listId, phone: run.phone } });
          }
          nodeId = n.next ?? null;
          continue;
        }
      }
    } catch (e) {
      status = "erro"; error = String(e).replace(/^Error: /, "").slice(0, 200);
    }
    if (status === "ativo" && !nextAt) status = "fim";
    await db.automationRun.update({ where: { id: run.id }, data: { nodeId, nextAt, status, sent, lastSentAt, error, log: log.slice(-30), ctx: { ...ctx, _links: JSON.stringify(links) } } });
  }
  return due.length;
}

/* ---------- Gatilhos de pedido e carrinho (a cada 5 minutos) ---------- */

const PAID = new Set(["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED"]);
export async function scanAutomationEvents() {
  const triggers = new Set((await db.automation.findMany({ where: { active: true }, select: { trigger: true } })).map((a) => a.trigger));
  if (!triggers.size) return;
  const mark = await db.setting.findUnique({ where: { key: "_auto_start" } });
  const startedAt = mark ? new Date((mark.value as { at: string }).at) : new Date();
  if (!mark) await db.setting.create({ data: { key: "_auto_start", value: { at: startedAt.toISOString() } } });
  const since = new Date(Math.max(startedAt.getTime(), Date.now() - 2 * 864e5));
  {
    const orders = await ordersBetween(new Date(Date.now() - 3 * 864e5), new Date()).catch(() => []);
    for (const o of orders) {
      if (o.cancelled || !o.phone) continue;
      const created = new Date(o.createdAt);
      const ctx: Ctx = { nome: o.customer, produtos: o.lines.map((l) => `${l.quantity > 1 ? `${l.quantity}x ` : ""}${l.title}${l.variant ? ` (${l.variant})` : ""}`).join(", "), valor: o.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), link: o.statusUrl ?? "", pedido: o.name, rastreio: o.tracking?.url ?? o.tracking?.number ?? "", imagem: o.images[0] ?? "" };
      const g = (o.gateway ?? "").toLowerCase();
      const paid = PAID.has(o.financial);
      if (paid) await markConverted(o.phone, o.subtotal);
      if (created < since && !paid && !o.tracking) continue;
      if (created >= since && triggers.has("pedido_criado")) await automationEvent("pedido_criado", o.id, o.phone, ctx);
      if (created >= since && !paid && g.includes("pix") && triggers.has("pedido_pix")) await automationEvent("pedido_pix", o.id, o.phone, ctx);
      if (created >= since && !paid && g.includes("boleto") && triggers.has("pedido_boleto")) await automationEvent("pedido_boleto", o.id, o.phone, ctx);
      if (paid && created >= since && triggers.has("pedido_pago")) await automationEvent("pedido_pago", o.id, o.phone, ctx);
      if (o.tracking && triggers.has("rastreio_criado")) await automationEvent("rastreio_criado", o.id, o.phone, ctx);
      if (o.shipStatus === "DELIVERED" && triggers.has("pedido_entregue")) await automationEvent("pedido_entregue", o.id, o.phone, ctx);
    }
  }
  if (triggers.has("carrinho_abandonado")) {
    const { gql } = await import("./store");
    type C = { id: string; createdAt: string; completedAt: string | null; abandonedCheckoutUrl: string; totalPriceSet: { shopMoney: { amount: string } }; customer: { displayName: string; defaultPhoneNumber: { phoneNumber: string } | null } | null; shippingAddress: { phone: string | null; firstName: string | null } | null; lineItems: { nodes: { title: string; quantity: number; image: { url: string } | null }[] } };
    const d = await gql<{ abandonedCheckouts: { nodes: C[] } }>(
      `query($q:String){ abandonedCheckouts(first:100, reverse:true, sortKey:CREATED_AT, query:$q){ nodes{ id createdAt completedAt abandonedCheckoutUrl totalPriceSet{shopMoney{amount}} customer{ displayName defaultPhoneNumber{phoneNumber} } shippingAddress{ phone firstName } lineItems(first:5){ nodes{ title quantity image{ url(transform:{maxWidth:640, maxHeight:640}) } } } } } }`,
      { q: `created_at:>='${since.toISOString()}'` },
    ).catch(() => null);
    for (const c of d?.abandonedCheckouts.nodes ?? []) {
      if (c.completedAt) continue;
      await automationEvent("carrinho_abandonado", c.id, c.customer?.defaultPhoneNumber?.phoneNumber ?? c.shippingAddress?.phone, {
        nome: c.customer?.displayName ?? c.shippingAddress?.firstName ?? "", produtos: c.lineItems.nodes.map((l) => l.title).join(", "),
        valor: Number(c.totalPriceSet.shopMoney.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), link: c.abandonedCheckoutUrl, imagem: c.lineItems.nodes.find((l) => l.image)?.image?.url ?? "",
      });
    }
  }
}

/* ---------- Listas ---------- */

// CSV simples: primeira linha com os nomes das colunas (nome, telefone/whatsapp, email e o que mais quiser, ex.: link)
export function parseCsv(txt: string) {
  const lines = txt.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const split = (l: string) => { const out: string[] = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()); };
  const head = split(lines[0]).map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i] ?? `col${i}`, v])));
}

export async function addToList(listId: string, rows: Record<string, string>[]) {
  let added = 0;
  for (const r of rows) {
    const phone = normalizePhone(r.telefone ?? r.whatsapp ?? r.celular ?? r.phone ?? r.numero ?? "");
    if (!phone) continue;
    const { nome, name, telefone, whatsapp, celular, phone: _p, numero, email, ...fields } = r;
    void telefone; void whatsapp; void celular; void _p; void numero;
    const who = nome ?? name ?? null;
    const exists = await db.listMember.findUnique({ where: { listId_phone: { listId, phone } } });
    await db.listMember.upsert({ where: { listId_phone: { listId, phone } }, create: { listId, phone, name: who, email: email ?? null, fields }, update: { name: who ?? undefined, email: email ?? undefined, fields } });
    if (!exists) { added++; await automationEvent("lista", `lista-${listId}-${phone}`, phone, { nome: who ?? "", ...fields }, { listId }); }
  }
  return added;
}
