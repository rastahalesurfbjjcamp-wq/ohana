"use client";
// Seletor de período: atalhos + calendário de dois meses.
// Dá para clicar no início e no fim, ou clicar e arrastar por cima dos dias.
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const PRESETS: [string, string][] = [
  ["hoje", "Hoje"], ["ontem", "Ontem"], ["7d", "Últimos 7 dias"], ["30d", "Últimos 30 dias"],
  ["60d", "Últimos 60 dias"], ["mes", "Este mês"], ["mes-passado", "Mês passado"], ["90d", "Últimos 90 dias"],
];
const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}`;
const full = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const parseBr = (t: string) => {
  const m = t.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) ? iso(d) : null;
};
const span = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;

export function DateRange({ current, from, to, label, presets }: { current: string; from: string; to: string; label: string; presets?: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(current === "custom");
  const [a, setA] = useState<string>(from);
  const [b, setB] = useState<string | null>(to);
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(to + "T12:00:00"); return new Date(d.getFullYear(), d.getMonth() - 1, 1); });
  const [ta, setTa] = useState(full(from));
  const [tb, setTb] = useState(full(to));
  const ref = useRef<HTMLDivElement>(null);
  const today = iso(new Date());
  const thisYear = new Date().getFullYear();

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const up = () => setDrag(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("pointerup", up);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("pointerup", up); };
  }, []);
  useEffect(() => { setTa(full(a)); }, [a]);
  useEffect(() => { setTb(b ? full(b) : ""); }, [b]);

  const go = (q: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const k of ["p", "de", "ate"]) sp.delete(k);
    for (const [k, v] of Object.entries(q)) sp.set(k, v);
    setOpen(false);
    router.push(`${path}?${sp.toString()}`);
  };

  const months = useMemo(() => [month, new Date(month.getFullYear(), month.getMonth() + 1, 1)], [month]);
  const setRange = (x: string, y: string) => { if (y < x) [x, y] = [y, x]; setA(x); setB(y); };

  // clique: 1º clique começa, 2º termina. Arrastar: segura no início e solta no fim.
  const down = (d: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (d > today) return;
    e.preventDefault();
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    setCustom(true);
    if (b === null && a) { setRange(a, d); return; }
    setA(d); setB(null); setDrag(d);
  };
  const enter = (d: string) => {
    if (d > today) return;
    setHover(d);
    if (drag && d !== drag) { const [x, y] = d < drag ? [d, drag] : [drag, d]; setA(x); setB(y); }
  };
  const showEnd = b ?? (hover && hover >= a ? hover : null);
  const showStart = !b && hover && hover < a ? hover : a;
  const list = presets ? PRESETS.filter(([k]) => presets.includes(k)) : PRESETS;
  const jump = (y: number, m: number) => setMonth(new Date(y, m, 1));

  return (
    <div className="dp" ref={ref}>
      <button type="button" className={`btn dp-btn${open ? " on" : ""}`} onClick={() => setOpen((o) => !o)}>
        <CalendarDays size={16} /> {current === "custom" ? "Período" : label} <span className="dim" style={{ fontWeight: 400 }}>{from === to ? fmt(from) : `${fmt(from)} a ${fmt(to)}`}</span> <ChevronDown size={14} className="chev" />
      </button>
      {open && (
        <div className="dp-pop">
          <div className="dp-pre">
            <div className="dp-pre-t">Atalhos</div>
            {list.map(([k, l]) => (
              <button key={k} type="button" className={!custom && current === k ? "on" : ""} onClick={() => go({ p: k })}>
                {l}{!custom && current === k && <Check size={14} />}
              </button>
            ))}
            <button type="button" className={custom ? "on" : ""} onClick={() => setCustom(true)}>Personalizado{custom && <Check size={14} />}</button>
          </div>
          <div>
            <div className="dp-top">
              <label className="dp-field">
                <span>De</span>
                <input value={ta} onChange={(e) => setTa(e.target.value)} onBlur={() => { const v = parseBr(ta); if (v && v <= today) { setCustom(true); setRange(v, b ?? v); jump(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1); } else setTa(full(a)); }} placeholder="dd/mm/aaaa" inputMode="numeric" />
              </label>
              <span className="dim">até</span>
              <label className="dp-field">
                <span>Até</span>
                <input value={tb} onChange={(e) => setTb(e.target.value)} onBlur={() => { const v = parseBr(tb); if (v && v <= today) { setCustom(true); setRange(a, v); } else setTb(b ? full(b) : ""); }} placeholder="dd/mm/aaaa" inputMode="numeric" />
              </label>
              <div className="dp-jump">
                <select value={month.getMonth()} onChange={(e) => jump(month.getFullYear(), Number(e.target.value))} aria-label="Mês">
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select value={month.getFullYear()} onChange={(e) => jump(Number(e.target.value), month.getMonth())} aria-label="Ano">
                  {Array.from({ length: thisYear - 2019 }, (_, i) => thisYear - i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="dp-cal" onPointerLeave={() => setHover(null)}>
              {months.map((m, mi) => {
                const first = new Date(m.getFullYear(), m.getMonth(), 1).getDay();
                const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
                const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(m.getFullYear(), m.getMonth(), i + 1)))];
                return (
                  <div className="dp-m" key={mi}>
                    <div className="dp-mh">
                      {mi === 0 ? <button type="button" onClick={() => jump(month.getFullYear(), month.getMonth() - 1)} aria-label="Mês anterior"><ChevronLeft size={15} /></button> : <span style={{ width: 30 }} />}
                      <span>{MONTHS[m.getMonth()]} de {m.getFullYear()}</span>
                      {mi === 1 ? <button type="button" onClick={() => jump(month.getFullYear(), month.getMonth() + 1)} aria-label="Próximo mês"><ChevronRight size={15} /></button> : <span style={{ width: 30 }} />}
                    </div>
                    <div className="dp-g" style={{ touchAction: "none" }}>
                      {WD.map((w, i) => <span key={i} className="wd">{w}</span>)}
                      {cells.map((d, i) => {
                        if (!d) return <span key={i} className="d out" />;
                        const s = showStart, e = showEnd;
                        const isStart = d === s, isEnd = !!e && d === e;
                        const inR = !!e && d > s && d < e;
                        return (
                          <button key={i} type="button" onPointerDown={(ev) => down(d, ev)} onPointerEnter={() => enter(d)}
                            className={`d${d > today ? " fut" : ""}${isStart ? " edge st" : ""}${isEnd ? " edge en" : ""}${inR ? " in" : ""}${isStart && e && e !== s ? " has" : ""}${d === today ? " today" : ""}${!b ? " pv" : ""}`}>
                            {Number(d.slice(8))}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="dp-foot">
              <span>
                {b ? <><b style={{ color: "#fff" }}>{full(a)}</b> até <b style={{ color: "#fff" }}>{full(b)}</b> · {span(a, b)} dia(s)</> : "Clique no dia final ou arraste por cima dos dias"}
              </span>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn sm ghost" onClick={() => setOpen(false)}>Cancelar</button>
                <button type="button" className="btn pri sm" disabled={!b} onClick={() => b && go({ p: "custom", de: a, ate: b })}>Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
