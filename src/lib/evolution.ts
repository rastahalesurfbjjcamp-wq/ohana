// Cliente da Evolution API v2 (WhatsApp dos grupos).
import { env } from "./env";

type Json = Record<string, unknown>;

async function call<T = unknown>(method: "GET" | "POST" | "DELETE" | "PUT", path: string, body?: Json, timeoutMs = 120_000): Promise<T> {
  const res = await fetch(`${env.evolutionUrl().replace(/\/$/, "")}${path}`, {
    method,
    headers: { "Content-Type": "application/json", apikey: env.evolutionKey() },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* resposta em texto */
  }
  if (!res.ok) {
    throw new Error(`Evolution ${method} ${path} respondeu ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data as T;
}

const inst = () => encodeURIComponent(env.evolutionInstance());

export const WEBHOOK_EVENTS = [
  "CONNECTION_UPDATE",
  "QRCODE_UPDATED",
  "GROUPS_UPSERT",
  "GROUP_UPDATE",
  "GROUP_PARTICIPANTS_UPDATE",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
];
export const WEBHOOK_VERSION = 2;

export function webhookUrl() {
  return `${env.internalUrl().replace(/\/$/, "")}/api/webhooks/evolution?secret=${encodeURIComponent(env.webhookSecret())}`;
}

export const evolution = {
  async createInstance() {
    return call("POST", "/instance/create", {
      instanceName: env.evolutionInstance(),
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      groupsIgnore: false,
      webhook: { url: webhookUrl(), byEvents: false, base64: true, events: WEBHOOK_EVENTS },
    });
  },

  async setWebhook() {
    return call("POST", `/webhook/set/${inst()}`, {
      webhook: { enabled: true, url: webhookUrl(), byEvents: false, base64: true, events: WEBHOOK_EVENTS },
    });
  },

  async connectionState(): Promise<string> {
    try {
      const r = await call<{ instance?: { state?: string } }>("GET", `/instance/connectionState/${inst()}`);
      return r?.instance?.state ?? "unknown";
    } catch (e) {
      if (String(e).includes("404")) return "not_created";
      throw e;
    }
  },

  // Retorna o QR code em base64 (imagem) para conectar o número
  async connect(): Promise<{ base64?: string; pairingCode?: string; code?: string }> {
    return call("GET", `/instance/connect/${inst()}`);
  },

  async logout() {
    return call("DELETE", `/instance/logout/${inst()}`);
  },

  // Número do WhatsApp conectado
  async ownerPhone(): Promise<string | null> {
    try {
      const r = await call<{ ownerJid?: string; owner?: string; instance?: { owner?: string } }[]>("GET", `/instance/fetchInstances?instanceName=${inst()}`);
      const i = Array.isArray(r) ? r[0] : (r as unknown as { ownerJid?: string; owner?: string; instance?: { owner?: string } });
      const jid = i?.ownerJid ?? i?.owner ?? i?.instance?.owner ?? "";
      return jid ? jid.split("@")[0].split(":")[0].replace(/\D/g, "") : null;
    } catch {
      return null;
    }
  },

  async fetchAllGroups(withParticipants = true): Promise<EvoGroup[]> {
    return call("GET", `/group/fetchAllGroups/${inst()}?getParticipants=${withParticipants}`, undefined, withParticipants ? 180_000 : 90_000);
  },

  // Membros de um grupo só (usado quando a lista completa com membros demora demais)
  async groupParticipants(groupJid: string): Promise<EvoParticipant[]> {
    const r = await call<{ participants?: EvoParticipant[] }>("GET", `/group/participants/${inst()}?groupJid=${encodeURIComponent(groupJid)}`, undefined, 60_000);
    return r?.participants ?? [];
  },

  async inviteCode(groupJid: string): Promise<string | undefined> {
    const r = await call<{ inviteCode?: string }>("GET", `/group/inviteCode/${inst()}?groupJid=${encodeURIComponent(groupJid)}`);
    return r?.inviteCode;
  },

  async createGroup(subject: string, participants: string[], description?: string) {
    return call("POST", `/group/create/${inst()}`, { subject, participants, description });
  },

  // Texto, com opção de marcar todos os membros do grupo
  async sendText(to: string, text: string, opts: { mentionAll?: boolean; delayMs?: number } = {}) {
    return call("POST", `/message/sendText/${inst()}`, {
      number: to,
      text,
      delay: opts.delayMs ?? 1200,
      mentionsEveryOne: !!opts.mentionAll,
    });
  },

  // Áudio como se fosse gravado na hora (mensagem de voz)
  async sendAudio(to: string, url: string, opts: { delayMs?: number } = {}) {
    return call("POST", `/message/sendWhatsAppAudio/${inst()}`, { number: to, audio: url, delay: opts.delayMs ?? 1500 });
  },

  async sendMedia(
    to: string,
    media: { url: string; type: "image" | "video" | "document"; caption?: string; fileName?: string; mimetype?: string },
    opts: { mentionAll?: boolean; delayMs?: number } = {},
  ) {
    // arquivo enviado no Hub: vai em base64 (a Evolution recusa o link interno do servidor)
    const own = media.url.match(/\/api\/media\/([a-f0-9-]{36}\.[a-z0-9]{2,5})$/);
    if (own) {
      const { readFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const { uploadDir, mimeFor } = await import("./uploads");
      const buf = await readFile(path.join(uploadDir(), own[1])).catch(() => null);
      if (buf) media = { ...media, url: buf.toString("base64"), mimetype: media.mimetype ?? mimeFor(own[1]), fileName: media.fileName ?? own[1] };
      else throw new Error("O arquivo anexado não está mais no servidor. Abra a mensagem, anexe o arquivo de novo e salve.");
    }
    return call("POST", `/message/sendMedia/${inst()}`, {
      number: to,
      mediatype: media.type,
      mimetype: media.mimetype,
      caption: media.caption ?? "",
      media: media.url,
      fileName: media.fileName,
      delay: opts.delayMs ?? 1500,
      mentionsEveryOne: !!opts.mentionAll,
    });
  },

  // Gestão dos grupos (nome, descrição, foto e quem pode mandar mensagem)
  async updateSubject(groupJid: string, subject: string) {
    return call("POST", `/group/updateGroupSubject/${inst()}?groupJid=${encodeURIComponent(groupJid)}`, { subject });
  },
  async updateDescription(groupJid: string, description: string) {
    return call("POST", `/group/updateGroupDescription/${inst()}?groupJid=${encodeURIComponent(groupJid)}`, { description });
  },
  async updatePicture(groupJid: string, image: string) {
    return call("POST", `/group/updateGroupPicture/${inst()}?groupJid=${encodeURIComponent(groupJid)}`, { image });
  },
  async updateSetting(groupJid: string, action: "announcement" | "not_announcement" | "locked" | "unlocked") {
    return call("POST", `/group/updateSetting/${inst()}?groupJid=${encodeURIComponent(groupJid)}`, { action });
  },

  async sendPoll(to: string, name: string, values: string[], selectableCount = 1) {
    return call("POST", `/message/sendPoll/${inst()}`, { number: to, name, values, selectableCount });
  },

  // Baixa a mídia de uma mensagem recebida (ex.: áudio) em base64
  async mediaBase64(messageKeyId: string): Promise<{ base64: string; mimetype?: string }> {
    return call("POST", `/chat/getBase64FromMediaMessage/${inst()}`, {
      message: { key: { id: messageKeyId } },
      convertToMp4: false,
    });
  },
};

export type EvoParticipant = string | { id?: string; phoneNumber?: string; jid?: string; admin?: string | null };

export interface EvoGroup {
  id: string;
  subject: string;
  desc?: string;
  size?: number;
  participants?: EvoParticipant[];
  isCommunity?: boolean;
  isCommunityAnnounce?: boolean;
  linkedParent?: string | null;
  announce?: boolean;
}
