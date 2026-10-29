"use server";
// Ações da etapa 3: recuperação, pós-venda, atendimento, assistente, indique, lançamento, funis, diagnóstico.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
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
  await db.chatThread.update({ where: { phone }, data: { lastText: text.slice(0, 200), lastAt: new Date(), unread: 0, assignee: s.name } });
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
  if (act === "ia_off") await db.chatThread.update({ where: { phone }, data: { aiEnabled: false } });
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
  await saveSetting("referral", { enabled: on(f, "enabled"), percent: Math.min(50, Math.max(1, num(f, "percent", 10))), shareText: str(f, "shareText") });
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
  const launch = await db.launch.create({ data: { name, opensAt, groupJids, productKey: str(f, "productKey").toLowerCase() || null, createdBy: s.name } });
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
  const steps = Array.from({ length: 4 }, (_, i) => ({ delayMin: Math.max(0, Math.round(num(f, `s${i}_delay`, 0) * (str(f, `s${i}_unit`) === "d" ? 1440 : str(f, `s${i}_unit`) === "h" ? 60 : 1))), text: str(f, `s${i}_text`) })).filter((s) => s.text);
  const data = { name: str(f, "name") || "Funil", trigger: str(f, "trigger"), active: on(f, "active"), steps };
  if (id) await db.funnel.update({ where: { id }, data });
  else await db.funnel.create({ data });
  revalidatePath("/funis");
  redirect("/funis?ok=1");
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
  const refs = await db.referral.findMany({ where: { uses: 0 } });
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
