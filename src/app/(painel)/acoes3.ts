"use server";
// Ações da etapa 3: recuperação, pós-venda, atendimento, assistente, indique, lançamento, funis, diagnóstico.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { evolution } from "@/lib/evolution";
import { saveSetting } from "@/lib/settings";
import { sendText } from "@/lib/send";
import { tz } from "@/lib/time";

async function auth() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, d = 0) => {
  const n = Number(str(f, k).replace(",", "."));
  return Number.isFinite(n) ? n : d;
};
const on = (f: FormData, k: string) => f.get(k) === "on";
async function localToDate(v: string) {
  const [d, t] = v.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = (t ?? "00:00").split(":").map(Number);
  return new Date(new TZDate(y, m - 1, day, hh, mm, 0, tz()).getTime());
}

/* Recuperação */
export async function saveRecovery(f: FormData) {
  await auth();
  const steps = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ delayMin: Math.max(1, Math.round(num(f, `${prefix}${i}_delay`, 60) * (str(f, `${prefix}${i}_unit`) === "h" ? 60 : 1))), text: str(f, `${prefix}${i}_text`) })).filter((s) => s.text);
  await saveSetting("recovery", {
    cartEnabled: on(f, "cartEnabled"),
    cartSteps: steps("cart", 3),
    pixEnabled: on(f, "pixEnabled"),
    pixSteps: steps("pix", 2),
    trackingEnabled: on(f, "trackingEnabled"),
    trackingText: str(f, "trackingText"),
    delayedDays: Math.max(1, num(f, "delayedDays", 10)),
  });
  revalidatePath("/recuperacao");
  redirect("/recuperacao?ok=1");
}
export async function stopCase(f: FormData) {
  await auth();
  await db.recoveryCase.update({ where: { id: str(f, "id") }, data: { status: "parado", nextAt: null } });
  revalidatePath("/recuperacao");
}

/* Pós-venda */
export async function savePostsale(f: FormData) {
  await auth();
  await saveSetting("postsale", {
    reviewEnabled: on(f, "reviewEnabled"),
    reviewDelayDays: Math.max(0, num(f, "reviewDelayDays", 2)),
    reviewText: str(f, "reviewText"),
    coupon: str(f, "coupon").toUpperCase(),
    repurchaseEnabled: on(f, "repurchaseEnabled"),
    repurchaseDays: Math.max(7, num(f, "repurchaseDays", 45)),
    repurchaseText: str(f, "repurchaseText"),
    storeUrl: str(f, "storeUrl") || "https://rastahale.com.br",
  });
  revalidatePath("/pos-venda");
  redirect("/pos-venda?ok=1");
}

/* Atendimento */
export async function replyChat(f: FormData) {
  const s = await auth();
  const phone = str(f, "phone");
  const text = str(f, "text");
  if (!phone || !text) return;
  await sendText(phone, text);
  await db.chatThread.upsert({
    where: { phone },
    create: { phone, name: str(f, "name") || null, lastText: text.slice(0, 200), lastAt: new Date(), unread: 0, assignee: s.name, aiEnabled: false },
    update: { lastText: text.slice(0, 200), lastAt: new Date(), unread: 0, assignee: s.name, aiEnabled: false },
  });
  await db.chatMessage.create({ data: { phone, fromMe: true, by: "equipe", text } });
  revalidatePath("/atendimento");
}
export async function threadAction(f: FormData) {
  await auth();
  const phone = str(f, "phone");
  const act = str(f, "act");
  if (act === "resolver") await db.chatThread.update({ where: { phone }, data: { status: "resolvido", unread: 0 } });
  if (act === "reabrir") await db.chatThread.update({ where: { phone }, data: { status: "aberto" } });
  if (act === "ia_on") await db.chatThread.update({ where: { phone }, data: { aiEnabled: true } });
  if (act === "ia_off") await db.chatThread.update({ where: { phone }, data: { aiEnabled: false, assignee: (await auth()).name } });
  if (act === "assign") await db.chatThread.update({ where: { phone }, data: { assignee: str(f, "assignee") || null } });
  revalidatePath("/atendimento");
}

/* Assistente */
export async function saveAssistant(f: FormData) {
  await auth();
  await saveSetting("assistant", { enabled: on(f, "enabled"), instructions: str(f, "instructions") });
  revalidatePath("/assistente");
  redirect("/assistente?ok=1");
}

/* Indique e ganhe */
export async function saveReferral(f: FormData) {
  await auth();
  await saveSetting("referral", {
    ...(f.has("shareText") ? { shareText: str(f, "shareText"), enabled: on(f, "enabled") } : {}),
    ...(f.has("percent") ? { percent: Math.min(50, Math.max(1, num(f, "percent", 10))) } : {}),
    ...(f.has("commission") ? { commission: Math.min(50, Math.max(0, num(f, "commission", 10))) } : {}),
    ...(f.has("releaseDays") ? { releaseDays: Math.max(0, num(f, "releaseDays", 7)) } : {}),
  });
  revalidatePath("/indique");
  redirect("/indique?ok=1");
}

/* Lançamento */
export async function createLaunch(f: FormData) {
  const s = await auth();
  const name = str(f, "name");
  const opens = str(f, "opensAt");
  const groupJids = f.getAll("groups").map(String).filter(Boolean);
  if (!name || !opens || !groupJids.length) redirect("/lancamento?erro=1");
  const opensAt = await localToDate(opens);
  const launch = await db.launch.create({ data: { name, opensAt, groupJids, productKey: str(f, "productKey").toLowerCase() || null, goal: Math.round(num(f, "goal", 0)) || null, liveUrl: str(f, "liveUrl") || null, about: str(f, "about") || null, closesAt: str(f, "closesAt") ? await localToDate(str(f, "closesAt")) : null, createdBy: s.name } });
  const plan: [string, number][] = [
    ["warm7", -7 * 24 * 60],
    ["warm3", -3 * 24 * 60],
    ["warm1", -24 * 60],
    ["h1", -60],
    ["open", 0],
    ["last", 24 * 60],
  ];
  for (const [key, offset] of plan) {
    const text = str(f, `msg_${key}`);
    if (!text) continue;
    const sendAt = new Date(opensAt.getTime() + offset * 60_000);
    if (sendAt.getTime() < Date.now() - 60_000) continue;
    await db.scheduledMessage.create({ data: { text: text.replace(/\{drop\}/g, name), groupJids, sendAt, mentionAll: true, createdBy: s.name, launchId: launch.id } });
  }
  revalidatePath("/lancamento");
  redirect(`/lancamento?ok=${launch.id}`);
}

/* Funis */
export async function saveFunnel(f: FormData) {
  await auth();
  const id = str(f, "id");
  const { saveUpload } = await import("@/lib/uploads");
  type St = { delayMin: number; text: string; mediaUrl?: string | null; mediaType?: string | null; cond?: string | null };
  let raw: St[] = [];
  try { raw = JSON.parse(str(f, "steps") || "[]"); } catch { raw = []; }
  const steps: St[] = [];
  for (let i = 0; i < raw.length && i < 10; i++) {
    const st = raw[i];
    if (!st.text?.trim()) continue;
    const file = f.get(`media_${i}`);
    let mediaUrl = st.mediaUrl ?? null, mediaType = st.mediaType ?? null;
    if (file instanceof File && file.size > 0) { const up = await saveUpload(file); mediaUrl = up.url; mediaType = up.type; }
    steps.push({ delayMin: Math.max(0, Math.round(Number(st.delayMin) || 0)), text: st.text.trim(), mediaUrl, mediaType, cond: st.cond && st.cond !== "sempre" ? st.cond : null });
  }
  const data = { name: str(f, "name") || "Funil", trigger: str(f, "trigger"), active: on(f, "active"), steps };
  const saved = id ? await db.funnel.update({ where: { id }, data }) : await db.funnel.create({ data });
  revalidatePath("/funis");
  redirect(`/funis?ok=1&e=${saved.id}`);
}
// Manda todas as mensagens do funil para o número conectado, para conferir
export async function testFunnel(f: FormData) {
  const s = await auth();
  const fid = str(f, "id_test") || str(f, "id");
  const fn = await db.funnel.findUnique({ where: { id: fid } });
  const me = await evolution.ownerPhone();
  if (!fn || !me) redirect(`/funis?e=${fid}&erro=teste`);
  const steps = (fn!.steps as { text: string; mediaUrl?: string | null; mediaType?: string | null }[]) ?? [];
  for (const st of steps) {
    const text = st.text.replace(/\{nome\}/g, s.name.split(" ")[0]);
    if (st.mediaUrl) await evolution.sendMedia(me!, { url: st.mediaUrl, type: (st.mediaType as "image") ?? "image", caption: text });
    else await evolution.sendText(me!, text);
  }
  redirect(`/funis?e=${fn!.id}&teste=1`);
}
export async function toggleFunnel(f: FormData) {
  await auth();
  const fn = await db.funnel.findUnique({ where: { id: str(f, "id") } });
  if (fn) await db.funnel.update({ where: { id: fn.id }, data: { active: !fn.active } });
  revalidatePath("/funis");
}

export async function genReferrals(f: FormData) {
  await auth();
  const { generateReferrals } = await import("@/lib/referral");
  try {
    const n = await generateReferrals((str(f, "segment") || "vip") as "vip", 50);
    redirect(`/indique?gerados=${n}`);
  } catch (e) {
    if (String(e).includes("NEXT_REDIRECT")) throw e;
    redirect(`/indique?erro=${encodeURIComponent(String(e).replace(/^Error: /, "").slice(0, 160))}`);
  }
}
export async function sendReferralCodes() {
  await auth();
  const { getSettings } = await import("@/lib/settings");
  const { shareMessage } = await import("@/lib/referral");
  const s = await getSettings();
  const refs = await db.referral.findMany({ where: { uses: 0, NOT: { phone: { startsWith: "sem-" } } } });
  // Envia aos poucos pelo mesmo sistema de disparos
  const b = await db.broadcast.create({
    data: {
      name: "Códigos do Indique e ganhe",
      text: "{texto}",
      audience: "lista",
      status: "SCHEDULED",
      sendAt: new Date(),
      total: refs.length,
      recipients: { create: refs.map((r) => ({ phone: r.phone, name: shareMessage(s.referral.shareText, r, s.referral.percent) })) },
    },
  });
  revalidatePath("/indique");
  redirect(`/disparos?ok=${b.id}`);
}

export async function generateDiagnosis() {
  await auth();
  const { runDiagnosis } = await import("@/lib/diagnosis");
  try {
    await runDiagnosis();
  } catch (e) {
    redirect(`/diagnostico?erro=${encodeURIComponent(String(e).replace(/^Error: /, "").slice(0, 160))}`);
  }
  revalidatePath("/diagnostico");
  redirect("/diagnostico");
}

// Respostas rápidas do atendimento
export async function saveQuickReplies(f: FormData) {
  await auth();
  const items = str(f, "items").split(/\n-{3,}\n|\n\n/).map((x) => x.trim()).filter(Boolean).slice(0, 30);
  await db.setting.upsert({ where: { key: "_quick_replies" }, create: { key: "_quick_replies", value: { items } }, update: { value: { items } } });
  revalidatePath("/atendimento");
}

// Cadastra um parceiro (atleta, alguém da comunidade ou cliente) com cupom próprio na Shopify
export async function invitePartner(f: FormData) {
  await auth();
  const { createDiscount } = await import("@/lib/referral");
  const { getSettings } = await import("@/lib/settings");
  const { normalizePhone } = await import("@/lib/segments");
  const s = await getSettings();
  const name = str(f, "name");
  if (!name) redirect("/indique?convidar=1&erro=nome");
  const phone = normalizePhone(str(f, "phone")) ?? `sem-${Date.now()}`;
  const base = (str(f, "code") || name.split(" ")[0]).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 14);
  const code = /\d$/.test(base) ? base : `${base}${s.referral.percent}`;
  try {
    const discountId = await createDiscount(code, s.referral.percent);
    await db.referral.create({ data: { phone, name, code, discountId, kind: str(f, "kind") || "atleta", payout: str(f, "payout") || "pix", note: str(f, "note") || null } });
  } catch (e) {
    redirect(`/indique?convidar=1&erro=${encodeURIComponent(String(e).replace(/^Error: /, "").slice(0, 160))}`);
  }
  revalidatePath("/indique");
  redirect(`/indique?criado=${code}`);
}
export async function updatePartner(f: FormData) {
  await auth();
  await db.referral.update({ where: { id: str(f, "id") }, data: { kind: str(f, "kind") || undefined, payout: str(f, "payout") || undefined } });
  revalidatePath("/indique");
}

// Transforma as ações de um item do diagnóstico em tarefas
export async function diagnosisToTasks(f: FormData) {
  const s = await auth();
  const title = str(f, "title");
  const prio = str(f, "priority") === "alta" ? "alta" : str(f, "priority") === "baixa" ? "baixa" : "normal";
  const actions = f.getAll("action").map(String).filter(Boolean);
  for (const a of actions) await db.task.create({ data: { title: a, description: `Do diagnóstico: ${title}`, priority: prio, createdBy: s.name } });
  revalidatePath("/tarefas");
  redirect(`/diagnostico?tarefas=${actions.length}${str(f, "id") ? `&id=${str(f, "id")}` : ""}`);
}

// Botão "Estamos ao vivo": manda o link agora para os grupos do lançamento, marcando todos
export async function goLive(f: FormData) {
  const s = await auth();
  const l = await db.launch.findUnique({ where: { id: str(f, "id") } });
  if (!l) redirect("/lancamento");
  const text = str(f, "text") || `Estamos ao vivo! ${l!.liveUrl ?? ""}`.trim();
  await db.scheduledMessage.create({ data: { text, groupJids: l!.groupJids, sendAt: new Date(), mentionAll: true, createdBy: s.name, launchId: l!.id } });
  await db.launch.update({ where: { id: l!.id }, data: { status: "aberto" } });
  revalidatePath("/lancamento");
  redirect(`/lancamento?id=${l!.id}&live=1`);
}
