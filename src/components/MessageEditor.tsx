"use client";
// Editor de mensagem da biblioteca: partes em sequência (texto, foto, vídeo, PDF, áudio),
// variáveis em menu, formatação do WhatsApp, gravação de voz e prévia no celular.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bold, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Italic, Mic, Paperclip, Plus, Search, Send, Smile, Square, Strikethrough, Trash2, Type, X } from "lucide-react";
import { KINDS, VAR_GROUPS, varLabel, type Part } from "@/lib/flowTypes";
import { uploadPartMedia } from "@/app/(painel)/acoes10";
import { saveTemplate, testTemplate } from "@/app/(painel)/acoes11";

export type TemplateData = { id?: string; name: string; folder: string; kind: string; parts: Part[] };
const EMOJIS = ["😊", "🤙", "🔥", "🌊", "🥋", "🏄", "✅", "👇", "👉", "⚡", "🎁", "📦", "🚚", "💳", "⏰", "❤️"];
const SAMPLE: Record<string, string> = { "{nome}": "Leonardo", "{nome_completo}": "Leonardo Beta", "{sobrenome}": "Beta", "{email}": "cliente@email.com", "{telefone}": "(21) 99999-0000", "{pedido}": "#4388", "{produtos}": "Rashguard Hawaii 808", "{produtos_variante}": "Rashguard Hawaii 808 (G)", "{valor}": "R$ 226,17", "{subtotal}": "R$ 209,00", "{endereco}": "Av. das Américas 500, Rio de Janeiro - RJ", "{link}": "rastahale.com.br/pedido", "{pix}": "rastahale.com.br/pagar", "{boleto}": "rastahale.com.br/boleto", "{vencimento}": "03/11/2026", "{cupom}": "VOLTEI10", "{rastreio}": "AE091166617BR", "{rastreio_link}": "rastreio.com/AE091166617BR", "{status_entrega}": "Em trânsito", "{transportadora}": "Correios", "{loja}": "Rasta Hale", "{site}": "rastahale.com.br" };
const rel = (u?: string) => (u ?? "").replace(/^https?:\/\/[^/]+/, "");

// *negrito* _itálico_ ~riscado~ e variáveis como etiqueta
export function WaText({ text, sample }: { text: string; sample?: boolean }) {
  const out: ReactNode[] = [];
  const re = /(\{\w+\}|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("{")) out.push(sample ? <b key={i++} className="me-sv">{SAMPLE[t] ?? t}</b> : <span key={i++} className="cv-var">{varLabel(t)}</span>);
    else if (t.startsWith("*")) out.push(<b key={i++}>{t.slice(1, -1)}</b>);
    else if (t.startsWith("_")) out.push(<i key={i++}>{t.slice(1, -1)}</i>);
    else out.push(<s key={i++}>{t.slice(1, -1)}</s>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function PhonePreview({ parts, sample = true }: { parts: Part[]; sample?: boolean }) {
  return (
    <div className="cv-phone me-phone">
      <div className="tp">Rasta Hale <small>online</small></div>
      <div className="bd">
        {parts.filter((p) => p.text || p.mediaUrl || p.productImage).map((p, i) => (
          <div key={i} className="cv-bb big">
            {p.productImage && <div className="cv-img"><ImageIcon size={16} /> foto do 1º produto</div>}
            {p.mediaUrl && p.mediaType === "image" && <div className="cv-img"><img src={rel(p.mediaUrl)} alt="" /></div>}
            {p.mediaUrl && p.mediaType === "video" && <div className="cv-img"><video src={rel(p.mediaUrl)} muted /></div>}
            {p.mediaUrl && p.mediaType === "audio" && <div className="me-audio"><Mic size={14} /> mensagem de voz</div>}
            {p.mediaUrl && p.mediaType === "document" && <div className="me-doc"><FileText size={15} /> {p.fileName || "arquivo"}</div>}
            {p.text && <WaText text={p.text} sample={sample} />}
          </div>
        ))}
        {!parts.some((p) => p.text || p.mediaUrl || p.productImage) && <div className="dim" style={{ fontSize: 12, textAlign: "center", marginTop: 40 }}>A prévia aparece aqui</div>}
      </div>
    </div>
  );
}

function VarMenu({ onPick, onClose }: { onPick: (v: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(VAR_GROUPS[0].group);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose(); };
    setTimeout(() => window.addEventListener("mousedown", on), 0);
    return () => window.removeEventListener("mousedown", on);
  }, [onClose]);
  const term = q.toLowerCase().trim();
  return (
    <div className="me-menu" ref={ref}>
      <label className="me-search"><Search size={13} /><input autoFocus placeholder="Buscar campo" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {VAR_GROUPS.map((g) => {
        const vars = g.vars.filter((v) => !term || v.label.toLowerCase().includes(term));
        if (!vars.length) return null;
        const show = !!term || open === g.group;
        return (
          <div key={g.group}>
            <button className="me-grp" onClick={() => setOpen(open === g.group ? null : g.group)}>{g.group}<ChevronDown size={13} style={{ transform: show ? "rotate(180deg)" : undefined }} /></button>
            {show && vars.map((v) => <button key={v.k} className="me-item" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(v.k)}>{v.label}<code>{v.k}</code></button>)}
          </div>
        );
      })}
    </div>
  );
}

export function MessageEditor({ initial, folders, onSaved, compact }: { initial: TemplateData; folders: string[]; onSaved?: (t: TemplateData & { id: string }) => void; compact?: boolean }) {
  const [t, setT] = useState<TemplateData>(() => ({ ...initial, parts: initial.parts.length ? initial.parts : [{ text: "" }] }));
  const [focus, setFocus] = useState(0);
  const [menu, setMenu] = useState<number | null>(null);
  const [emoji, setEmoji] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [sample, setSample] = useState(false);
  const [rec, setRec] = useState<{ i: number; r: MediaRecorder; start: number } | null>(null);
  const [, tick] = useState(0);
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => { if (!rec) return; const iv = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(iv); }, [rec]);

  const upd = (fn: (d: TemplateData) => void) => { setT((cur) => { const d = structuredClone(cur); fn(d); return d; }); setDirty(true); };
  const setPart = (i: number, fn: (p: Part) => void) => upd((d) => fn(d.parts[i]));

  const wrap = (i: number, mark: string) => {
    const el = refs.current[i];
    const text = t.parts[i]?.text ?? "";
    const a = el?.selectionStart ?? text.length, b = el?.selectionEnd ?? text.length;
    const sel = text.slice(a, b) || "texto";
    setPart(i, (p) => { p.text = text.slice(0, a) + mark + sel + mark + text.slice(b); });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + 1, a + 1 + sel.length); });
  };
  const insert = (i: number, v: string) => {
    const el = refs.current[i];
    const text = t.parts[i]?.text ?? "";
    const a = el?.selectionStart ?? text.length;
    setPart(i, (p) => { p.text = text.slice(0, a) + v + text.slice(el?.selectionEnd ?? a); });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + v.length, a + v.length); });
  };
  const upload = async (i: number, file: File) => {
    setBusy(`up${i}`); setMsg(null);
    const f = new FormData();
    f.set("file", file);
    const r = await uploadPartMedia(f).catch(() => ({ ok: false as const, error: "Não subiu o arquivo" }));
    if (r.ok) setPart(i, (p) => { p.mediaUrl = r.url; p.mediaType = r.type; p.fileName = "fileName" in r ? r.fileName : undefined; p.productImage = undefined; });
    else setMsg({ ok: false, text: ("error" in r && r.error) || "Não subiu o arquivo" });
    setBusy(null);
  };
  const startRec = async (i: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus" : "audio/webm";
      const r = new MediaRecorder(stream, { mimeType: mime });
      chunks.current = [];
      r.ondataavailable = (e) => chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((x) => x.stop());
        const blob = new Blob(chunks.current, { type: mime.split(";")[0] });
        await upload(i, new File([blob], `voz.${mime.includes("ogg") ? "ogg" : "webm"}`, { type: blob.type }));
      };
      r.start();
      setRec({ i, r, start: Date.now() });
    } catch {
      setMsg({ ok: false, text: "Não consegui usar o microfone. Libere o acesso no navegador." });
    }
  };
  const stopRec = () => { rec?.r.stop(); setRec(null); };

  const save = async (): Promise<string | null> => {
    setBusy("save"); setMsg(null);
    const r = await saveTemplate({ id: t.id, name: t.name, folder: t.folder, kind: t.kind, parts: t.parts }).catch(() => ({ ok: false as const, id: "" }));
    setBusy(null);
    if (r.ok) { setT((c) => ({ ...c, id: r.id })); setDirty(false); setMsg({ ok: true, text: "Salva" }); onSaved?.({ ...t, id: r.id }); return r.id; }
    setMsg({ ok: false, text: "Não salvou, tente de novo" });
    return null;
  };
  const test = async () => {
    const id = dirty || !t.id ? await save() : t.id;
    if (!id) return;
    setBusy("test");
    const r = await testTemplate(id).catch(() => ({ ok: false, error: "Falhou" }));
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: ("msg" in r && r.msg) || "Enviada" } : { ok: false, text: ("error" in r && r.error) || "Falhou" });
  };
  const chars = useMemo(() => t.parts.reduce((s, p) => s + (p.text?.length ?? 0), 0), [t.parts]);

  return (
    <div className={`me${compact ? " compact" : ""}`}>
      <div className="me-main">
        <div className="me-meta">
          <label className="cv-field" style={{ flex: 2 }}>Nome da mensagem<input className="in" value={t.name} placeholder="Ex.: Carrinho 1: lembrete" onChange={(e) => upd((d) => { d.name = e.target.value; })} /></label>
          <label className="cv-field" style={{ flex: 1 }}>Pasta<input className="in" list="me-folders" value={t.folder} placeholder="Sem pasta" onChange={(e) => upd((d) => { d.folder = e.target.value; })} /><datalist id="me-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist></label>
        </div>
        <div className="me-kinds">
          <span>Tipo</span>
          {KINDS.map((k) => <button key={k.k} className={t.kind === k.k ? "on" : ""} onClick={() => upd((d) => { d.kind = k.k; })}>{k.label}</button>)}
        </div>

        {t.parts.map((p, i) => (
          <div key={i} className={`me-part${focus === i ? " on" : ""}`} onClick={() => setFocus(i)}>
            <div className="me-ph">
              <span className="me-n">{i + 1}</span>
              <b>{p.mediaType === "audio" ? "Áudio" : p.mediaUrl || p.productImage ? "Arquivo + legenda" : "Texto"}</b>
              <span className="row" style={{ gap: 2, marginLeft: "auto" }}>
                <button className="cv-ib sm" disabled={i === 0} title="Subir" onClick={() => upd((d) => { [d.parts[i - 1], d.parts[i]] = [d.parts[i], d.parts[i - 1]]; })}><ChevronUp size={14} /></button>
                <button className="cv-ib sm" disabled={i === t.parts.length - 1} title="Descer" onClick={() => upd((d) => { [d.parts[i + 1], d.parts[i]] = [d.parts[i], d.parts[i + 1]]; })}><ChevronDown size={14} /></button>
                {t.parts.length > 1 && <button className="cv-ib sm" title="Tirar esta parte" onClick={() => upd((d) => { d.parts.splice(i, 1); })}><Trash2 size={13} /></button>}
              </span>
            </div>
            {(p.mediaUrl || p.productImage) && (
              <div className="cv-att">
                {p.productImage ? <><ImageIcon size={14} /> Foto do 1º produto do pedido/carrinho</> : p.mediaType === "image" ? <img src={rel(p.mediaUrl)} alt="" /> : p.mediaType === "audio" ? <audio src={rel(p.mediaUrl)} controls style={{ height: 32 }} /> : <><Paperclip size={14} /> {p.fileName || (p.mediaType === "video" ? "Vídeo" : "Arquivo")}</>}
                <button className="cv-ib sm" style={{ marginLeft: "auto" }} onClick={() => setPart(i, (q) => { q.mediaUrl = undefined; q.mediaType = undefined; q.fileName = undefined; q.productImage = undefined; })} title="Tirar arquivo"><X size={13} /></button>
              </div>
            )}
            {p.mediaType !== "audio" && (
              <div className="me-txt">
                <div className="me-tools">
                  <button title="Negrito" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap(i, "*")}><Bold size={14} /></button>
                  <button title="Itálico" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap(i, "_")}><Italic size={14} /></button>
                  <button title="Riscado" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap(i, "~")}><Strikethrough size={14} /></button>
                  <span className="me-rel"><button title="Emoji" onMouseDown={(e) => e.preventDefault()} onClick={() => setEmoji(emoji === i ? null : i)}><Smile size={14} /></button>
                    {emoji === i && <div className="me-emo">{EMOJIS.map((x) => <button key={x} onMouseDown={(e) => e.preventDefault()} onClick={() => { insert(i, x); setEmoji(null); }}>{x}</button>)}</div>}
                  </span>
                  <span className="me-rel"><button className="me-varb" onMouseDown={(e) => e.preventDefault()} onClick={() => setMenu(menu === i ? null : i)}><Plus size={13} /> Variável</button>
                    {menu === i && <VarMenu onPick={(v) => { insert(i, v); setMenu(null); }} onClose={() => setMenu(null)} />}
                  </span>
                </div>
                <textarea ref={(el) => { refs.current[i] = el; }} className="in" rows={i === 0 ? 6 : 4} value={p.text ?? ""} placeholder={p.mediaUrl || p.productImage ? "Legenda (opcional)" : "Escreva a mensagem. Use + Variável para o nome, pedido, link…"} onFocus={() => setFocus(i)} onChange={(e) => setPart(i, (q) => { q.text = e.target.value || undefined; })} />
              </div>
            )}
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <button className="cv-chip" onClick={() => setPart(i, (q) => { q.productImage = !q.productImage || undefined; if (q.productImage) { q.mediaUrl = undefined; q.mediaType = undefined; } })}><ImageIcon size={12} /> {p.productImage ? "Tirar foto do produto" : "Foto do produto"}</button>
              <label className="cv-chip"><Paperclip size={12} /> {busy === `up${i}` ? "Subindo…" : "Foto, vídeo ou PDF"}<input type="file" hidden accept="image/*,video/*,application/pdf,audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(i, f); e.target.value = ""; }} /></label>
              {rec?.i === i ? (
                <button className="cv-chip rec" onClick={stopRec}><Square size={11} /> Parar ({Math.round((Date.now() - rec.start) / 1000)}s)</button>
              ) : (
                <button className="cv-chip" disabled={!!rec} onClick={() => startRec(i)}><Mic size={12} /> Gravar voz</button>
              )}
            </div>
          </div>
        ))}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {t.parts.length < 8 && <button className="btn sm" onClick={() => { upd((d) => { d.parts.push({ text: "" }); }); setFocus(t.parts.length); }}><Type size={14} /> Adicionar texto</button>}
          {t.parts.length < 8 && <label className="btn sm"><Paperclip size={14} /> Adicionar arquivo<input type="file" hidden accept="image/*,video/*,application/pdf,audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const i = t.parts.length; upd((d) => { d.parts.push({}); }); void upload(i, f); } e.target.value = ""; }} /></label>}
        </div>
        <small className="dim">Cada parte sai como uma mensagem separada, na ordem. {chars} caracteres. Links contam clique sozinhos nas automações.</small>
      </div>

      <div className="me-side">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <b style={{ fontSize: 13 }}>Prévia</b>
          <label className="cv-tg" style={{ fontSize: 12 }}><input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} /><i /> Com dados de exemplo</label>
        </div>
        <PhonePreview parts={t.parts} sample={sample} />
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn pri sm" disabled={busy === "save"} onClick={() => void save()}>{busy === "save" ? "Salvando…" : dirty || !t.id ? "Salvar mensagem" : "Salva"}</button>
          <button className="btn sm" disabled={busy === "test"} onClick={test} title="Manda no grupo de teste"><Send size={14} /> {busy === "test" ? "Enviando…" : "Testar no grupo"}</button>
        </div>
        {msg && <div className={msg.ok ? "ok" : "err"} style={{ marginTop: 10, fontSize: 12.5 }}>{msg.text}</div>}
      </div>
    </div>
  );
}
