// Envio das votações: enquete do WhatsApp no grupo, ou o link da página fechada
import { db } from "./db";
import { evolution } from "./evolution";
import { enqueue } from "./queue";

export async function dispatchPoll(id: string) {
  const poll = await db.poll.findUnique({ where: { id } });
  if (!poll) return;
  if (poll.mode === "grupo") {
    for (const jid of await (await import("./send")).sendableJids(poll.groupJids)) {
      await evolution.sendPoll(jid, poll.question, poll.options, 1);
      await new Promise((r) => setTimeout(r, 2500));
    }
  } else if (poll.groupJids.length) {
    await enqueue("poll-link", { pollId: poll.id }, { jobId: `poll-${poll.id}` });
  }
}

// Votações agendadas que chegaram na hora (roda a cada minuto no worker)
export async function duePolls() {
  const due = await db.poll.findMany({ where: { status: "agendada", sendAt: { lte: new Date() } }, take: 10 });
  for (const p of due) {
    const r = await db.poll.updateMany({ where: { id: p.id, status: "agendada" }, data: { status: "aberta" } });
    if (r.count) await dispatchPoll(p.id).catch((e) => console.error("[votação agendada]", p.id, e));
  }
}
