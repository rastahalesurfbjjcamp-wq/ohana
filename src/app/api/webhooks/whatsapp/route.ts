// Avisos da API oficial do WhatsApp (Meta): mensagens recebidas vão para o Atendimento.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creds } from "@/lib/integrations";

export const dynamic = "force-dynamic";

// Verificação que a Meta faz ao cadastrar o webhook
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const ok = q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === (await creds()).waba.verify;
  return ok ? new NextResponse(q.get("hub.challenge") ?? "", { status: 200 }) : new NextResponse("forbidden", { status: 403 });
}

type Msg = { id: string; from: string; type: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } };
type Body = { entry?: { changes?: { value?: { contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: Msg[] } }[] }[] };

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  for (const e of body.entry ?? []) {
    for (const ch of e.changes ?? []) {
      const v = ch.value;
      for (const m of v?.messages ?? []) {
        const phone = m.from.replace(/\D/g, "");
        if (!phone) continue;
        const name = v?.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        const raw = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
        const text = raw || (m.type === "audio" ? "[áudio]" : m.type === "image" ? "[foto]" : m.type === "video" ? "[vídeo]" : m.type === "document" ? "[arquivo]" : "");
        if (!text) continue;
        await db.chatThread.upsert({
          where: { phone },
          create: { phone, name, lastText: text.slice(0, 200), lastAt: new Date(), unread: 1 },
          update: { name: name ?? undefined, lastText: text.slice(0, 200), lastAt: new Date(), unread: { increment: 1 }, status: "aberto" },
        });
        await db.chatMessage.upsert({ where: { messageId: m.id }, create: { phone, text, messageId: m.id }, update: {} });
        if (/^(sair|parar|pare|cancelar|stop|descadastrar)\b/i.test(raw.trim())) {
          await db.optOut.upsert({ where: { phone }, create: { phone }, update: {} });
          await db.lead.updateMany({ where: { phone }, data: { status: "descadastrado" } });
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}
