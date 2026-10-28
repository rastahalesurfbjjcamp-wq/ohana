// Conversões entre JID do WhatsApp e número.

export function jidToPhone(jid: string | undefined | null): string {
  if (!jid) return "";
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "");
}

export function phoneToJid(phone: string): string {
  return `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}

// A Evolution pode mandar o participante como texto ("5521...@s.whatsapp.net")
// ou como objeto ({ id, phoneNumber, jid }). Em grupos novos o id pode vir em formato LID.
export function participantPhone(p: unknown): string {
  if (typeof p === "string") return jidToPhone(p);
  if (p && typeof p === "object") {
    const o = p as Record<string, unknown>;
    const cand = (o.phoneNumber ?? o.jid ?? o.id) as string | undefined;
    return jidToPhone(cand);
  }
  return "";
}

export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    return `(${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
  }
  return `+${d}`;
}
