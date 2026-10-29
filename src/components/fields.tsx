"use client";
// Campos caprichados reutilizáveis: data e hora com calendário, escolha de grupos, arquivo com prévia e chave liga/desliga.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, ImageIcon, Paperclip, Search, Video, X } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WDS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

/* Data e hora: botão com calendário e horários prontos. Manda "AAAA-MM-DDTHH:MM" no campo name. */
export function DateTimeField({ name, defaultValue, minToday = true, onChange }: { name: string; defaultValue?: string; minToday?: boolean; onChange?: (v: string) => void }) {
  const now = new Date();
  const start = defaultValue ? new Date(defaultValue) : new Date(now.getTime() + 60 * 60 * 1000);
  const [day, setDay] = useState(iso(start));
  const [time, setTime] = useState(`${pad(start.getHours())}:${pad(Math.floor(start.getMinutes() / 5) * 5)}`);
  const [open, setOpen] = useState<"" | "d" | "t">("");
  const [month, setMonth] = useState(new Date(start.getFullYear(), start.getMonth(), 1));
  const ref = useOutside(!!open, () => setOpen(""));
  const today = iso(now);
  const value = `${day}T${time}`;
  useEffect(() => { onChange?.(value); }, [value, onChange]);
  const d = new Date(`${day}T12:00:00`);
  const first = month.getDay();
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const times = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);
  const quick = [["Hoje", 0], ["Amanhã", 1], ["Em 2 dias", 2], ["Próxima semana", 7]] as const;

  return (
    <div className="dtf" ref={ref}>
      <input type="hidden" name={name} value={value} />
      <button type="button" className={`dtf-b${open === "d" ? " on" : ""}`} onClick={() => setOpen(open === "d" ? "" : "d")}>
        <CalendarDays size={16} /> <span style={{ textTransform: "capitalize" }}>{WDS[d.getDay()]}, {day.slice(8)}/{day.slice(5, 7)}</span>
      </button>
      <button type="button" className={`dtf-b${open === "t" ? " on" : ""}`} onClick={() => setOpen(open === "t" ? "" : "t")}>
        <Clock size={16} /> {time}
      </button>
      {open === "d" && (
        <div className="dtf-pop">
          <div className="dtf-quick">
            {quick.map(([l, n]) => {
              const q = new Date(); q.setDate(q.getDate() + n);
              return <button type="button" key={l} className={iso(q) === day ? "on" : ""} onClick={() => { setDay(iso(q)); setMonth(new Date(q.getFullYear(), q.getMonth(), 1)); setOpen("t"); }}>{l}</button>;
            })}
          </div>
          <div className="dp-mh">
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mês anterior"><ChevronLeft size={15} /></button>
            <span>{MONTHS[month.getMonth()]} de {month.getFullYear()}</span>
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Próximo mês"><ChevronRight size={15} /></button>
          </div>
          <div className="dp-g">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => <span key={i} className="wd">{w}</span>)}
            {Array.from({ length: first }).map((_, i) => <span key={`e${i}`} className="d out" />)}
            {Array.from({ length: dim }, (_, i) => iso(new Date(month.getFullYear(), month.getMonth(), i + 1))).map((x) => {
              const past = minToday && x < today;
              return <button type="button" key={x} disabled={past} className={`d${past ? " fut" : ""}${x === day ? " edge st en" : ""}${x === today ? " today" : ""}`} onClick={() => { setDay(x); setOpen("t"); }}>{Number(x.slice(8))}</button>;
            })}
          </div>
        </div>
      )}
      {open === "t" && (
        <div className="dtf-pop" style={{ width: 260 }}>
          <div className="dtf-own">
            <span className="dim" style={{ fontSize: 12 }}>Horário exato</span>
            <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} step={300} />
          </div>
          <div className="dtf-times">
            {times.filter((t) => !(day === today && t <= `${pad(now.getHours())}:${pad(now.getMinutes())}`)).map((t) => (
              <button type="button" key={t} className={t === time ? "on" : ""} onClick={() => { setTime(t); setOpen(""); }}>{t}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Escolha de grupos: resumo + lista com busca e marcar todos */
export type GroupOpt = { jid: string; name: string; size: number; tag?: string; checked?: boolean };
export function GroupPicker({ name, groups, onCount }: { name: string; groups: GroupOpt[]; onCount?: (n: number) => void }) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(groups.filter((g) => g.checked).map((g) => g.jid)));
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useOutside(open, () => setOpen(false));
  useEffect(() => { onCount?.(sel.size); }, [sel, onCount]);
  const shown = groups.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));
  const people = groups.filter((g) => sel.has(g.jid)).reduce((a, g) => a + g.size, 0);
  const tags = [...new Set(groups.filter((g) => sel.has(g.jid)).map((g) => g.tag).filter(Boolean))].join(" e ");
  const toggle = (j: string) => setSel((s) => { const n = new Set(s); if (n.has(j)) n.delete(j); else n.add(j); return n; });
  return (
    <div className="gp" ref={ref}>
      {[...sel].map((j) => <input key={j} type="hidden" name={name} value={j} />)}
      <button type="button" className={`gp-b${open ? " on" : ""}`} onClick={() => setOpen((o) => !o)}>
        <div style={{ textAlign: "left" }}>
          <b>{sel.size ? `${sel.size} grupo${sel.size > 1 ? "s" : ""}` : "Escolher grupos"}</b>
          <small>{sel.size ? `${people.toLocaleString("pt-BR")} pessoas${tags ? ` · ${tags}` : ""}` : "Nenhum grupo marcado"}</small>
        </div>
        <ChevronDown size={16} className="chev" />
      </button>
      {open && (
        <div className="gp-pop">
          <div className="gp-s"><Search size={15} className="dim" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar grupo" autoFocus /></div>
          <div className="row" style={{ gap: 6, padding: "6px 4px 8px" }}>
            <button type="button" className="btn sm" onClick={() => setSel(new Set(groups.map((g) => g.jid)))}>Marcar todos</button>
            <button type="button" className="btn sm ghost" onClick={() => setSel(new Set())}>Limpar</button>
          </div>
          <div className="gp-l">
            {shown.map((g) => (
              <button type="button" key={g.jid} className={sel.has(g.jid) ? "on" : ""} onClick={() => toggle(g.jid)}>
                <span className="ck">{sel.has(g.jid) && <Check size={12} strokeWidth={3} />}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                {g.tag && <span className="dim" style={{ fontSize: 11.5 }}>{g.tag}</span>}
                <span className="dim" style={{ fontSize: 12 }}>{g.size}</span>
              </button>
            ))}
            {!shown.length && <div className="empty" style={{ padding: 16 }}>Nenhum grupo.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* Arquivo com prévia */
export function FileField({ name, accept = "image/*,video/*,application/pdf", hint = "Foto, vídeo ou PDF (opcional)" }: { name: string; accept?: string; hint?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const url = useMemo(() => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  const Icon = !file ? Paperclip : file.type.startsWith("image/") ? ImageIcon : file.type.startsWith("video/") ? Video : FileText;
  return (
    <div className={`ff${file ? " has" : ""}`} onClick={() => !file && input.current?.click()}>
      <input ref={input} type="file" name={name} accept={accept} hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : <span className="tile sm t-n"><Icon size={16} /></span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{file ? file.name : "Anexar arquivo"}</b>
        <small>{file ? `${file.type.startsWith("image/") ? "imagem" : file.type.startsWith("video/") ? "vídeo" : "arquivo"} · ${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : hint}</small>
      </div>
      {file && <button type="button" className="menu-b" aria-label="Tirar arquivo" onClick={(e) => { e.stopPropagation(); setFile(null); if (input.current) input.current.value = ""; }}><X size={16} /></button>}
    </div>
  );
}

/* Cartão com chave liga/desliga */
export function ToggleCard({ name, title, sub, defaultChecked, tone = "l", children }: { name: string; title: string; sub?: string; defaultChecked?: boolean; tone?: "l" | "s"; children?: ReactNode }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <div className={`tgc${on ? ` on t${tone}` : ""}`}>
      <label className="tgc-h">
        <div style={{ flex: 1 }}>
          <b>{title}</b>
          {sub && <small>{sub}</small>}
        </div>
        <span className="check"><input type="checkbox" name={name} checked={on} onChange={(e) => setOn(e.target.checked)} /></span>
      </label>
      {on && children}
    </div>
  );
}

/* Só horário: botão com relógio e lista de horários */
export function TimeField({ name, defaultValue = "22:00", label }: { name: string; defaultValue?: string; label?: string }) {
  const [time, setTime] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const times = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);
  return (
    <div className="dtf" ref={ref} style={{ gridTemplateColumns: "1fr" }}>
      <input type="hidden" name={name} value={time} />
      <button type="button" className={`dtf-b${open ? " on" : ""}`} onClick={() => setOpen((o) => !o)}><Clock size={16} /> {time}{label ? <span className="dim" style={{ fontWeight: 400 }}>{label}</span> : null}</button>
      {open && (
        <div className="dtf-pop" style={{ width: 260 }}>
          <div className="dtf-own"><span className="dim" style={{ fontSize: 12 }}>Horário exato</span><input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} /></div>
          <div className="dtf-times">{times.map((t) => <button type="button" key={t} className={t === time ? "on" : ""} onClick={() => { setTime(t); setOpen(false); }}>{t}</button>)}</div>
        </div>
      )}
    </div>
  );
}

/* Cartão de escolha única (radio bonito) */
export function ChoiceCards({ name, options, defaultValue }: { name: string; options: { value: string; title: string; sub?: string }[]; defaultValue: string }) {
  const [v, setV] = useState(defaultValue);
  return (
    <div className="choice">
      <input type="hidden" name={name} value={v} />
      {options.map((o) => (
        <button type="button" key={o.value} className={v === o.value ? "on" : ""} onClick={() => setV(o.value)}>
          <div style={{ flex: 1, textAlign: "left" }}><b>{o.title}</b>{o.sub && <small>{o.sub}</small>}</div>
          <span className="ck">{v === o.value && <Check size={13} strokeWidth={3} />}</span>
        </button>
      ))}
    </div>
  );
}
