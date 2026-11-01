// Envia as mensagens agendadas do atendimento na hora certa, ou cancela se a conversa andou
import { db } from "./db";
import { reserveSlot, sendText } from "./send";
import { fill } from "./automations";

export async function runChatSchedules() {
  const due = await db.chatSchedule.findMany({ where: { status: "agendada", at: { lte: new Date() } }, take: 20, orderBy: { at: "asc" } });
  for (const m of due) {
    const thread = await db.chatThread.findUnique({ where: { phone: m.phone } });
    let cancel = "";
    if (m.cancelOnArchive && thread?.status === "resolvido") cancel = "conversa arquivada";
    if (!cancel && (m.cancelOnReply || m.cancelOnAgent)) {
      const after = await db.chatMessage.findMany({ where: { phone: m.phone, createdAt: { gt: m.createdAt }, by: { not: "nota" } }, select: { fromMe: true, by: true } });
      if (m.cancelOnReply && after.some((x) => !x.fromMe)) cancel = "o cliente escreveu";
      else if (m.cancelOnAgent && after.some((x) => x.fromMe && x.by === "equipe")) cancel = "a equipe escreveu";
    }
    if (cancel) { await db.chatSchedule.update({ where: { id: m.id }, data: { status: "cancelada", note: cancel } }); continue; }
    if ((await reserveSlot()) > 0) break;
    try {
      const text = fill(m.text, { nome: thread?.name ?? "" });
      await sendText(m.phone, text);
      await db.chatMessage.create({ data: { phone: m.phone, fromMe: true, by: "equipe", text } });
      await db.chatThread.update({ where: { phone: m.phone }, data: { lastText: text.slice(0, 200), lastAt: new Date() } }).catch(() => null);
      await db.chatSchedule.update({ where: { id: m.id }, data: { status: "enviada" } });
    } catch (e) {
      await db.chatSchedule.update({ where: { id: m.id }, data: { status: "erro", note: String(e).slice(0, 160) } });
    }
  }
}
