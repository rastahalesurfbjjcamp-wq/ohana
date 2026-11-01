// Automações: gatilho -> blocos (enviar WhatsApp, aguardar, condições, atendimento, listas, etiquetas...).
// O worker roda os passos que chegaram na hora; nada sai com a automação desligada.
import { db } from "./db";
import { env } from "./env";
import { reserveSlot, sendMedia, sendText } from "./send";
import { normalizePhone } from "./segments";
import { ordersBetween, type Order } from "./store";
import { isoDayLocal } from "./time";
import { getSettings } from "./settings";
import { type Branch, type Ctx, type Flow, type Node, type Part, type Rule } from "./flowTypes";
export { TRIGGERS, triggerLabel, type Ctx, type Flow, type Node, type Part } from "./flowTypes";

const rid = () => Math.random().toString(36).slice(2, 9);
export const newNodeId = rid;
const base = () => env.appUrl().replace(/\/$/, "");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ---------- Dados do contato para as variáveis ---------- */

const SHIP_PT: Record<string, string> = { DELIVERED: "Entregue", IN_TRANSIT: "Em trânsito", OUT_FOR_DELIVERY: "Saiu para entrega", FULFILLED: "Postado", ATTEMPTED_DELIVERY: "Tentativa de entrega", READY_FOR_PICKUP: "Aguardando retirada", FAILURE: "Falha na entrega", LABEL_PRINTED: "Etiqueta emitida", CONFIRMED: "Postado" };
export const shipLabel = (s: string | null | undefined) => (s ? SHIP_PT[s] ?? s.toLowerCase().replace(/_/g, " ") : "");

export function orderCtx(o: Order): Ctx {
  const parts = (o.customer ?? "").trim().split(/\s+/);
  const venc = new Date(new Date(o.createdAt).getTime() + 3 * 864e5).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return {
    nome: o.customer ?? "", nome_completo: o.customer ?? "", sobrenome: parts.slice(1).join(" "), email: o.email ?? "", telefone: o.phone ?? "",
    produtos: o.lines.map((l) => `${l.quantity > 1 ? `${l.quantity}x ` : ""}${l.title}`).join(", "),
    produtos_variante: o.lines.map((l) => `${l.quantity > 1 ? `${l.quantity}x ` : ""}${l.title}${l.variant ? ` (${l.variant})` : ""}`).join(", "),
    valor: brl(o.total), subtotal: brl(o.subtotal), valor_num: String(o.total), link: o.statusUrl ?? "", pix: o.statusUrl ?? "", boleto: o.statusUrl ?? "", vencimento: venc,
    pedido: o.name, endereco: o.address ?? "", cupom: (o.codes ?? []).join(", "), pagamento: o.gateway ?? "",
    rastreio: o.tracking?.number ?? "", rastreio_link: o.tracking?.url ?? "", transportadora: o.tracking?.company ?? "", status_entrega: shipLabel(o.shipStatus),
    imagem: o.images[0] ?? "",
  };
}

function withUtm(u: string, utm?: { source?: string; medium?: string; campaign?: string }) {
  if (!utm || !(utm.source || utm.medium || utm.campaign)) return u;
  try {
    const url = new URL(u);
    if (utm.source) url.searchParams.set("utm_source", utm.source);
    if (utm.medium) url.searchParams.set("utm_medium", utm.medium);
    if (utm.campaign) url.searchParams.set("utm_campaign", utm.campaign);
    return url.toString();
  } catch {
    return u;
  }
}
// Troca {campo} pelos dados do contato; links viram link rastreado para contar clique
export function fill(text: string, ctx: Ctx, runId?: string, links?: string[], opts: { utm?: { source?: string; medium?: string; campaign?: string }; node?: string; linkNodes?: string[] } = {}) {
  let t = text.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k === "nome") return (ctx.nome ?? "").split(" ")[0] || "tudo bem";
    if (k === "loja") return env.storeName();
    if (k === "site") return ctx.site ?? "";
    return ctx[k] ?? "";
  });
  if (runId && links) t = t.replace(/https?:\/\/[^\s]+/g, (u) => { links.push(withUtm(u, opts.utm)); opts.linkNodes?.push(opts.node ?? ""); return `${base()}/a/${runId}/${links.length - 1}`; });
  return t.trim();
}

// Partes de um bloco de envio: da biblioteca (se escolhida) ou escritas no bloco
export async function partsOf(n: Extract<Node, { type: "send" }>): Promise<Part[]> {
  if (n.messageId) {
    const t = await db.messageTemplate.findUnique({ where: { id: n.messageId } }).catch(() => null);
    if (t) return (t.parts ?? []) as Part[];
  }
  return n.parts ?? [];
}

// Manda as partes para um número (ou grupo) e devolve os ids das mensagens no WhatsApp
export async function sendParts(to: string, parts: Part[], ctx: Ctx, o: { runId?: string; links?: string[]; linkNodes?: string[]; node?: string; utm?: { source?: string; medium?: string; campaign?: string }; typing?: number } = {}) {
  const ids: string[] = [];
  if (!ctx.site) ctx = { ...ctx, site: (await getSettings()).postsale.storeUrl };
  const delayMs = Math.min(30, Math.max(0, o.typing ?? 2)) * 1000;
  for (const [i, p] of parts.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));
    const text = p.text ? fill(p.text, ctx, o.runId, o.links, { utm: o.utm, node: o.node, linkNodes: o.linkNodes }) : "";
    const url = p.productImage ? ctx.imagem : p.mediaUrl ? (p.mediaUrl.startsWith("http") ? p.mediaUrl : `${base()}${p.mediaUrl}`) : null;
    let res: unknown = null;
    if (url) {
      const type = (p.productImage ? "image" : p.mediaType === "audio" ? "audio" : p.mediaType ?? "image") as "image" | "video" | "document" | "audio";
      if (type === "audio") {
        const { evolution } = await import("./evolution");
        res = await evolution.sendAudio(to, url, { delayMs });
        if (text) res = await sendText(to, text, { delayMs: 800 });
      } else res = await sendMedia(to, { url, type, caption: text, fileName: p.fileName }, { delayMs });
    } else if (text) res = await sendText(to, text, { delayMs });
    const id = (res as { key?: { id?: string } } | null)?.key?.id;
    if (id) ids.push(id);
  }
  return ids;
}

/* ---------- Entrada na automação ---------- */

export async function enterAutomation(automationId: string, refId: string, phoneRaw: string, ctx: Ctx = {}, opts: { force?: boolean; delayMin?: number } = {}) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return false;
  const a = await db.automation.findUnique({ where: { id: automationId } });
  if (!a || (!a.active && !opts.force)) return false;
  const flow = (a.flow ?? {}) as Flow;
  if (!flow.start) return false;
  if (await db.optOut.findUnique({ where: { phone } })) return false;
  const cfg = (a.config ?? {}) as { delayMin?: number };
  try {
    await db.automationRun.create({ data: { automationId: a.id, refId, phone, name: ctx.nome ?? null, ctx, nodeId: flow.start, nextAt: new Date(Date.now() + (opts.delayMin ?? cfg.delayMin ?? 0) * 60_000) } });
    return true;
  } catch {
    return false; // já entrou por esse pedido/carrinho
  }
}

export async function automationEvent(trigger: string, refId: string, phoneRaw: string | null | undefined, ctx: Ctx = {}, opts: { listId?: string } = {}) {
  const phone = normalizePhone(phoneRaw ?? "");
  if (!phone) return 0;
  const list = await db.automation.findMany({ where: { trigger, active: true } });
  let n = 0;
  for (const a of list) {
    const cfg = (a.config ?? {}) as { delayMin?: number; listId?: string };
    if (trigger === "lista" && cfg.listId && cfg.listId !== opts.listId) continue;
    if (await enterAutomation(a.id, refId, phone, ctx)) n++;
  }
  return n;
}

// Pagou durante a automação: marca a conversão nas automações ativas desse telefone
export async function markConverted(phoneRaw: string | null | undefined, value: number) {
  const phone = normalizePhone(phoneRaw ?? "");
  if (!phone) return;
  await db.automationRun.updateMany({ where: { phone, convertedAt: null, createdAt: { gte: new Date(Date.now() - 7 * 864e5) }, sent: { gt: 0 } }, data: { convertedAt: new Date(), value } });
}

// Entrega e leitura vindas do WhatsApp (webhook messages.update)
export async function markDelivery(messageId: string, status: string) {
  const s = status.toUpperCase();
  const now = new Date();
  if (s === "READ" || s === "PLAYED") await db.autoMsg.updateMany({ where: { messageId }, data: { status: "lida", readAt: now } });
  else if (s === "DELIVERY_ACK") await db.autoMsg.updateMany({ where: { messageId, status: "enviada" }, data: { status: "entregue", deliveredAt: now } });
  if (s === "READ" || s === "PLAYED") await db.autoMsg.updateMany({ where: { messageId, deliveredAt: null }, data: { deliveredAt: now } });
}

/* ---------- Execução dos passos ---------- */

type RunInfo = { id: string; phone: string; createdAt: Date; lastSentAt: Date | null; clicks: number; convertedAt: Date | null };
const money = (v?: string) => Number(String(v ?? "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
const nowSP = () => new Date(Date.now() - 3 * 3600_000);
function inRange(expr: string, v: number) {
  const [a, b] = expr.split(/[-a]/).map((x) => Number(x.trim()));
  if (!Number.isFinite(a)) return false;
  return Number.isFinite(b) ? v >= a && v <= b : v === a;
}
async function checkRule(run: RunInfo, r: Rule, ctx: Ctx) {
  const val = (r.value ?? "").trim().toLowerCase();
  switch (r.check) {
    case "pagou": return !!run.convertedAt;
    case "clicou": return run.clicks > 0;
    case "respondeu": return !!(await db.chatMessage.findFirst({ where: { phone: run.phone, fromMe: false, createdAt: { gte: run.lastSentAt ?? run.createdAt } } }));
    case "etiqueta": return !!(await db.contactTag.findUnique({ where: { phone_tag: { phone: run.phone, tag: val } } }));
    case "lista": return !!(r.value && (await db.listMember.findUnique({ where: { listId_phone: { listId: r.value, phone: run.phone } } })));
    case "valor_min": return (Number(ctx.valor_num) || money(ctx.valor)) >= Number(val.replace(",", "."));
    case "valor_max": return (Number(ctx.valor_num) || money(ctx.valor)) < Number(val.replace(",", "."));
    case "produto": return !!val && `${ctx.produtos_variante ?? ""} ${ctx.produtos ?? ""}`.toLowerCase().includes(val);
    case "pagamento": return !!val && (ctx.pagamento ?? "").toLowerCase().includes(val);
    case "status_entrega": return !!val && (ctx.status_entrega ?? "").toLowerCase().includes(val);
    case "club": return !!(await db.clubMember.findFirst({ where: { phone: run.phone, status: "ativo" } }));
    case "hora_entre": return inRange(val, nowSP().getUTCHours());
    case "dia_semana": return inRange(val, nowSP().getUTCDay());
  }
  return false;
}
async function rulesOk(run: RunInfo, rules: Rule[], mode: "all" | "any" | undefined, ctx: Ctx) {
  const res: boolean[] = [];
  for (const r of rules) res.push(await checkRule(run, r, ctx));
  return mode === "any" ? res.some(Boolean) : res.every(Boolean);
}
const unitMs = (u: "min" | "h" | "d") => (u === "d" ? 864e5 : u === "h" ? 3600_000 : 60_000);

export async function runDue(limit = 30) {
  const due = await db.automationRun.findMany({ where: { status: "ativo", nextAt: { lte: new Date() }, automation: { active: true } }, include: { automation: true }, take: limit, orderBy: { nextAt: "asc" } });
  for (const run of due) {
    const flow = (run.automation.flow ?? {}) as Flow;
    const ctx = (run.ctx ?? {}) as Ctx;
    const log = (run.log ?? []) as { at: string; t: string; n?: string }[];
    const cfg = (run.automation.config ?? {}) as { stopOnPaid?: boolean };
    let nodeId = run.nodeId;
    let nextAt: Date | null = null;
    let status = "ativo";
    let sent = run.sent;
    let lastSentAt = run.lastSentAt;
    let error: string | null = null;
    const links: string[] = ((ctx._links ?? "") ? JSON.parse(ctx._links) : []) as string[];
    const linkNodes: string[] = ((ctx._ln ?? "") ? JSON.parse(ctx._ln) : []) as string[];
    const L = (t: string, n?: string | null) => log.push({ at: new Date().toISOString(), t, n: n ?? undefined });
    if (cfg.stopOnPaid && run.convertedAt) {
      await db.automationRun.update({ where: { id: run.id }, data: { status: "fim", nextAt: null, log: [...log, { at: new Date().toISOString(), t: "Saiu: pedido pago" }].slice(-40) } });
      continue;
    }
    const info = (): RunInfo => ({ ...run, lastSentAt, clicks: run.clicks });
    try {
      for (let steps = 0; steps < 30; steps++) {
        const n = nodeId ? flow.nodes[nodeId] : null;
        if (!n || n.type === "exit" || n.type === "note") { status = "fim"; if (n?.type === "exit") L("Saiu da automação", nodeId); break; }
        const nx = (n as { next?: string }).next ?? null;

        if (n.type === "send") {
          const hasBranch = !!(n.clicked || n.replied || n.noReply);
          // Já mandou e está esperando resposta ou clique
          if (ctx._w && ctx._w.startsWith(`${nodeId}|`)) {
            const [, dl, c0] = ctx._w.split("|");
            const replied = n.replied ? !!(await db.chatMessage.findFirst({ where: { phone: run.phone, fromMe: false, createdAt: { gte: lastSentAt ?? run.createdAt } } })) : false;
            const clicked = n.clicked ? run.clicks > Number(c0 || 0) : false;
            let to: string | null | undefined;
            if (replied) { to = n.replied; L("Respondeu", nodeId); }
            else if (clicked) { to = n.clicked; L("Clicou", nodeId); }
            else if (Date.now() >= Number(dl)) { to = n.noReply ?? n.next ?? null; L("Não respondeu", nodeId); }
            else { nextAt = new Date(Math.min(Number(dl), Date.now() + 2 * 60_000)); break; }
            delete ctx._w;
            nodeId = to ?? null;
            continue;
          }
          const wait = await reserveSlot();
          if (wait > 0) { nextAt = new Date(Date.now() + wait); break; }
          const ids = await sendParts(run.phone, await partsOf(n), ctx, { runId: run.id, links, linkNodes, node: nodeId!, utm: n.utm, typing: n.typing });
          for (const id of ids.length ? ids : [null]) await db.autoMsg.create({ data: { runId: run.id, automationId: run.automationId, nodeId: nodeId!, messageId: id, phone: run.phone } }).catch(() => null);
          sent++; lastSentAt = new Date();
          L("Mensagem enviada", nodeId);
          if (hasBranch) {
            ctx._w = `${nodeId}|${Date.now() + Math.max(1, n.timeout ?? 60) * 60_000}|${run.clicks}`;
            nextAt = new Date(Date.now() + 60_000);
            break;
          }
          nodeId = nx;
          continue;
        }
        if (n.type === "wait") {
          nodeId = nx;
          nextAt = new Date(Date.now() + Math.max(60_000, n.amount * unitMs(n.unit)));
          L(`Aguardando ${n.amount}${n.unit}`, run.nodeId === nodeId ? null : undefined);
          break;
        }
        if (n.type === "waitHour") {
          const [h, m] = n.hour.split(":").map(Number);
          let at = new Date(`${isoDayLocal()}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00-03:00`);
          if (at.getTime() <= Date.now()) at = new Date(at.getTime() + 864e5);
          if (n.days?.length) for (let k = 0; k < 7 && !n.days.includes(new Date(at.getTime() - 3 * 3600_000).getUTCDay()); k++) at = new Date(at.getTime() + 864e5);
          nodeId = nx;
          nextAt = at;
          break;
        }
        if (n.type === "waitDate") {
          const at = n.at ? new Date(`${n.at}:00-03:00`) : new Date();
          nodeId = nx;
          if (at.getTime() > Date.now()) { nextAt = at; break; }
          continue;
        }
        if (n.type === "waitUntil") {
          // Fica no bloco até acontecer ou até o prazo
          const key = `${nodeId}|`;
          if (!ctx._u || !ctx._u.startsWith(key)) ctx._u = `${nodeId}|${Date.now() + Math.max(1, n.amount) * unitMs(n.unit)}|${run.clicks}`;
          const [, dl, c0] = ctx._u.split("|");
          const ok = n.event === "pagou" ? !!run.convertedAt : n.event === "clicou" ? run.clicks > Number(c0 || 0) : !!(await db.chatMessage.findFirst({ where: { phone: run.phone, fromMe: false, createdAt: { gte: lastSentAt ?? run.createdAt } } }));
          if (ok) { delete ctx._u; L(n.event === "pagou" ? "Pagou" : n.event === "clicou" ? "Clicou" : "Respondeu", nodeId); nodeId = n.met ?? null; continue; }
          if (Date.now() >= Number(dl)) { delete ctx._u; L("Passou o prazo", nodeId); nodeId = n.timeout ?? null; continue; }
          nextAt = new Date(Math.min(Number(dl), Date.now() + 5 * 60_000));
          break;
        }
        if (n.type === "cond") {
          const ok = await rulesOk(info(), n.rules?.length ? n.rules : [{ check: n.check, value: n.value }], n.mode, ctx);
          L(`Condição: ${ok ? "sim" : "não"}`, nodeId);
          nodeId = (ok ? n.yes : n.no) ?? null;
          continue;
        }
        if (n.type === "multi") {
          let to: string | null = null;
          let hit = -1;
          for (const [i, b] of (n.branches as Branch[]).entries()) {
            if (await rulesOk(info(), b.rules, b.mode, ctx)) { hit = i; to = (n as Record<string, unknown>)[`m${i}`] as string | undefined ?? null; break; }
          }
          if (hit < 0) to = n.else ?? null;
          L(hit < 0 ? "Nenhuma condição" : `Caminho ${"ABCDEFGHIJ"[hit]}`, nodeId);
          nodeId = to;
          continue;
        }
        if (n.type === "random") {
          const a = Math.random() * 100 < n.pct;
          L(`Caminho ${a ? "A" : "B"}`, nodeId);
          nodeId = (a ? n.a : n.b) ?? null;
          continue;
        }
        if (n.type === "tag") {
          const tag = n.tag.trim().toLowerCase();
          if (tag) { if (n.action === "add") await db.contactTag.upsert({ where: { phone_tag: { phone: run.phone, tag } }, create: { phone: run.phone, tag }, update: {} }); else await db.contactTag.deleteMany({ where: { phone: run.phone, tag } }); }
          L(`${n.action === "add" ? "Etiqueta" : "Tirou etiqueta"} ${tag}`, nodeId);
          nodeId = nx;
          continue;
        }
        if (n.type === "list") {
          if (n.listId) {
            if (n.action === "add") await db.listMember.upsert({ where: { listId_phone: { listId: n.listId, phone: run.phone } }, create: { listId: n.listId, phone: run.phone, name: run.name }, update: {} });
            else await db.listMember.deleteMany({ where: { listId: n.listId, phone: run.phone } });
          }
          nodeId = nx;
          continue;
        }
        if (n.type === "chat") {
          const thread = await db.chatThread.upsert({ where: { phone: run.phone }, create: { phone: run.phone, name: run.name }, update: {} });
          if (n.action === "transfer") await db.chatThread.update({ where: { phone: thread.phone }, data: { assignee: n.assignee || null, status: "aberto" } });
          if (n.action === "archive") await db.chatThread.update({ where: { phone: thread.phone }, data: { status: "resolvido" } });
          if (n.action === "ai_on" || n.action === "ai_off") await db.chatThread.update({ where: { phone: thread.phone }, data: { aiEnabled: n.action === "ai_on" } });
          if (n.action === "note" && n.text) await db.chatMessage.create({ data: { phone: thread.phone, fromMe: true, by: "nota", text: fill(n.text, ctx) } });
          L(`Atendimento: ${n.action}`, nodeId);
          nodeId = nx;
          continue;
        }
        if (n.type === "goto") {
          if (n.automationId && n.automationId !== run.automationId) await enterAutomation(n.automationId, `auto-${run.id}`, run.phone, Object.fromEntries(Object.entries(ctx).filter(([k]) => !k.startsWith("_"))), { delayMin: 0 });
          L("Foi para outra automação", nodeId);
          nodeId = nx;
          continue;
        }
        if (n.type === "notify") {
          const to = n.to.includes("@g.us") ? n.to : normalizePhone(n.to);
          if (to && n.text) await sendText(to, fill(n.text, { ...ctx, telefone: ctx.telefone || run.phone }));
          L("Aviso para a equipe", nodeId);
          nodeId = nx;
          continue;
        }
        if (n.type === "webhook") {
          if (/^https:\/\//.test(n.url)) {
            await fetch(n.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ automacao: run.automation.name, telefone: run.phone, nome: run.name, dados: Object.fromEntries(Object.entries(ctx).filter(([k]) => !k.startsWith("_"))) }), signal: AbortSignal.timeout(8000) }).catch(() => null);
          }
          L("Webhook", nodeId);
          nodeId = nx;
          continue;
        }
      }
    } catch (e) {
      status = "erro"; error = String(e).replace(/^Error: /, "").slice(0, 200);
    }
    if (status === "ativo" && !nextAt) status = "fim";
    await db.automationRun.update({ where: { id: run.id }, data: { nodeId, nextAt, status, sent, lastSentAt, error, log: log.slice(-40), ctx: { ...ctx, _links: JSON.stringify(links), _ln: JSON.stringify(linkNodes) } } });
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
    const orders = await ordersBetween(new Date(Date.now() - 20 * 864e5), new Date()).catch(() => []);
    for (const o of orders) {
      if (o.cancelled || !o.phone) continue;
      const created = new Date(o.createdAt);
      const ctx = orderCtx(o);
      const g = (o.gateway ?? "").toLowerCase();
      const paid = PAID.has(o.financial);
      const recent = Date.now() - created.getTime() < 3 * 864e5;
      if (paid && recent) await markConverted(o.phone, o.subtotal);
      if (created < since && !o.tracking) continue;
      if (recent && created >= since) {
        if (triggers.has("pedido_criado")) await automationEvent("pedido_criado", o.id, o.phone, ctx);
        if (!paid && g.includes("pix") && triggers.has("pedido_pix")) await automationEvent("pedido_pix", o.id, o.phone, ctx);
        if (!paid && g.includes("boleto") && triggers.has("pedido_boleto")) await automationEvent("pedido_boleto", o.id, o.phone, ctx);
        if (!paid && /cart|card|credit|crédito|credito/.test(g) && Date.now() - created.getTime() > 10 * 60_000 && triggers.has("cartao_recusado")) await automationEvent("cartao_recusado", o.id, o.phone, ctx);
        if (paid && triggers.has("pedido_pago")) await automationEvent("pedido_pago", o.id, o.phone, ctx);
        if (paid && triggers.has("primeira_compra") && o.customerId) {
          const before = orders.filter((x) => x.customerId === o.customerId && x.id !== o.id && PAID.has(x.financial) && new Date(x.createdAt) < created).length;
          if (!before) await automationEvent("primeira_compra", o.id, o.phone, ctx);
        }
      }
      if (o.tracking && triggers.has("rastreio_criado")) await automationEvent("rastreio_criado", o.id, o.phone, ctx);
      if (o.tracking && o.shipStatus && triggers.has("rastreio_atualizado")) await automationEvent("rastreio_atualizado", `${o.id}:${o.shipStatus}`, o.phone, ctx);
      if (o.shipStatus === "DELIVERED" && triggers.has("pedido_entregue")) await automationEvent("pedido_entregue", o.id, o.phone, ctx);
    }
  }
  if (triggers.has("carrinho_abandonado")) {
    const { gql } = await import("./store");
    type C = { id: string; createdAt: string; completedAt: string | null; abandonedCheckoutUrl: string; totalPriceSet: { shopMoney: { amount: string } }; customer: { displayName: string; email?: string | null; defaultPhoneNumber: { phoneNumber: string } | null } | null; shippingAddress: { phone: string | null; firstName: string | null } | null; lineItems: { nodes: { title: string; quantity: number; variantTitle?: string | null; image: { url: string } | null }[] } };
    const d = await gql<{ abandonedCheckouts: { nodes: C[] } }>(
      `query($q:String){ abandonedCheckouts(first:100, reverse:true, sortKey:CREATED_AT, query:$q){ nodes{ id createdAt completedAt abandonedCheckoutUrl totalPriceSet{shopMoney{amount}} customer{ displayName email defaultPhoneNumber{phoneNumber} } shippingAddress{ phone firstName } lineItems(first:5){ nodes{ title quantity variantTitle image{ url(transform:{maxWidth:640, maxHeight:640}) } } } } } }`,
      { q: `created_at:>='${since.toISOString()}'` },
    ).catch(() => null);
    for (const c of d?.abandonedCheckouts.nodes ?? []) {
      if (c.completedAt) continue;
      const total = Number(c.totalPriceSet.shopMoney.amount);
      if (!total || !c.lineItems.nodes.length) continue; // carrinho vazio
      const nome = c.customer?.displayName ?? c.shippingAddress?.firstName ?? "";
      const phone = c.customer?.defaultPhoneNumber?.phoneNumber ?? c.shippingAddress?.phone;
      await automationEvent("carrinho_abandonado", c.id, phone, {
        nome, nome_completo: nome, sobrenome: nome.split(" ").slice(1).join(" "), email: c.customer?.email ?? "", telefone: phone ?? "",
        produtos: c.lineItems.nodes.map((l) => l.title).join(", "), produtos_variante: c.lineItems.nodes.map((l) => `${l.title}${l.variantTitle ? ` (${l.variantTitle})` : ""}`).join(", "),
        valor: brl(total), valor_num: String(total), link: c.abandonedCheckoutUrl, imagem: c.lineItems.nodes.find((l) => l.image)?.image?.url ?? "",
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
