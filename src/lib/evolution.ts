// Cliente da Evolution API v2 (WhatsApp dos grupos).
import { env } from "./env";

type Json = Record<string, unknown>;

async function call<T = unknown>(method: "GET" | "POST" | "DELETE" | "PUT", path: string, body?: Json): Promise<T> {
  const res = await fetch(`${env.evolutionUrl().replace(/\/$/, "")}${path}`, {
    method,
    headers: { "Content-Type": "application/json", apikey: env.evolutionKey() },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
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
];

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

  async fetchAllGroups(withParticipants = true): Promise<EvoGroup[]> {
    return call("GET", `/group/fetchAllGroups/${inst()}?getParticipants=${withParticipants}`);
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

  async sendMedia(
    to: string,
    media: { url: string; type: "image" | "video" | "document"; caption?: string; fileName?: string; mimetype?: string },
    opts: { mentionAll?: boolean; delayMs?: number } = {},
  ) {
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
}
