"use client";
// Preencher custos falando ou digitando: a IA liga cada valor ao produto.
import { useRef, useState, useTransition } from "react";
import { Check, Mic, Square, Wand2, X } from "lucide-react";

type Item = { product: string; cost: number };
type SR = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null };

export function CostVoice({ products, parse, save }: { products: string[]; parse: (t: string, p: string[]) => Promise<{ items?: Item[]; error?: string }>; save: (i: Item[]) => Promise<{ ok: number }> }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState("");
  const [rec, setRec] = useState(false);
  const [pending, start] = useTransition();
  const sr = useRef<SR | null>(null);
  const mic = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const C = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!C) { setMsg("Este navegador não ouve o microfone. Digite os valores."); return; }
    if (rec) { sr.current?.stop(); return; }
    const r = new C();
    r.lang = "pt-BR"; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => setRec(false);
    sr.current = r; r.start(); setRec(true); setMsg("");
  };
  const understand = () => start(async () => { const r = await parse(text, products); if (r.error) setMsg(r.error); else { setItems(r.items ?? []); setMsg(r.items?.length ? "" : "Não achei nenhum produto na frase."); } });
  const saveAll = () => start(async () => { const r = await save(items); setMsg(`${r.ok} custos salvos.`); setItems([]); setText(""); });
  return (
    <div className="cv">
      <button type="button" className={`cv-mic${rec ? " on" : ""}`} onClick={mic} aria-label={rec ? "Parar" : "Falar"}>{rec ? <Square size={26} /> : <Mic size={30} />}</button>
      <div className={`cv-wave${rec ? " on" : ""}`}>{Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ animationDelay: `${(i % 6) * 0.1}s` }} />)}</div>
      <textarea className="in" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ex.: "A Original Rasta custou 58 reais, o short Original Rasta 52 e a Hidden Promised Land 58"`} style={{ minHeight: 90, fontStyle: text ? "normal" : "italic" }} />
      <button type="button" className="btn" disabled={!text.trim() || pending} onClick={understand} style={{ width: "100%", justifyContent: "center" }}><Wand2 size={15} /> {pending && !items.length ? "Entendendo…" : "Entender os valores"}</button>
      {items.map((it, i) => (
        <div className="cv-it" key={i}>
          <span>{it.product}</span>
          <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <b>R$</b><input value={String(it.cost).replace(".", ",")} onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, cost: Number(e.target.value.replace(",", ".")) || 0 } : y)))} />
            <button type="button" className="menu-b" onClick={() => setItems((x) => x.filter((_, j) => j !== i))}><X size={14} /></button>
          </span>
        </div>
      ))}
      {items.length > 0 && <button type="button" className="btn pri lg" disabled={pending} onClick={saveAll} style={{ width: "100%", justifyContent: "center" }}><Check size={16} /> Salvar os {items.length} custos</button>}
      {msg && <div className="dim" style={{ fontSize: 12.5, textAlign: "center" }}>{msg}</div>}
    </div>
  );
}
