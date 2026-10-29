"use server";
// Ações da etapa 2: tarefas, leads, disparos e votações.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { evolution } from "@/lib/evolution";
import { enqueue } from "@/lib/queue";
import { saveSetting } from "@/lib/settings";
import { customers } from "@/lib/store";
import { inSegment, normalizePhone, type SegmentKey } from "@/lib/segments";
import { saveUpload } from "@/lib/uploads";
import { tz } from "@/lib/time";

async function auth() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function localToDate(v: string) {
  const [d, t] = v.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = (t ?? "00:00").split(":").map(Number);
  return new Date(new TZDate(y, m - 1, day, hh, mm, 0, tz()).getTime());
}

/* Tarefas */
export async function addTask(f: FormData) {
  const s = await auth();
  const title = str(f, "title");
  if (!title) return;
  const due = str(f, "due");
  await db.task.create({
    data: { title, description: str(f, "description") || null, assignee: str(f, "assignee") || null, priority: str(f, "priority") || "normal", dueDate: due ? localToDate(`${due}T12:00`) : null, createdBy: s.name },
  });
  revalidatePath("/tarefas");
}
export async function moveTask(f: FormData) {
  await auth();
  await db.task.update({ where: { id: str(f, "id") }, data: { status: str(f, "status") } });
  revalidatePath("/tarefas");
}
export async function deleteTask(f: FormData) {
  await auth();
  await db.task.delete({ where: { id: str(f, "id") } });
  revalidatePath("/tarefas");
}

/* Leads */
export async function saveLeadSettings(f: FormData) {
  await auth();
  await saveSetting("leads", { welcomeEnabled: f.get("welcomeEnabled") === "on", welcomeText: str(f, "welcomeText") });
  revalidatePath("/leads");
}
export async function addLeadManual(f: FormData) {
  await auth();
  const phone = normalizePhone(str(f, "phone"));
  if (!phone) redirect("/leads?erro=telefone");
  await db.lead.upsert({ where: { phone }, create: { phone, name: str(f, "name") || null, source: "manual" }, update: { name: str(f, "name") || undefined } });
  revalidatePath("/leads");
}

/* Disparos */
export async function createBroadcast(f: FormData) {
  const s = await auth();
  const name = str(f, "name") || "Disparo";
  const text = str(f, "text");
  const audience = str(f, "audience");
  if (!text || !audience) redirect("/disparos?erro=campos");

  const people = new Map<string, string | null>();
  if (audience === "leads") {
    for (const l of await db.lead.findMany({ where: { status: { not: "descadastrado" } } })) people.set(l.phone, l.name);
  } else if (audience === "selecionados") {
    const sel = (await db.setting.findUnique({ where: { key: "_disparo_lista" } }))?.value as { phones?: string[] } | undefined;
    const names = new Map((await db.lead.findMany({ where: { phone: { in: sel?.phones ?? [] } } })).map((l) => [l.phone, l.name]));
    for (const p of sel?.phones ?? []) people.set(p, names.get(p) ?? null);
  } else if (audience === "leads-nao-entrou") {
    const leads = await db.lead.findMany({ where: { status: { not: "descadastrado" } } });
    const inG = new Set((await db.contact.findMany({ where: { phone: { in: leads.map((l) => l.phone) }, memberships: { some: { group: { isCommunity: true } } } }, select: { phone: true } })).map((c) => c.phone));
    for (const l of leads) if (!inG.has(l.phone)) people.set(l.phone, l.name);
  } else if (audience === "saiu-30") {
    const ev = await db.memberEvent.findMany({ where: { type: "LEAVE", createdAt: { gte: new Date(Date.now() - 30 * 864e5) }, group: { isCommunity: true } }, include: { contact: { include: { memberships: { where: { leftAt: null, group: { isCommunity: true } } } } } } });
    for (const e of ev) if (!e.contact.memberships.length) people.set(e.contact.phone, e.contact.name);
  } else if (audience === "comunidade") {
    const members = await db.membership.findMany({ where: { leftAt: null, group: { isCommunity: true } }, include: { contact: true } });
    for (const m of members) people.set(m.contact.phone, m.contact.name);
  } else if (audience === "lista") {
    for (const line of str(f, "list").split(/\n|,|;/)) {
      const p = normalizePhone(line);
      if (p) people.set(p, null);
    }
  } else {
    const seg = audience.replace("clientes-", "") as SegmentKey;
    for (const c of await customers()) {
      if (!inSegment(c, seg)) continue;
      const p = normalizePhone(c.phone);
      if (p) people.set(p, c.name);
    }
  }
  const opt = new Set((await db.optOut.findMany()).map((o) => o.phone));
  for (const p of opt) people.delete(p);
  if (f.get("skipRecent") === "on") {
    const week = Date.now() - 7 * 864e5;
    for (const c of await customers().catch(() => [])) {
      const p = normalizePhone(c.phone);
      if (p && c.lastOrderAt && Date.parse(c.lastOrderAt) > week) people.delete(p);
    }
  }
  if (!people.size) redirect("/disparos?erro=vazio");

  let mediaUrl: string | undefined;
  let mediaType: string | undefined;
  const file = f.get("media");
  if (file instanceof File && file.size > 0) {
    const up = await saveUpload(file);
    mediaUrl = up.url;
    mediaType = up.type;
  }
  const when = str(f, "sendAt");
  const now = f.get("now") === "1";
  const b = await db.broadcast.create({
    data: {
      name,
      text,
      audience,
      mediaUrl,
      mediaType,
      createdBy: s.name,
      status: now || when ? "SCHEDULED" : "DRAFT",
      sendAt: now ? new Date() : when ? localToDate(when) : null,
      total: people.size,
      recipients: { create: [...people.entries()].map(([phone, nm]) => ({ phone, name: nm })) },
    },
  });
  revalidatePath("/disparos");
  redirect(`/disparos?ok=${b.id}`);
}
export async function broadcastAction(f: FormData) {
  await auth();
  const id = str(f, "id");
  const act = str(f, "act");
  if (act === "start") await db.broadcast.update({ where: { id }, data: { status: "SCHEDULED", sendAt: new Date() } });
  if (act === "pause") await db.broadcast.update({ where: { id }, data: { status: "PAUSED" } });
  if (act === "cancel") await db.broadcast.update({ where: { id }, data: { status: "CANCELED" } });
  revalidatePath("/disparos");
}

/* Votações */
export async function createPoll(f: FormData) {
  const s = await auth();
  const question = str(f, "question");
  const options = str(f, "options").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12);
  const mode = str(f, "mode") === "pagina" ? "pagina" : "grupo";
  const groupJids = f.getAll("groups").map(String).filter(Boolean);
  if (!question || options.length < 2) redirect("/votacoes?erro=campos");
  const images: string[] = [];
  for (const file of f.getAll("images")) {
    if (file instanceof File && file.size > 0) images.push((await saveUpload(file)).url);
  }
  const poll = await db.poll.create({ data: { question, options, mode, groupJids, imageUrls: images, createdBy: s.name } });
  if (mode === "grupo") {
    for (const jid of groupJids) {
      await evolution.sendPoll(jid, question, options, 1);
      await new Promise((r) => setTimeout(r, 2500));
    }
  } else if (groupJids.length) {
    // Página fechada: manda o link nos grupos
    await enqueue("poll-link", { pollId: poll.id }, { jobId: `poll-${poll.id}` });
  }
  revalidatePath("/votacoes");
  redirect(`/votacoes?ok=${poll.id}`);
}
export async function closePoll(f: FormData) {
  await auth();
  await db.poll.update({ where: { id: str(f, "id") }, data: { status: "fechada" } });
  revalidatePath("/votacoes");
}

// Leva os leads marcados para a tela de disparo (lista pronta)
export async function leadsToBroadcast(f: FormData) {
  await auth();
  const phones = [...new Set(f.getAll("sel").map(String).map((p) => normalizePhone(p)).filter(Boolean))] as string[];
  if (!phones.length) redirect("/leads");
  await db.setting.upsert({ where: { key: "_disparo_lista" }, create: { key: "_disparo_lista", value: { phones, at: Date.now() } }, update: { value: { phones, at: Date.now() } } });
  redirect("/disparos?lista=1");
}

// Manda a mensagem para o próprio número conectado, para conferir antes de disparar
export async function sendBroadcastTest(f: FormData) {
  const s = await auth();
  const text = str(f, "text");
  if (!text) redirect("/disparos?erro=campos");
  const me = await evolution.ownerPhone();
  if (!me) redirect("/disparos?erro=numero");
  const body = text.replace(/\{nome\}/g, s.name.split(" ")[0]) + "\n\n(teste do disparo)";
  const file = f.get("media");
  if (file instanceof File && file.size > 0) {
    const up = await saveUpload(file);
    await evolution.sendMedia(me!, { url: up.url, type: up.type, caption: body });
  } else {
    await evolution.sendText(me!, body);
  }
  redirect("/disparos?teste=1");
}

// Votação: vira tarefa de produção ou pré-venda para quem votou na opção vencedora
export async function pollToTask(f: FormData) {
  const s = await auth();
  const p = await db.poll.findUnique({ where: { id: str(f, "id") }, include: { votes: true } });
  if (!p) redirect("/votacoes");
  const counts = p!.options.map((_, i) => p!.votes.filter((v) => v.option === i).length);
  const win = counts.indexOf(Math.max(...counts));
  await db.task.create({ data: { title: `Produzir: ${p!.options[win]}`, description: `Venceu a votação "${p!.question}" com ${counts[win]} votos de ${p!.votes.length}.`, priority: "alta", createdBy: s.name } });
  redirect(`/votacoes?id=${p!.id}&tarefa=1`);
}
export async function pollToPresale(f: FormData) {
  await auth();
  const p = await db.poll.findUnique({ where: { id: str(f, "id") }, include: { votes: true } });
  if (!p) redirect("/votacoes");
  const counts = p!.options.map((_, i) => p!.votes.filter((v) => v.option === i).length);
  const win = counts.indexOf(Math.max(...counts));
  const phones = p!.votes.filter((v) => v.option === win).map((v) => v.phone);
  await db.setting.upsert({ where: { key: "_disparo_lista" }, create: { key: "_disparo_lista", value: { phones, at: Date.now() } }, update: { value: { phones, at: Date.now() } } });
  redirect("/disparos?lista=1");
}
