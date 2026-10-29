"use client";
// Seletor de período: atalhos + calendário de dois meses para escolher de/até.
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const PRESETS: [string, string][] = [
  ["hoje", "Hoje"], ["ontem", "Ontem"], ["7d", "Últimos 7 dias"], ["30d", "Últimos 30 dias"],
  ["mes", "Este mês"], ["mes-passado", "Mês passado"], ["90d", "Últimos 90 dias"],
];
const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}`;

export function DateRange({ current, from, to, label, presets }: { current: string; from: string; to: string; label: string; presets?: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<string | null>(current === "custom" ? from : null);
  const [b, setB] = useState<string | null>(current === "custom" ? to : null);
  const [month, setMonth] = useState(() => { const d = new Date(to + "T12:00:00"); return new Date(d.getFullYear(), d.getMonth() - 1, 1); });
  const ref = useRef<HTMLDivElement>(null);
  const today = iso(new Date());

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (q: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const k of ["p", "de", "ate"]) sp.delete(k);
    for (const [k, v] of Object.entries(q)) sp.set(k, v);
    setOpen(false);
    router.push(`${path}?${sp.toString()}`);
  };

  const months = useMemo(() => [month, new Date(month.getFullYear(), month.getMonth() + 1, 1)], [month]);
  const pick = (d: string) => {
    if (d > today) return;
    if (!a || (a && b)) { setA(d); setB(null); }
    else if (d < a) { setB(a); setA(d); }
    else setB(d);
  };
  const list = presets ? PRESETS.filter(([k]) => presets.includes(k)) : PRESETS;

  return (
    <div className="dp" ref={ref}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)}>
        <CalendarDays size={16} /> {label} <span className="dim" style={{ fontWeight: 400 }}>{from === to ? fmt(from) : `${fmt(from)} a ${fmt(to)}`}</span> <ChevronDown size={14} />
      </button>
      {open && (
        <div className="dp-pop">
          <div className="dp-pre">
            {list.map(([k, l]) => (
              <button key={k} type="button" className={current === k ? "on" : ""} onClick={() => go({ p: k })}>{l}</button>
            ))}
            <button type="button" className={current === "custom" ? "on" : ""} onClick={() => { setA(null); setB(null); }}>Escolher datas</button>
          </div>
          <div>
            <div className="dp-cal">
              {months.map((m, mi) => {
                const first = new Date(m.getFullYear(), m.getMonth(), 1).getDay();
                const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
                const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(m.getFullYear(), m.getMonth(), i + 1)))];
                return (
                  <div className="dp-m" key={mi}>
                    <div className="dp-mh">
                      {mi === 0 ? <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={15} /></button> : <span style={{ width: 30 }} />}
                      <span>{m.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
                      {mi === 1 ? <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={15} /></button> : <span style={{ width: 30 }} />}
                    </div>
                    <div className="dp-g">
                      {WD.map((w, i) => <span key={i} className="wd">{w}</span>)}
                      {cells.map((d, i) => {
                        if (!d) return <span key={i} className="d out" />;
                        const end = b ?? a;
                        const isEdge = d === a || d === b;
                        const inRange = a && end && d > a && d < end;
                        return (
                          <button key={i} type="button" onClick={() => pick(d)}
                            className={`d${d > today ? " fut" : ""}${isEdge ? " edge" : ""}${inRange ? " in" : ""}${d === today ? " today" : ""}`}>
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
              <span>{a ? (b ? `${fmt(a)} a ${fmt(b)}` : `${fmt(a)}, escolha o fim`) : "Escolha o início e o fim"}</span>
              <button type="button" className="btn pri sm" disabled={!a} onClick={() => a && go({ p: "custom", de: a, ate: b ?? a })}>Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
