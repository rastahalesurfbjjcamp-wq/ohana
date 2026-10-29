"use client";
// Novo disparo: público, mensagem com prévia no celular, quando e canal.
import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Braces, CheckCheck, FlaskConical, ImageIcon, Send, Video, X } from "lucide-react";
import { DateTimeField, ToggleCard } from "./fields";

export type Audience = { key: string; label: string; count: number; unit?: string; hint?: string };

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn pri lg" type="submit" disabled={pending}><Send size={16} /> {pending ? "Salvando…" : "Agendar disparo"}</button>;
}

export function BroadcastComposer({ action, testAction, audiences, defaultAudience, store, maxPerHour, owner }: {
  action: (f: FormData) => Promise<void>; testAction: (f: FormData) => Promise<void>; audiences: Audience[]; defaultAudience: string; store: string; maxPerHour: number; owner: string;
}) {
  const [aud, setAud] = useState(defaultAudience);
  const [text, setText] = useState("Oi {nome}, ");
  const [file, setFile] = useState<File | null>(null);
  const [now, setNow] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  const current = audiences.find((a) => a.key === aud);
  const insert = (v: string) => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart ?? text.length, e = el.selectionEnd ?? text.length;
    const next = text.slice(0, s) + v + text.slice(e);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + v.length, s + v.length); });
  };
  const pick = (accept: string) => { if (fileRef.current) { fileRef.current.accept = accept; fileRef.current.click(); } };
  const rendered = text.replace(/\{nome\}/g, owner).replace(/\*([^*]+)\*/g, "<b>$1</b>");
  const hours = current ? Math.ceil(current.count / Math.max(1, maxPerHour)) : 0;

  return (
    <form action={action}>
      <div className="hd" style={{ marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <h1>Novo disparo</h1>
          <p className="lede">Mensagem no privado para leads, clientes ou quem saiu do grupo. O Hub manda aos poucos para proteger o número.</p>
        </div>
        <div className="acts">
          <button className="btn" type="submit" formAction={testAction} formNoValidate><FlaskConical size={15} /> Enviar teste para mim</button>
          <Submit />
        </div>
      </div>
      <input type="hidden" name="audience" value={aud} />
      {now && <input type="hidden" name="now" value="1" />}
      <input ref={fileRef} type="file" name="media" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div className="bc">
        <section className="pnl bc-l">
          <h4><span className="stepn">1</span> Público</h4>
          <div className="stack" style={{ gap: 8 }}>
            {audiences.map((a) => (
              <label key={a.key} className={`rc${aud === a.key ? " on" : ""}`}>
                <input type="radio" name="_aud" checked={aud === a.key} onChange={() => setAud(a.key)} />
                <span className="dot" />
                <span style={{ flex: 1 }}>{a.label}{a.hint && <small>{a.hint}</small>}</span>
                <span className="dim" style={{ fontSize: 12.5 }}>{a.count.toLocaleString("pt-BR")} {a.unit ?? "pessoas"}</span>
              </label>
            ))}
          </div>
          {aud === "lista" && <textarea className="in" name="list" placeholder="Um WhatsApp por linha" style={{ minHeight: 90, marginTop: 8 }} />}

          <div className="sep" />
          <h4><span className="stepn">2</span> Mensagem</h4>
          <textarea ref={ta} className="in" name="text" required value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 120 }} placeholder="Oi {nome}, ..." />
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            <button type="button" className="tbtn" onClick={() => pick("image/*")}><ImageIcon size={14} /> Imagem</button>
            <button type="button" className="tbtn" onClick={() => pick("video/*")}><Video size={14} /> Vídeo</button>
            <button type="button" className="tbtn sun" onClick={() => insert("{nome}")}><Braces size={14} /> Nome da pessoa</button>
            <button type="button" className="tbtn" onClick={() => insert("**")}><b>B</b> Negrito</button>
            {file && <span className="chip c-n" style={{ gap: 6 }}>{file.name.slice(0, 22)} <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", display: "grid" }}><X size={12} /></button></span>}
          </div>
          <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>No fim vai sozinho: “Para não receber mais, responda SAIR”.</p>

          <div className="sep" />
          <h4><span className="stepn">3</span> Quando</h4>
          <div className="seg" style={{ marginBottom: 10 }}>
            <button type="button" className={!now ? "on" : ""} onClick={() => setNow(false)}>Agendar</button>
            <button type="button" className={now ? "on" : ""} onClick={() => setNow(true)}>Começar agora</button>
          </div>
          {!now && <DateTimeField name="sendAt" />}
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            <ToggleCard name="skipRecent" defaultChecked title="Pular quem comprou nos últimos 7 dias" sub="Evita mandar oferta para quem acabou de comprar" />
            <div className="tgc on tl"><div className="tgc-h"><div style={{ flex: 1 }}><b>Intervalo aleatório entre mensagens</b><small>Sempre ligado. Até {maxPerHour} por hora{current && current.count > maxPerHour ? `: esse disparo leva umas ${hours} horas` : ""}.</small></div><CheckCheck size={18} className="up" /></div></div>
          </div>
        </section>

        <div className="phone">
          <div className="phone-h">
            <span className="phone-av">{store.slice(0, 1)}</span>
            <div><b>{store}</b><small>conta comercial</small></div>
          </div>
          <div className="phone-b">
            <div className="wmsg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview && <img src={preview} alt="" />}
              {file && !preview && <div className="wfile"><Video size={16} /> {file.name}</div>}
              <div dangerouslySetInnerHTML={{ __html: rendered.replace(/</g, "&lt;").replace(/&lt;(\/?)b>/g, "<$1b>").replace(/\n/g, "<br/>") + `<br/><span class="opt">Para não receber mais, responda SAIR</span>` }} />
              <span className="wtime">19:00 <CheckCheck size={13} /></span>
            </div>
          </div>
        </div>

        <section className="pnl bc-r">
          <h4><span className="stepn">4</span> Canal de envio</h4>
          <div className="chan on">
            <span className="tile sm t-l" style={{ fontWeight: 800 }}>W</span>
            <div><b>WhatsApp · Evolution</b><small>Número conectado no Hub. Sem custo por mensagem, até {maxPerHour} por hora.</small></div>
          </div>
          <div className="chan off">
            <span className="tile sm t-k">∞</span>
            <div><b>API Oficial · Meta <span className="chip c-n" style={{ marginLeft: 6 }}>não conectada</span></b><small>Selo de conta comercial, botões e sem risco de bloqueio. Custo por mensagem cobrado pela Meta. Conecte em Integrações.</small></div>
          </div>
          <div className="sum">
            <div className="kv"><span className="mut">Público</span><span>{current?.label}</span></div>
            <div className="kv"><span className="mut">Mensagens</span><span className="v">{(current?.count ?? 0).toLocaleString("pt-BR")}</span></div>
            <div className="kv"><span className="mut">Tempo estimado</span><span>{hours <= 1 ? "menos de 1 hora" : `umas ${hours} horas`}</span></div>
            <div className="kv"><span className="mut">Custo</span><span className="up">R$ 0</span></div>
          </div>
          <div className="callout sun" style={{ marginTop: 12 }}>
            Mande para quem conhece a marca, com mensagem curta e útil. Muita denúncia pode bloquear o número.
          </div>
        </section>
      </div>
    </form>
  );
}
