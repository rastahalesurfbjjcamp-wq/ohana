"use client";
// Conversa de teste com o assistente, dentro de um celular. Nada é enviado no WhatsApp.
import { useRef, useState, useTransition } from "react";
import { CheckCheck, RotateCcw, Send } from "lucide-react";

type M = { fromMe: boolean; text: string; at: string };
const now = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function AssistantTester({ action, store, enabled }: { action: (h: { fromMe: boolean; text: string }[]) => Promise<{ reply?: string; error?: string }>; store: string; enabled: boolean }) {
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const scroll = () => requestAnimationFrame(() => box.current?.scrollTo({ top: 1e6, behavior: "smooth" }));
  const send = () => {
    const t = text.trim();
    if (!t || pending) return;
    const next = [...msgs, { fromMe: false, text: t, at: now() }];
    setMsgs(next); setText(""); setErr(""); scroll();
    start(async () => {
      const r = await action(next.map(({ fromMe, text }) => ({ fromMe, text })));
      if (r.reply) setMsgs((m) => [...m, { fromMe: true, text: r.reply!, at: now() }]);
      else setErr(r.error ?? "Não consegui responder");
      scroll();
    });
  };
  return (
    <div className="phone" style={{ position: "static", display: "flex", flexDirection: "column", minHeight: 620 }}>
      <div className="phone-h">
        <span className="phone-av">{store.slice(0, 1)}</span>
        <div style={{ flex: 1 }}><b>{store}</b><small>{pending ? "digitando…" : "assistente da loja · teste"}</small></div>
        {msgs.length > 0 && <button type="button" className="menu-b" onClick={() => { setMsgs([]); setErr(""); }} title="Começar de novo"><RotateCcw size={15} /></button>}
      </div>
      <div className="phone-b" ref={box} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, minHeight: 0, maxHeight: 520 }}>
        {!msgs.length && <div className="ib-note" style={{ marginTop: 20 }}>Escreva como se fosse um cliente. Ex.: tenho 1,78 e 80 kg, qual tamanho da rashguard? {enabled ? "" : "O assistente está desligado no WhatsApp, mas o teste funciona."}</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`bub ${m.fromMe ? "me" : "them"}`} style={{ maxWidth: "85%", fontSize: 13.5 }}>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            <small>{m.at}{m.fromMe && <CheckCheck size={13} />}</small>
          </div>
        ))}
        {pending && <div className="bub me typing" style={{ maxWidth: 80 }}><span /><span /><span /></div>}
        {err && <div className="ib-note" style={{ color: "#fca5a5" }}>{err}</div>}
      </div>
      <div className="row" style={{ gap: 8, padding: 10, background: "#1f2c34", flexWrap: "nowrap" }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Mensagem" style={{ flex: 1, height: 40, borderRadius: 20, border: 0, background: "#2a3942", color: "#fff", padding: "0 14px", outline: "none", fontSize: 14 }} />
        <button type="button" className="send-b" style={{ borderRadius: "50%", width: 40, height: 40 }} onClick={send} disabled={pending} aria-label="Enviar"><Send size={16} /></button>
      </div>
    </div>
  );
}
