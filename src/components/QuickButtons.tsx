"use client";
// Botões de mensagem manual (um por mensagem): verde quando já foi enviada, com o nome e a hora ao passar o mouse.
import { useState, useTransition } from "react";
import { History } from "lucide-react";
import { sendQuickAction } from "@/app/(painel)/acoes9";
import type { QuickCtx } from "@/lib/quick";

type Msg = { id: string; name: string };
type Sent = { messageId: string; at: string; by: string | null; error: string | null };

const Wa = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4 5.2 5.2 0 0 0 3.2.7 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z" /></svg>;
const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function QuickButtons({ msgs, refId, phone, ctx, sent: sent0 }: { msgs: Msg[]; refId: string; phone: string | null; ctx: QuickCtx; sent: Sent[] }) {
  const [sent, setSent] = useState(sent0);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  if (!phone) return <span className="dim" style={{ fontSize: 12 }}>sem WhatsApp</span>;
  const last = (id: string) => [...sent].reverse().find((s) => s.messageId === id && !s.error);
  const send = (m: Msg) => {
    const l = last(m.id);
    if (!confirm(l ? `"${m.name}" já foi enviada em ${fmt(l.at)}. Mandar de novo?` : `Mandar "${m.name}" no WhatsApp agora?`)) return;
    setBusy(m.id);
    start(async () => {
      const r = await sendQuickAction(m.id, refId, phone, ctx);
      setBusy(null);
      if (r.ok) setSent((s) => [...s, { messageId: m.id, at: r.at!, by: r.by ?? null, error: null }]);
      else { setSent((s) => [...s, { messageId: m.id, at: new Date().toISOString(), by: null, error: r.error ?? "erro" }]); alert(`Não foi: ${r.error}`); }
    });
  };
  const names = new Map(msgs.map((m) => [m.id, m.name]));
  return (
    <span className="qb">
      {msgs.map((m) => {
        const l = last(m.id);
        return (
          <button key={m.id} type="button" className={`qb-i${l ? " on" : ""}${busy === m.id ? " busy" : ""}`} disabled={!!busy} onClick={() => send(m)}
            title={l ? `${m.name} · enviada ${fmt(l.at)}${l.by ? ` por ${l.by}` : ""}` : `${m.name} · clique para enviar`}>
            <Wa />
          </button>
        );
      })}
      {sent.length > 0 && (
        <span className="qb-h">
          <button type="button" className="qb-i hist" onClick={() => setOpen(!open)} title="Histórico de envios"><History size={13} /></button>
          {open && <span className="qb-pop">{[...sent].reverse().map((s, i) => <span key={i} className={s.error ? "err-t" : ""}>{fmt(s.at)} · {names.get(s.messageId) ?? "mensagem"}{s.by ? ` · ${s.by}` : ""}{s.error ? ` · falhou` : ""}</span>)}</span>}
        </span>
      )}
    </span>
  );
}
