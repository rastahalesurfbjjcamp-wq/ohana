import Link from "next/link";
import { Bot, Send } from "lucide-react";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { Header } from "@/components/ui";
import { AutoRefresh } from "@/components/AutoRefresh";
import { replyChat, threadAction } from "../acoes3";

export const dynamic = "force-dynamic";

export default async function Atendimento({ searchParams }: { searchParams: Promise<{ p?: string; f?: string }> }) {
  const { p, f = "aberto" } = await searchParams;
  const s = await getSettings();
  const threads = await db.chatThread.findMany({ where: f === "todos" ? {} : { status: f }, orderBy: { lastAt: "desc" }, take: 80 });
  const current = p ? await db.chatThread.findUnique({ where: { phone: p } }) : null;
  const messages = current ? await db.chatMessage.findMany({ where: { phone: current.phone }, orderBy: { createdAt: "asc" }, take: 200 }) : [];
  if (current?.unread) await db.chatThread.update({ where: { phone: current.phone }, data: { unread: 0 } });
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const by: Record<string, string> = { ia: "IA", equipe: "equipe", sistema: "automático" };

  return (
    <>
      <AutoRefresh seconds={15} />
      <Header title="Atendimento" lede={`Conversas do WhatsApp da loja no privado. ${s.assistant.enabled ? "O assistente com IA está ligado e responde sozinho até alguém da equipe assumir." : "O assistente com IA está desligado."}`}>
        <Link className="btn sm" href="/assistente"><Bot size={14} /> Assistente IA</Link>
      </Header>
      <div className="tabs">
        {[["aberto", "Abertas"], ["resolvido", "Resolvidas"], ["todos", "Todas"]].map(([k, l]) => (
          <a key={k} href={`/atendimento?f=${k}${p ? `&p=${p}` : ""}`} className={f === k ? "on" : ""}>{l}</a>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(260px,1fr) minmax(0,2fr)", alignItems: "start" }}>
        <section className="pnl" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          {threads.length ? threads.map((t) => (
            <a key={t.phone} href={`/atendimento?f=${f}&p=${t.phone}`} style={{ display: "block", padding: "12px 16px", borderBottom: "1px solid var(--line2)", background: t.phone === p ? "var(--sf2)" : undefined }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                <b style={{ fontWeight: 550 }}>{t.name ?? formatPhone(t.phone)}</b>
                {t.unread > 0 && <span className="chip c-l">{t.unread}</span>}
              </div>
              <div className="dim" style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.lastText}</div>
              <div className="dim" style={{ fontSize: 11 }}>{fmt.format(t.lastAt)}{!t.aiEnabled ? " · com a equipe" : ""}</div>
            </a>
          )) : <div className="empty">Nenhuma conversa.</div>}
        </section>
        <section className="pnl" style={{ display: "flex", flexDirection: "column", minHeight: 420 }}>
          {current ? (
            <>
              <div className="ph" style={{ paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
                <div>
                  <h3>{current.name ?? formatPhone(current.phone)}</h3>
                  <small>{formatPhone(current.phone)}</small>
                </div>
                <form action={threadAction} className="row" style={{ gap: 6 }}>
                  <input type="hidden" name="phone" value={current.phone} />
                  {current.aiEnabled ? <button className="btn sm" name="act" value="ia_off">Assumir (desligar IA)</button> : <button className="btn sm" name="act" value="ia_on">Devolver para a IA</button>}
                  {current.status === "aberto" ? <button className="btn sm" name="act" value="resolver">Resolver</button> : <button className="btn sm" name="act" value="reabrir">Reabrir</button>}
                </form>
              </div>
              <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 8, maxHeight: "55vh", overflowY: "auto" }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ alignSelf: m.fromMe ? "flex-end" : "flex-start", maxWidth: "75%", background: m.fromMe ? "#173323" : "#1a1f1d", borderRadius: 12, padding: "8px 12px" }}>
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.45 }}>{m.text}</div>
                    <div className="dim" style={{ fontSize: 10.5, marginTop: 4, textAlign: "right" }}>{m.fromMe ? `${by[m.by] ?? m.by} · ` : ""}{fmt.format(m.createdAt)}</div>
                  </div>
                ))}
              </div>
              <form action={replyChat} className="row" style={{ padding: 12, borderTop: "1px solid var(--line)", flexWrap: "nowrap" }}>
                <input type="hidden" name="phone" value={current.phone} />
                <input className="in" name="text" placeholder="Escreva a resposta" autoComplete="off" required />
                <button className="btn pri" type="submit"><Send size={14} /> Enviar</button>
              </form>
            </>
          ) : (
            <div className="empty">Escolha uma conversa.</div>
          )}
        </section>
      </div>
    </>
  );
}
