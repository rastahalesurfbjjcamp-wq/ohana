// Tarefas da etapa 2: disparos, link de votação e boas-vindas dos leads.
import { db } from "../lib/db";
import { enqueue } from "../lib/queue";
import { env } from "../lib/env";
import { getSettings } from "../lib/settings";
import { humanDelay, reserveSlot, sendMedia, sendText } from "../lib/send";
import { redirectLink } from "../lib/redirect";

const first = (n?: string | null) => (n ?? "").trim().split(" ")[0] || "tudo bem";
const fill = (t: string, name?: string | null) => t.replace(/\{nome\}/g, first(name)).replace(/\{loja\}/g, env.storeName()).replace(/\{link\}/g, redirectLink());

export async function dueBroadcasts() {
  const due = await db.broadcast.findMany({ where: { status: "SCHEDULED", sendAt: { lte: new Date() } }, take: 5 });
  for (const b of due) {
    const r = await db.broadcast.updateMany({ where: { id: b.id, status: "SCHEDULED" }, data: { status: "SENDING" } });
    if (r.count) await enqueue("broadcast", { id: b.id }, { jobId: `bc-${b.id}-${Date.now()}` });
  }
}

// Manda em lotes de até 25 e se reagenda, respeitando o limite por hora
export async function runBroadcast(id: string) {
  const b = await db.broadcast.findUnique({ where: { id } });
  if (!b || b.status !== "SENDING") return;
  const batch = await db.broadcastRecipient.findMany({ where: { broadcastId: id, status: "pendente" }, take: 25 });
  if (!batch.length) {
    await db.broadcast.update({ where: { id }, data: { status: "DONE" } });
    return;
  }
  const opted = new Set((await db.optOut.findMany({ where: { phone: { in: batch.map((r) => r.phone) } } })).map((o) => o.phone));
  for (const r of batch) {
    const fresh = await db.broadcast.findUnique({ where: { id }, select: { status: true } });
    if (fresh?.status !== "SENDING") return; // pausado ou cancelado
    if (opted.has(r.phone)) {
      await db.broadcastRecipient.update({ where: { id: r.id }, data: { status: "pulado" } });
      continue;
    }
    const wait = await reserveSlot();
    if (wait > 0) {
      await enqueue("broadcast", { id }, { delayMs: wait, jobId: `bc-${id}-${Date.now()}` });
      return;
    }
    // "{texto}": mensagem já pronta por pessoa (ex.: códigos do Indique e ganhe)
    const body = b.text === "{texto}" ? r.name ?? "" : fill(b.text, r.name);
    const text = `${body}\n\n_Para não receber mais, responda SAIR._`;
    try {
      if (b.mediaUrl && b.mediaType) await sendMedia(r.phone, { url: b.mediaUrl, type: b.mediaType as "image" | "video" | "document", caption: text });
      else await sendText(r.phone, text);
      await db.broadcastRecipient.update({ where: { id: r.id }, data: { status: "enviado", sentAt: new Date() } });
      await db.broadcast.update({ where: { id }, data: { sent: { increment: 1 } } });
    } catch (e) {
      await db.broadcastRecipient.update({ where: { id: r.id }, data: { status: "falhou", error: String(e).slice(0, 200) } });
      await db.broadcast.update({ where: { id }, data: { failed: { increment: 1 } } });
    }
    await humanDelay();
  }
  await enqueue("broadcast", { id }, { jobId: `bc-${id}-${Date.now()}`, delayMs: 1000 });
}

export async function sendPollLink(pollId: string) {
  const poll = await db.poll.findUnique({ where: { id: pollId } });
  if (!poll) return;
  const link = `${env.appUrl().replace(/\/$/, "")}/votar/${poll.id}`;
  for (const jid of poll.groupJids) {
    await sendText(jid, `*${poll.question}*\n\nVotação exclusiva da comunidade. Vote aqui: ${link}`, { mentionAll: true });
    await humanDelay();
  }
}

export async function leadWelcome(leadId: string) {
  const s = await getSettings();
  if (!s.leads.welcomeEnabled) return;
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.welcomeSent || lead.status === "descadastrado") return;
  if (await db.optOut.findUnique({ where: { phone: lead.phone } })) return;
  await sendText(lead.phone, fill(s.leads.welcomeText, lead.name));
  await db.lead.update({ where: { id: lead.id }, data: { welcomeSent: true } });
}
