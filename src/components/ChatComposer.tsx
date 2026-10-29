"use client";
// Caixa de resposta do atendimento: Enter envia, atalhos de texto pronto.
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Link2, Package, Send, Ticket, Zap } from "lucide-react";

function SendBtn() {
  const { pending } = useFormStatus();
  return <button className="send-b" type="submit" disabled={pending} aria-label="Enviar"><Send size={17} /></button>;
}

export function ChatComposer({ action, phone, name, quick, coupon, tracking, exchangeUrl }: {
  action: (f: FormData) => Promise<void>; phone: string; name?: string | null; quick: string[]; coupon: string; tracking?: string | null; exchangeUrl: string;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const first = (name ?? "").split(" ")[0];
  const add = (t: string) => { setText((x) => (x ? `${x.trimEnd()} ${t}` : t)); setOpen(false); requestAnimationFrame(() => ref.current?.focus()); };
  return (
    <form ref={form} action={async (f) => { await action(f); setText(""); }} className="composer">
      <input type="hidden" name="phone" value={phone} />
      {name && <input type="hidden" name="name" value={name} />}
      <div className="row" style={{ gap: 6, position: "relative" }}>
        <button type="button" className="tbtn" onClick={() => setOpen((o) => !o)}><Zap size={14} /> Respostas rápidas</button>
        <button type="button" className="tbtn" onClick={() => add(`Faz a troca por aqui, é rapidinho: ${exchangeUrl}`)}><Link2 size={14} /> Link de troca</button>
        <button type="button" className="tbtn" onClick={() => add(`Separei um cupom para você: ${coupon}`)}><Ticket size={14} /> Cupom</button>
        {tracking && <button type="button" className="tbtn" onClick={() => add(`Seu pedido está a caminho, acompanhe aqui: ${tracking}`)}><Package size={14} /> Rastreio</button>}
        {open && (
          <div className="qr-pop">
            {quick.length ? quick.map((q, i) => <button type="button" key={i} onClick={() => add(q.replace(/\{nome\}/g, first))}>{q.replace(/\{nome\}/g, first || "{nome}")}</button>) : <div className="dim" style={{ padding: 10, fontSize: 12.5 }}>Nenhuma resposta salva. Cadastre em Respostas rápidas, no fim da página.</div>}
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-end", marginTop: 8 }}>
        <textarea ref={ref} name="text" value={text} required rows={1} placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
          onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) form.current?.requestSubmit(); } }} />
        <SendBtn />
      </div>
    </form>
  );
}
