"use server";
// Ações do painel (formulários e botões).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { evolution } from "@/lib/evolution";
import { syncGroups } from "@/lib/groups";
import { enqueue } from "@/lib/queue";
import { dailyReport, monthReport, weeklyReport } from "@/lib/report";
import { sendText } from "@/lib/send";
import { saveSetting } from "@/lib/settings";
import { saveUpload } from "@/lib/uploads";
import { addDays, isoDayLocal, tz } from "@/lib/time";

async function auth() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
async function admin() {
  const s = await auth();
  if (s.role !== "ADMIN") throw new Error("Só o administrador pode mudar isso");
  return s;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(str(f, k).replace(/\./g, "").replace(",", "."));
const on = (f: FormData, k: string) => f.get(k) === "on";

// "2026-10-30T19:00" no fuso da loja
function localToDate(v: string) {
  const [d, t] = v.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = (t ?? "00:00").split(":").map(Number);
  return new Date(new TZDate(y, m - 1, day, hh, mm, 0, tz()).getTime());
}

/* Grupos */
export async function syncGroupsAction() {
  await auth();
  await syncGroups();
  revalidatePath("/grupos");
}

// Salva a escolha dos grupos: quais são da comunidade e qual é o de resultados
export async function saveGroupSelection(formData: FormData) {
  await auth();
  const community = new Set(formData.getAll("community").map(String));
  const results = str(formData, "results");
  const groups = await db.group.findMany({ where: { archived: false }, select: { id: true } });
  for (const g of groups) {
    const cap = num(formData, `cap_${g.id}`);
    await db.group.update({
      where: { id: g.id },
      data: { isCommunity: community.has(g.id) && g.id !== results, isResults: g.id === results, ...(cap > 0 ? { capacity: cap } : {}) },
    });
  }
  revalidatePath("/grupos");
  redirect("/grupos?ok=1");
}

/* Agendamentos */
export async function createSchedule(formData: FormData) {
  const s = await auth();
  const text = str(formData, "text");
  const groupJids = formData.getAll("groups").map(String).filter(Boolean);
  const when = str(formData, "sendAt");
  const now = formData.get("now") === "1";
  if (!text || !groupJids.length || (!when && !now)) redirect("/agendamentos?erro=campos");
  let mediaUrl: string | undefined;
  let mediaType: string | undefined;
  const file = formData.get("media");
  if (file instanceof File && file.size > 0) {
    const up = await saveUpload(file);
    mediaUrl = up.url;
    mediaType = up.type;
  }
  const repeat = str(formData, "repeat"); // só vem quando a chave Repetir está ligada
  await db.scheduledMessage.create({
    data: {
      text,
      groupJids,
      sendAt: now ? new Date() : localToDate(when),
      mentionAll: on(formData, "mentionAll"),
      repeat: repeat === "daily" || repeat === "weekly" ? repeat : null,
      mediaUrl,
      mediaType,
      createdBy: s.name,
    },
  });
  revalidatePath("/agendamentos");
  redirect("/agendamentos?ok=1");
}

export async function cancelSchedule(formData: FormData) {
  await auth();
  await db.scheduledMessage.updateMany({ where: { id: str(formData, "id"), status: { in: ["SCHEDULED", "FAILED"] } }, data: { status: "CANCELED" } });
  revalidatePath("/agendamentos");
}

export async function retrySchedule(formData: FormData) {
  await auth();
  await db.scheduledMessage.updateMany({ where: { id: str(formData, "id"), status: "FAILED" }, data: { status: "SCHEDULED", sendAt: new Date(), error: null } });
  revalidatePath("/agendamentos");
}

/* Entradas e saídas */
export async function saveWinback(formData: FormData) {
  await admin();
  await saveSetting("winback", {
    enabled: on(formData, "enabled"),
    delayMinutes: Math.max(0, num(formData, "delayMinutes") || 0),
    text: str(formData, "text"),
    onlyIfNotRemovedByAdmin: on(formData, "onlyIfNotRemovedByAdmin"),
  });
  revalidatePath("/entradas");
}

/* Relatório */
export async function saveReport(formData: FormData) {
  await admin();
  await saveSetting("report", {
    enabled: on(formData, "enabled"),
    target: str(formData, "target") === "privado" ? "privado" : "grupo",
    time: str(formData, "time") || "22:00",
    weeklyEnabled: on(formData, "weeklyEnabled"),
    weeklyDay: num(formData, "weeklyDay") || 1,
    weeklyTime: str(formData, "weeklyTime") || "08:00",
    items: {
      revenue: on(formData, "i_revenue"),
      ads: on(formData, "i_ads"),
      profit: on(formData, "i_profit"),
      conversion: on(formData, "i_conversion"),
      champion: on(formData, "i_champion"),
      tip: on(formData, "i_tip"),
      groups: on(formData, "i_groups"),
    },
  });
  revalidatePath("/relatorio");
}

export async function sendReportNow(formData: FormData) {
  await auth();
  const p = str(formData, "periodo");
  const today = isoDayLocal();
  const text =
    p === "semana" ? await weeklyReport() : p === "mes" ? await monthReport() : await dailyReport(p === "ontem" ? addDays(today, -1) : today, { withTip: true });
  const { getSettings } = await import("@/lib/settings");
  const s = await getSettings();
  if (s.report.target === "privado") {
    const users = await db.user.findMany({ where: { phone: { not: null }, role: "ADMIN" } });
    if (users.length) {
      for (const u of users) await sendText(u.phone!, text);
      redirect("/relatorio?ok=1");
    }
  }
  const groups = await db.group.findMany({ where: { isResults: true } });
  if (!groups.length) redirect("/relatorio?erro=sem-grupo");
  for (const g of groups) await sendText(g.jid, text);
  redirect("/relatorio?ok=1");
}

/* Custos */
export async function saveCostRates(formData: FormData) {
  await admin();
  await saveSetting("costs", {
    taxRate: num(formData, "taxRate") / 100,
    paymentFeeRate: num(formData, "paymentFeeRate") / 100,
    packagingPerItem: num(formData, "packagingPerItem"),
  });
  revalidatePath("/custos");
}

export async function addCost(formData: FormData) {
  const s = await auth();
  const kind = str(formData, "kind") as "FIXED" | "VARIABLE" | "STOCK_LOT";
  const amount = num(formData, "amount");
  const description = str(formData, "description");
  if (!description || !(amount > 0)) redirect("/custos?erro=1");
  const month = str(formData, "month") || isoDayLocal().slice(0, 7);
  const units = kind === "STOCK_LOT" ? Math.round(num(formData, "units")) : null;
  if (kind === "STOCK_LOT" && !(units && units > 0)) redirect("/custos?erro=1");
  await db.cost.create({
    data: {
      kind,
      description,
      amount,
      month,
      recurring: kind === "FIXED" && on(formData, "recurring"),
      units,
      unitCost: units ? Math.round((amount / units) * 100) / 100 : null,
      productKey: kind === "STOCK_LOT" ? str(formData, "productKey").toLowerCase() || null : null,
      createdBy: s.name,
    },
  });
  revalidatePath("/custos");
  redirect("/custos");
}

export async function deleteCost(formData: FormData) {
  await admin();
  await db.cost.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/custos");
}

/* WhatsApp e acessos */
export async function waCreate() {
  await admin();
  const state = await evolution.connectionState();
  if (state === "not_created") await evolution.createInstance();
  else await evolution.setWebhook();
  revalidatePath("/configuracoes");
}

export async function waWebhook() {
  await admin();
  await evolution.setWebhook();
  redirect("/configuracoes?ok=webhook");
}

export async function waLogout() {
  await admin();
  await evolution.logout();
  await db.setting.deleteMany({ where: { key: "_whatsapp" } });
  revalidatePath("/configuracoes");
}

export async function saveSending(formData: FormData) {
  await admin();
  await saveSetting("sending", {
    maxPerHour: Math.max(1, num(formData, "maxPerHour") || 200),
    minDelayMs: Math.max(1000, num(formData, "minDelay") * 1000 || 4000),
    maxDelayMs: Math.max(1000, num(formData, "maxDelay") * 1000 || 12000),
  });
  revalidatePath("/configuracoes");
}

export async function saveUser(formData: FormData) {
  const s = await admin();
  const id = str(formData, "id");
  const phone = str(formData, "phone").replace(/\D/g, "") || null;
  const password = str(formData, "password");
  await db.user.update({
    where: { id },
    data: { phone, name: str(formData, "name") || undefined, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
  });
  void s;
  revalidatePath("/configuracoes");
}

export async function syncNow() {
  await auth();
  await enqueue("sync-groups", {}, { jobId: `sync-manual-${Date.now()}` });
}
