// Worker do Hub: agendamentos, relatórios, mensagem de volta e comandos do grupo de resultados.
// Roda num serviço separado do painel (npm run worker).
import { Worker, type Job } from "bullmq";
import { db } from "../lib/db";
import { redis, queue, enqueue } from "../lib/queue";
import { syncGroups, sendWinback } from "../lib/groups";
import { dailyReport, weeklyReport } from "../lib/report";
import { handleCommand } from "../lib/commands";
import { transcribe } from "../lib/ai";
import { evolution } from "../lib/evolution";
import { getSettings } from "../lib/settings";
import { humanDelay, reserveSlot, sendMedia, sendText, sentByBot } from "../lib/send";
import { hhmmLocal, isoDayLocal, nowLocal } from "../lib/time";

type Marks = { daily?: string; weekly?: string; sync?: number };

async function getMarks(): Promise<Marks> {
  const r = await db.setting.findUnique({ where: { key: "_marks" } });
  return (r?.value as Marks) ?? {};
}
async function setMarks(m: Marks) {
  const cur = await getMarks();
  const value = { ...cur, ...m };
  await db.setting.upsert({ where: { key: "_marks" }, create: { key: "_marks", value }, update: { value } });
}

async function resultsGroups() {
  return db.group.findMany({ where: { isResults: true, archived: false } });
}

async function postToResults(text: string) {
  for (const g of await resultsGroups()) await sendText(g.jid, text);
}

// Roda a cada minuto
async function tick() {
  // 1. Agendamentos que chegaram na hora
  const due = await db.scheduledMessage.findMany({ where: { status: "SCHEDULED", sendAt: { lte: new Date() } }, take: 20 });
  for (const m of due) {
    const r = await db.scheduledMessage.updateMany({ where: { id: m.id, status: "SCHEDULED" }, data: { status: "SENDING" } });
    if (r.count) await enqueue("send-scheduled", { id: m.id }, { jobId: `send-${m.id}-${m.sendAt.getTime()}` });
  }

  const s = await getSettings();
  const marks = await getMarks();
  const today = isoDayLocal();
  const hhmm = hhmmLocal();

  // 2. Relatório diário
  if (s.report.enabled && hhmm >= s.report.time && marks.daily !== today) {
    await setMarks({ daily: today });
    await enqueue("daily-report", { day: today }, { jobId: `daily-${today}` });
  }

  // 3. Resumo semanal
  if (s.report.weeklyEnabled && nowLocal().getDay() === s.report.weeklyDay && hhmm >= s.report.weeklyTime && marks.weekly !== today) {
    await setMarks({ weekly: today });
    await postToResults(await weeklyReport());
  }

  // 4. Sincroniza os grupos a cada 6 horas (pega quem saiu com o sistema fora do ar)
  if (!marks.sync || Date.now() - marks.sync > 6 * 3600_000) {
    await setMarks({ sync: Date.now() });
    await enqueue("sync-groups", {}, { jobId: `sync-tick-${today}-${hhmm}` });
  }
}

async function sendScheduled(id: string, job: Job) {
  const m = await db.scheduledMessage.findUnique({ where: { id } });
  if (!m || m.status !== "SENDING") return;
  const done = new Set<string>(((job.data as { done?: string[] }).done ?? []) as string[]);
  try {
    for (const jid of m.groupJids) {
      if (done.has(jid)) continue;
      const wait = await reserveSlot();
      if (wait > 0) {
        // passou do limite da hora: continua depois, sem repetir os grupos que já receberam
        await enqueue("send-scheduled", { id, done: [...done] }, { delayMs: wait, jobId: `send-${id}-${Date.now()}` });
        return;
      }
      if (m.mediaUrl && m.mediaType) {
        await sendMedia(jid, { url: m.mediaUrl, type: m.mediaType as "image" | "video" | "document", caption: m.text }, { mentionAll: m.mentionAll });
      } else {
        await sendText(jid, m.text, { mentionAll: m.mentionAll });
      }
      done.add(jid);
      await job.updateData({ ...job.data, done: [...done] });
      await humanDelay();
    }
    if (m.repeat === "daily" || m.repeat === "weekly") {
      const next = new Date(m.sendAt.getTime() + (m.repeat === "daily" ? 1 : 7) * 864e5);
      await db.scheduledMessage.update({ where: { id }, data: { status: "SCHEDULED", sendAt: next, sentCount: { increment: done.size }, error: null } });
    } else {
      await db.scheduledMessage.update({ where: { id }, data: { status: "SENT", sentCount: { increment: done.size }, error: null } });
    }
  } catch (e) {
    await db.scheduledMessage.update({ where: { id }, data: { status: "FAILED", error: String(e).slice(0, 500) } });
    throw e;
  }
}

type CommandJob = {
  groupJid: string;
  messageId: string;
  fromMe: boolean;
  fromPhone: string;
  text: string;
  audio: { mimetype: string; base64: string | null } | null;
};

async function runCommand(d: CommandJob) {
  if (d.fromMe && (await sentByBot(d.messageId))) return; // foi o próprio sistema que mandou

  // Só números autorizados (cadastrados nos acessos) ou o próprio número conectado
  if (!d.fromMe) {
    const users = await db.user.findMany({ where: { phone: { not: null } }, select: { phone: true } });
    const ok = users.some((u) => u.phone && (u.phone === d.fromPhone || u.phone.endsWith(d.fromPhone.slice(-8))));
    if (!ok) return;
  }
  const from = d.fromMe ? "dono" : d.fromPhone;

  let text = d.text;
  if (d.audio) {
    try {
      const b64 = d.audio.base64 ?? (await evolution.mediaBase64(d.messageId)).base64;
      text = await transcribe(b64, d.audio.mimetype);
    } catch (e) {
      console.error("[transcrição]", e);
      await sendText(d.groupJid, "Não consegui ouvir esse áudio. Pode mandar por escrito?");
      return;
    }
  }

  try {
    const reply = await handleCommand(from, text, !!d.audio);
    if (reply) await sendText(d.groupJid, reply);
  } catch (e) {
    console.error("[comando]", e);
    await db.commandLog.create({ data: { fromPhone: from, input: text, wasAudio: !!d.audio, status: "error", reply: String(e).slice(0, 500) } });
    await sendText(d.groupJid, "Deu um erro ao fazer isso. Tente de novo em alguns minutos.");
  }
}

async function main() {
  const worker = new Worker(
    "hub",
    async (job) => {
      switch (job.name) {
        case "tick":
          return tick();
        case "send-scheduled":
          return sendScheduled(job.data.id, job);
        case "winback":
          return sendWinback(job.data.eventId);
        case "sync-groups":
          return syncGroups();
        case "daily-report":
          return postToResults(await dailyReport(job.data.day, { withTip: true }));
        case "command":
          return runCommand(job.data as CommandJob);
      }
    },
    { connection: redis(), concurrency: 4 },
  );

  worker.on("failed", (job, err) => console.error(`[job ${job?.name}]`, err.message));

  await queue().upsertJobScheduler("tick-every-minute", { every: 60_000 }, { name: "tick" });
  console.log("Worker do Hub rodando");

  const stop = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
