// Recebe os eventos da Evolution API (entradas e saídas, mensagens, conexão).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { handleParticipants } from "@/lib/groups";
import { enqueue } from "@/lib/queue";
import { jidToPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

type Evt = { event?: string; instance?: string; data?: Record<string, unknown> | Record<string, unknown>[] };

// "group-participants.update" e "GROUP_PARTICIPANTS_UPDATE" viram a mesma coisa
const norm = (e = "") => e.toLowerCase().replace(/[._-]/g, "");

function messageText(m: Record<string, unknown> | undefined): string {
  if (!m) return "";
  const ext = m.extendedTextMessage as { text?: string } | undefined;
  const img = m.imageMessage as { caption?: string } | undefined;
  return ((m.conversation as string) ?? ext?.text ?? img?.caption ?? "").trim();
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== env.webhookSecret()) {
    return NextResponse.json({ error: "segredo inválido" }, { status: 401 });
  }
  let body: Evt;
  try {
    body = (await req.json()) as Evt;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ev = norm(body.event);

  try {
    if (ev === "groupparticipantsupdate") {
      const d = body.data as { id?: string; participants?: unknown[]; action?: string; author?: string };
      if (d?.id && d.participants?.length && d.action) await handleParticipants(d.id, d.participants, d.action, d.author);
    }

    if (ev === "groupsupsert" || ev === "groupupdate") {
      await enqueue("sync-groups", {}, { jobId: `sync-${Math.floor(Date.now() / 60_000)}` });
    }

    if (ev === "connectionupdate") {
      const d = body.data as { state?: string };
      await db.setting.upsert({
        where: { key: "_whatsapp" },
        create: { key: "_whatsapp", value: { state: d?.state ?? "unknown", at: new Date().toISOString() } },
        update: { value: { state: d?.state ?? "unknown", at: new Date().toISOString() } },
      });
      if (d?.state === "open") await enqueue("sync-groups", {}, { jobId: `sync-open-${Date.now()}` });
    }

    if (ev === "messagesupsert") {
      const list = Array.isArray(body.data) ? body.data : [body.data];
      for (const d of list) {
        const key = d?.key as { remoteJid?: string; fromMe?: boolean; id?: string; participant?: string; participantAlt?: string; participantPn?: string } | undefined;
        if (!key?.remoteJid?.endsWith("@g.us") || !key.id) continue;
        const group = await db.group.findUnique({ where: { jid: key.remoteJid } });
        if (!group?.isResults) continue;

        const message = d?.message as Record<string, unknown> | undefined;
        const audio = message?.audioMessage as { mimetype?: string } | undefined;
        const text = messageText(message);
        if (!text && !audio) continue;

        const fromPhone = key.fromMe
          ? "me"
          : jidToPhone(key.participantPn ?? key.participantAlt ?? (d?.participant as string) ?? key.participant);

        await enqueue(
          "command",
          {
            groupJid: key.remoteJid,
            messageId: key.id,
            fromMe: !!key.fromMe,
            fromPhone,
            text,
            audio: audio ? { mimetype: audio.mimetype ?? "audio/ogg", base64: (message?.base64 as string) ?? null } : null,
          },
          // espera um pouco para saber se a mensagem foi enviada pelo próprio sistema
          { jobId: `cmd-${key.id}`, delayMs: key.fromMe ? 3000 : 0 },
        );
      }
    }
  } catch (e) {
    console.error("[webhook]", body.event, e);
  }
  return NextResponse.json({ ok: true });
}
