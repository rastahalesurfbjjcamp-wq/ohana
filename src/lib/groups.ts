// Sincronização dos grupos e registro de entradas e saídas.
import { db } from "./db";
import { evolution, type EvoGroup } from "./evolution";
import { participantPhone } from "./phone";
import { enqueue } from "./queue";
import { getSettings } from "./settings";
import { sendText } from "./send";
import { env } from "./env";

async function upsertContact(phone: string, name?: string | null) {
  return db.contact.upsert({
    where: { phone },
    create: { phone, name: name ?? undefined },
    update: name ? { name } : {},
  });
}

// Freio de segurança: o WhatsApp limita o número quando recebe muitos pedidos de grupos seguidos.
// Sincroniza no máximo a cada 30 min (5 min se for o botão do painel) e, se o WhatsApp
// responder "rate-overlimit", fica 2 horas sem pedir nada de grupos.
const SYNC_KEY = "_sync_groups_guard";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function guard(manual: boolean): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: SYNC_KEY } });
  const v = (row?.value ?? {}) as { at?: number; pauseUntil?: number };
  const now = Date.now();
  if (v.pauseUntil && now < v.pauseUntil) return `pausado até ${new Date(v.pauseUntil).toISOString()}`;
  if (v.at && now - v.at < (manual ? 5 : 30) * 60_000) return "sincronizado há pouco";
  await db.setting.upsert({ where: { key: SYNC_KEY }, create: { key: SYNC_KEY, value: { at: now } }, update: { value: { ...v, at: now } } });
  return null;
}
async function pauseSync(e: unknown) {
  if (!/rate-overlimit|429|too many/i.test(String(e))) return;
  const row = await db.setting.findUnique({ where: { key: SYNC_KEY } });
  const v = (row?.value ?? {}) as object;
  await db.setting.upsert({ where: { key: SYNC_KEY }, create: { key: SYNC_KEY, value: { pauseUntil: Date.now() + 2 * 3600_000 } }, update: { value: { ...v, pauseUntil: Date.now() + 2 * 3600_000 } } });
  console.warn("[grupos] WhatsApp pediu calma (rate-overlimit). Grupos ficam 2h sem sincronizar.");
}

// Lê todos os grupos do número conectado e atualiza o banco.
// Na primeira vez não gera eventos (só fotografa quem já está).
export async function syncGroups(opts: { manual?: boolean } = {}) {
  const skip = await guard(!!opts.manual);
  if (skip) { console.log("[grupos] sincronização pulada:", skip); return { total: 0, created: 0, skipped: skip }; }
  try {
    return await doSync();
  } catch (e) {
    await pauseSync(e);
    throw e;
  }
}

async function doSync() {
  // Número com muitos grupos grandes: a lista completa com membros pode estourar o tempo.
  // Nesse caso busca a lista sem membros e depois os membros de cada grupo, um por um.
  let groups: EvoGroup[];
  try {
    groups = await evolution.fetchAllGroups(true);
  } catch (e) {
    console.error("[grupos] lista completa falhou, buscando um por um:", String(e).slice(0, 160));
    await pauseSync(e);
    if (/rate-overlimit/i.test(String(e))) throw e;
    groups = await evolution.fetchAllGroups(false);
    // membros um por um só dos grupos que o Hub cuida, com pausa entre eles
    const cared = new Set((await db.group.findMany({ where: { isCommunity: true }, select: { jid: true } })).map((x) => x.jid));
    for (const g of groups) {
      if (g.isCommunity || !cared.has(g.id)) continue; // a comunidade em si não tem membros próprios
      await wait(3000 + Math.random() * 3000);
      try {
        g.participants = await evolution.groupParticipants(g.id);
      } catch (err) {
        if (/rate-overlimit/i.test(String(err))) { await pauseSync(err); break; }
      }
    }
  }
  const me = await evolution.ownerPhone();
  let created = 0;
  for (const g of groups) {
    const existing = await db.group.findUnique({ where: { jid: g.id } });
    const mine = (g.participants ?? []).find((p) => me && participantPhone(p) === me);
    const iAmAdmin = !!mine && typeof mine === "object" && !!(mine as { admin?: string | null }).admin;
    const kind = g.isCommunity ? "comunidade" : g.isCommunityAnnounce ? "avisos" : "grupo";
    const meta = { name: g.subject ?? g.id, description: g.desc, size: g.size ?? g.participants?.length ?? existing?.size ?? 0, iAmAdmin: g.participants ? iAmAdmin : existing?.iAmAdmin ?? false, kind, parentJid: g.linkedParent ?? null };
    const group = await db.group.upsert({
      where: { jid: g.id },
      create: { jid: g.id, ...meta },
      update: { ...meta, archived: false },
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
    if (g.id && !group.inviteCode && group.iAmAdmin && group.isCommunity) {
      try {
        const code = await evolution.inviteCode(g.id);
        if (code) await db.group.update({ where: { id: group.id }, data: { inviteCode: code } });
      } catch {
        /* o número precisa ser admin para ler o convite */
      }
    }
  }
  // Grupos de que o número saiu ficam arquivados
  if (groups.length) await db.group.updateMany({ where: { jid: { notIn: groups.map((g) => g.id) }, archived: false }, data: { archived: true, isCommunity: false, isResults: false } });
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
      if (group.isCommunity) await import("./funnels").then((m) => m.funnelEvent("entrou_grupo", phone, contact.name)).catch(() => {});
      await db.group.update({ where: { id: group.id }, data: { size: { increment: 1 } } });
    }

    if (action === "remove") {
      const byAdmin = !!authorPhone && authorPhone !== phone;
      await db.membership.updateMany({ where: { groupId: group.id, contactId: contact.id, leftAt: null }, data: { leftAt: new Date() } });
      const ev = await db.memberEvent.create({ data: { type: "LEAVE", groupId: group.id, contactId: contact.id, byAdmin } });
      if (group.isCommunity && !byAdmin) await import("./funnels").then((m) => m.funnelEvent("saiu_grupo", phone, contact.name)).catch(() => {});
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
  const text = s.winback.text.replace("{loja}", env.storeName()).replace("{nome}", first).replace("{grupo}", ev.group.name).replace("{link}", link).trim();
  await sendText(ev.contact.phone, text);
  await db.memberEvent.update({ where: { id: ev.id }, data: { winbackSent: true } });
}
