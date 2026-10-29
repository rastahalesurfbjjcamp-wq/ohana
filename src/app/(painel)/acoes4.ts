"use server";
// Ações em todos os grupos da comunidade e criação de grupos em lote.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { evolution } from "@/lib/evolution";
import { syncGroups } from "@/lib/groups";
import { fillOrder } from "@/lib/redirect";
import { normalizePhone } from "@/lib/segments";
import { saveUpload } from "@/lib/uploads";
import { saveSetting } from "@/lib/settings";

async function admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "ADMIN") throw new Error("Só o administrador pode mudar isso");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function eachGroup(fn: (jid: string, i: number) => Promise<unknown>) {
  const groups = await fillOrder();
  let ok = 0, fail = 0;
  for (let i = 0; i < groups.length; i++) {
    try {
      await fn(groups[i].jid, i);
      ok++;
    } catch {
      fail++;
    }
    await pause(1500); // devagar para o WhatsApp não estranhar
  }
  return { ok, fail };
}

// Nome com {n} vira o número do grupo na ordem (01, 02...). Descrição vale para todos.
export async function bulkGroupInfo(form: FormData) {
  await admin();
  const name = str(form, "name");
  const desc = str(form, "description");
  const start = Number(str(form, "start")) || 1;
  const r = await eachGroup(async (jid, i) => {
    if (name) await evolution.updateSubject(jid, name.replace(/\{n\}/g, String(start + i).padStart(2, "0")));
    if (desc) await evolution.updateDescription(jid, desc);
  });
  if (name) await syncGroups().catch(() => null);
  revalidatePath("/grupos");
  redirect(`/grupos?feito=${r.ok}&falha=${r.fail}`);
}

export async function bulkGroupPicture(form: FormData) {
  await admin();
  const file = form.get("photo");
  if (!(file instanceof File) || !file.size) redirect("/grupos?acao=foto&erro=1");
  const up = await saveUpload(file as File);
  const r = await eachGroup((jid) => evolution.updatePicture(jid, up.url));
  redirect(`/grupos?feito=${r.ok}&falha=${r.fail}`);
}

export async function bulkGroupAdmins(form: FormData) {
  await admin();
  const onlyAdmins = str(form, "mode") === "admins";
  const r = await eachGroup((jid) => evolution.updateSetting(jid, onlyAdmins ? "announcement" : "not_announcement"));
  redirect(`/grupos?feito=${r.ok}&falha=${r.fail}`);
}

// Cria vários grupos de uma vez. O WhatsApp exige pelo menos uma pessoa junto: o número de um admin da equipe.
export async function createGroupsBatch(form: FormData) {
  await admin();
  const prefix = str(form, "prefix") || "Grupo VIP";
  const count = Math.min(10, Math.max(1, Number(str(form, "count")) || 1));
  const start = Math.max(1, Number(str(form, "start")) || 1);
  const phone = normalizePhone(str(form, "admin"));
  const desc = str(form, "description");
  if (!phone) redirect("/grupos?criar=1&erro=numero");
  let ok = 0;
  for (let i = 0; i < count; i++) {
    try {
      await evolution.createGroup(`${prefix} ${String(start + i).padStart(2, "0")}`, [phone!], desc || undefined);
      ok++;
    } catch {
      // segue para o próximo
    }
    await pause(3000);
  }
  await syncGroups().catch(() => null);
  // os grupos novos já entram na comunidade, no fim da fila
  const fresh = await db.group.findMany({ where: { name: { startsWith: prefix }, isCommunity: false, archived: false } });
  for (const g of fresh) await db.group.update({ where: { id: g.id }, data: { isCommunity: true } });
  revalidatePath("/grupos");
  redirect(`/grupos?criados=${ok}`);
}

export async function leaveHub(form: FormData) {
  await admin();
  const id = str(form, "id");
  await db.group.update({ where: { id }, data: { isCommunity: false, isResults: false } });
  revalidatePath("/grupos");
}

/* Liga e desliga das automações (cada uma separada) */
const AUTOS: Record<string, [string, string]> = {
  carrinho: ["recovery", "cartEnabled"],
  pix: ["recovery", "pixEnabled"],
  rastreio: ["recovery", "trackingEnabled"],
  avaliacao: ["postsale", "reviewEnabled"],
  recompra: ["postsale", "repurchaseEnabled"],
  boasvindas: ["leads", "welcomeEnabled"],
  volta: ["winback", "enabled"],
  assistente: ["assistant", "enabled"],
};
export async function toggleAutomation(f: FormData) {
  await admin();
  const k = str(f, "key");
  const on = str(f, "on") === "1";
  const a = AUTOS[k];
  if (!a) return;
  await saveSetting(a[0] as "recovery", { [a[1]]: on } as never);
  if (k === "carrinho" || k === "pix") {
    // só entram carrinhos e pedidos criados depois de ligar
    if (on) await db.setting.upsert({ where: { key: "_recovery_start" }, create: { key: "_recovery_start", value: { at: new Date().toISOString() } }, update: { value: { at: new Date().toISOString() } } });
  }
  revalidatePath("/recuperacao");
  revalidatePath("/pos-venda");
  revalidatePath("/assistente");
  revalidatePath("/leads");
  revalidatePath("/entradas");
}

// Salva só as mensagens de uma automação (sem mexer no liga/desliga)
export async function saveRecoveryMessages(f: FormData) {
  await admin();
  const kind = str(f, "kind");
  const num = (k: string, d: number) => { const n = Number(str(f, k).replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : d; };
  const steps = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ delayMin: Math.max(1, Math.round(num(`${prefix}${i}_delay`, 60) * (str(f, `${prefix}${i}_unit`) === "h" ? 60 : 1))), text: str(f, `${prefix}${i}_text`) })).filter((s) => s.text);
  if (kind === "carrinho") await saveSetting("recovery", { cartSteps: steps("cart", 3) });
  if (kind === "pix") await saveSetting("recovery", { pixSteps: steps("pix", 2) });
  if (kind === "rastreio") await saveSetting("recovery", { trackingText: str(f, "trackingText"), delayedDays: num("delayedDays", 10) });
  if (kind === "avaliacao") await saveSetting("postsale", { reviewText: str(f, "reviewText"), reviewDelayDays: num("reviewDelayDays", 2), ...(str(f, "coupon") ? { coupon: str(f, "coupon").toUpperCase() } : {}) });
  if (kind === "recompra") await saveSetting("postsale", { repurchaseText: str(f, "repurchaseText"), repurchaseDays: num("repurchaseDays", 45) });
  if (str(f, "storeUrl")) await saveSetting("postsale", { storeUrl: str(f, "storeUrl") });
  revalidatePath("/recuperacao");
  revalidatePath("/pos-venda");
  const back = str(f, "back");
  redirect(back.startsWith("/") ? `${back}${back.includes("?") ? "&" : "?"}ok=1` : `/recuperacao?ok=1&cfg=${kind}`);
}

/* Assistente: o que ele sabe */
export async function saveAssistantKnowledge(f: FormData) {
  await admin();
  const on = (k: string) => f.get(k) === "on";
  await saveSetting("assistant", {
    useOrders: on("useOrders"), useStock: on("useStock"), useSizes: on("useSizes"), useExchange: on("useExchange"), handoff: on("handoff"),
    sizeTable: str(f, "sizeTable"), exchangeText: str(f, "exchangeText"), instructions: str(f, "instructions"),
  });
  revalidatePath("/assistente");
  redirect("/assistente?ok=1");
}

// Conversa de teste no painel: a IA responde mas nada é enviado no WhatsApp
export async function testAssistant(history: { fromMe: boolean; text: string }[]): Promise<{ reply?: string; error?: string }> {
  await admin();
  try {
    const { generateReply } = await import("@/lib/assistant");
    const msgs: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of history.slice(-14)) {
      const role = m.fromMe ? "assistant" : "user";
      const last = msgs[msgs.length - 1];
      if (last && last.role === role) last.content += `\n${m.text}`;
      else msgs.push({ role, content: m.text });
    }
    while (msgs[0]?.role === "assistant") msgs.shift();
    if (!msgs.length) return { error: "Escreva uma mensagem" };
    const reply = await generateReply(msgs, null);
    return { reply: reply.replace("[HUMANO]", "\n(aqui ele passaria para a equipe)").trim() };
  } catch (e) {
    return { error: String(e).replace(/^Error: /, "").slice(0, 200) };
  }
}

/* Custos por voz ou texto na tela de produtos */
export async function parseCosts(text: string, products: string[]): Promise<{ items?: { product: string; cost: number }[]; error?: string }> {
  await admin();
  try {
    const { parseCostsText } = await import("@/lib/ai");
    return { items: await parseCostsText(text, products) };
  } catch (e) {
    return { error: String(e).replace(/^Error: /, "").slice(0, 200) };
  }
}
export async function saveParsedCosts(items: { product: string; cost: number }[]): Promise<{ ok: number }> {
  const s = await admin();
  let ok = 0;
  const month = new Date().toISOString().slice(0, 7);
  for (const it of items) {
    if (!it.product || !(it.cost > 0)) continue;
    // custo por peça guardado como "lote" de 1 peça, ligado pelo nome do produto
    await db.cost.create({ data: { kind: "STOCK_LOT", description: `Custo de ${it.product}`, amount: it.cost, units: 1, unitCost: it.cost, productKey: it.product.toLowerCase(), month, createdBy: s.name } });
    ok++;
  }
  revalidatePath("/produtos");
  revalidatePath("/financeiro");
  return { ok };
}
