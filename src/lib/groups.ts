// Sincronização dos grupos e registro de entradas e saídas.
import { db } from "./db";
import { evolution, type EvoGroup } from "./evolution";
import { participantPhone } from "./phone";
import { enqueue } from "./queue";
import { getSettings } from "./settings";
import { sendText } from "./send";

async function upsertContact(phone: string, name?: string | null) {
  return db.contact.upsert({
    where: { phone },
    create: { phone, name: name ?? undefined },
    update: name ? { name } : {},
  });
}

// Lê todos os grupos do número conectado e atualiza o banco.
// Na primeira vez não gera eventos (só fotografa quem já está).
export async function syncGroups() {
  const groups: EvoGroup[] = await evolution.fetchAllGroups(true);
  let created = 0;
  for (const g of groups) {
    const existing = await db.group.findUnique({ where: { jid: g.id } });
    const group = await db.group.upsert({
      where: { jid: g.id },
      create: { jid: g.id, name: g.subject ?? g.id, description: g.desc, size: g.size ?? g.participants?.length ?? 0 },
      update: { name: g.subject ?? g.id, description: g.desc, size: g.size ?? g.participants?.length ?? 0, archived: false },
    });
    if (!existing) created++;

    const phones = new Set<string>();
    for (const p of g.participants ?? []) {
      const phone = participantPhone(p);
      if (!phone) continue;
      phones.add(phone);
      const contact = await upsertContact(phone);
      const isAdmin = typeof p === "object" && !!(p as { admin?: string | null }).admin;
      await db.membership.upsert({
        where: { groupId_contactId: { groupId: group.id, contactId: contact.id } },
        create: { groupId: group.id, contactId: contact.id, isAdmin },
        update: { isAdmin, leftAt: null },
      });
    }

    // Quem estava no banco e não está mais no grupo (saiu enquanto o sistema estava fora)
    if (existing && phones.size) {
      const active = await db.membership.findMany({ where: { groupId: group.id, leftAt: null }, include: { contact: true } });
      for (const m of active) {
        if (!phones.has(m.contact.phone)) {
          await db.membership.update({ where: { id: m.id }, data: { leftAt: new Date() } });
        }
      }
    }
    if (g.id && !group.inviteCode) {
      try {
        const code = await evolution.inviteCode(g.id);
        if (code) await db.group.update({ where: { id: group.id }, data: { inviteCode: code } });
      } catch {
        /* o número precisa ser admin para ler o convite */
      }
    }
  }
  return { total: groups.length, created };
}

// Evento "group-participants.update" da Evolution
export async function handleParticipants(groupJid: string, participants: unknown[], action: string, author?: string) {
  let group = await db.group.findUnique({ where: { jid: groupJid } });
  if (!group) {
    group = await db.group.create({ data: { jid: groupJid, name: groupJid } });
    enqueue("sync-groups", {}, { jobId: `sync-${Date.now()}` }).catch(() => {});
  }
  const authorPhone = participantPhone(author);

  for (const p of participants) {
    const phone = participantPhone(p);
    if (!phone) continue;
    const contact = await upsertContact(phone);

    if (action === "add") {
      const prev = await db.membership.findUnique({ where: { groupId_contactId: { groupId: group.id, contactId: contact.id } } });
      // Voltou: saiu nos últimos 60 dias de qualquer grupo e entrou de novo
      const leftRecently = await db.memberEvent.findFirst({
        where: { contactId: contact.id, type: "LEAVE", createdAt: { gte: new Date(Date.now() - 60 * 864e5) } },
      });
      await db.membership.upsert({
        where: { groupId_contactId: { groupId: group.id, contactId: contact.id } },
        create: { groupId: group.id, contactId: contact.id },
        update: { leftAt: null, joinedAt: prev?.leftAt ? new Date() : prev?.joinedAt },
      });
      await db.memberEvent.create({ data: { type: leftRecently ? "RETURN" : "JOIN", groupId: group.id, contactId: contact.id } });
      await db.group.update({ where: { id: group.id }, data: { size: { increment: 1 } } });
    }

    if (action === "remove") {
      const byAdmin = !!authorPhone && authorPhone !== phone;
      await db.membership.updateMany({ where: { groupId: group.id, contactId: contact.id, leftAt: null }, data: { leftAt: new Date() } });
      const ev = await db.memberEvent.create({ data: { type: "LEAVE", groupId: group.id, contactId: contact.id, byAdmin } });
      await db.group.update({ where: { id: group.id }, data: { size: { decrement: 1 } } });

      const s = await getSettings();
      if (s.winback.enabled && group.isCommunity && !(byAdmin && s.winback.onlyIfNotRemovedByAdmin)) {
        await enqueue("winback", { eventId: ev.id }, { delayMs: s.winback.delayMinutes * 60_000, jobId: `winback-${ev.id}` });
      }
    }

    if (action === "promote" || action === "demote") {
      await db.membership.updateMany({ where: { groupId: group.id, contactId: contact.id }, data: { isAdmin: action === "promote" } });
    }
  }
}

// Mensagem de volta para quem saiu
export async function sendWinback(eventId: string) {
  const ev = await db.memberEvent.findUnique({ where: { id: eventId }, include: { contact: true, group: true } });
  if (!ev || ev.winbackSent) return;
  // Se já voltou para algum grupo, não manda
  const back = await db.membership.findFirst({ where: { contactId: ev.contactId, leftAt: null, group: { isCommunity: true } } });
  if (back) return;
  const s = await getSettings();
  const link = ev.group.inviteCode ? `https://chat.whatsapp.com/${ev.group.inviteCode}` : "";
  const first = (ev.contact.name ?? "").split(" ")[0] || "tudo bem";
  const text = s.winback.text.replace("{nome}", first).replace("{grupo}", ev.group.name).replace("{link}", link).trim();
  await sendText(ev.contact.phone, text);
  await db.memberEvent.update({ where: { id: ev.id }, data: { winbackSent: true } });
}
