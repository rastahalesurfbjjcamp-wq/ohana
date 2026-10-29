import Link from "next/link";
import { AtSign, ChevronLeft, ChevronRight, ImageIcon, Plus, Repeat, X } from "lucide-react";
import { db } from "@/lib/db";
import { addDays, isoDayLocal } from "@/lib/time";
import { Header } from "@/components/ui";
import { ScheduleForm } from "@/components/ScheduleForm";
import { cancelSchedule, createSchedule, retrySchedule } from "../actions";

export const dynamic = "force-dynamic";

const STATUS = {
  SCHEDULED: ["agendado", "c-k", "ev-k"],
  SENDING: ["enviando", "c-s", "ev-s"],
  SENT: ["enviado", "c-l", "ev-l"],
  FAILED: ["falhou", "c-c", "ev-c"],
  CANCELED: ["cancelado", "c-n", "ev-n"],
} as const;
const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const tz = "America/Sao_Paulo";
const hhmm = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });

export default async function Agendamentos({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; v?: string; d?: string; id?: string; novo?: string }> }) {
  const sp = await searchParams;
  const view = sp.v === "dia" || sp.v === "mes" ? sp.v : "semana";
  const today = isoDayLocal();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : today;
  const dow = new Date(`${anchor}T12:00:00`).getDay();
  let days: string[];
  if (view === "dia") days = [anchor];
  else if (view === "semana") { const mon = addDays(anchor, -((dow + 6) % 7)); days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)); }
  else {
    const first = `${anchor.slice(0, 7)}-01`;
    const fdow = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
    const startGrid = addDays(first, -fdow);
    days = Array.from({ length: 42 }, (_, i) => addDays(startGrid, i));
    if (days[35].slice(0, 7) !== anchor.slice(0, 7)) days = days.slice(0, 35);
  }
  const stepDays = view === "dia" ? 1 : view === "semana" ? 7 : 0;
  const nav = (dir: 1 | -1) => {
    if (stepDays) return addDays(anchor, dir * stepDays);
    const [y, m] = anchor.split("-").map(Number);
    const nm = new Date(y, m - 1 + dir, 1);
    return `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, "0")}-01`;
  };
  const href = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const v = { v: view === "semana" ? undefined : view, d: anchor === today ? undefined : anchor, ...q };
    for (const [k, val] of Object.entries(v)) if (val) p.set(k, val);
    return `/agendamentos${p.toString() ? `?${p}` : ""}`;
  };

  const rangeStart = new Date(`${days[0]}T03:00:00Z`);
  const rangeEnd = new Date(`${addDays(days[days.length - 1], 1)}T03:00:00Z`);
  const [groups, list, sel] = await Promise.all([
    db.group.findMany({ where: { archived: false }, orderBy: [{ isCommunity: "desc" }, { name: "asc" }] }),
    db.scheduledMessage.findMany({ where: { sendAt: { gte: rangeStart, lt: rangeEnd }, status: { not: "CANCELED" } }, orderBy: { sendAt: "asc" } }),
    sp.id ? db.scheduledMessage.findUnique({ where: { id: sp.id } }) : null,
  ]);
  const names = new Map(groups.map((g) => [g.jid, g.name]));
  const byDay = (d: string) => list.filter((m) => isoDayLocal(m.sendAt) === d);
  const fd = (d: string) => `${Number(d.slice(8))} de ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
  const title = view === "dia" ? `${WD[new Date(`${anchor}T12:00:00`).getDay()]}, ${fd(anchor)}` : view === "semana" ? `${fd(days[0])} a ${fd(days[6])}` : `${MONTHS[Number(anchor.slice(5, 7)) - 1]} de ${anchor.slice(0, 4)}`;
  const opts = groups.map((g) => ({ jid: g.jid, name: g.name, size: g.size, tag: g.isResults ? "resultados" : g.isCommunity ? "comunidade" : undefined, checked: g.isCommunity && !g.isResults }));

  const Event = ({ m, compact }: { m: (typeof list)[number]; compact?: boolean }) => (
    <Link href={href({ id: m.id })} className={`sev ${STATUS[m.status][2]}${sel?.id === m.id ? " on" : ""}`} title={m.text}>
      <b>{hhmm.format(m.sendAt)}{m.repeat ? " ↻" : ""}</b>
      <span className={compact ? "one" : ""}>{m.text.split("\n")[0].slice(0, compact ? 40 : 90)}</span>
    </Link>
  );

  return (
    <>
      <Header title="Agendamentos" lede="Programe mensagens para os grupos e marque todos os membros de uma vez.">
        <div className="seg">{[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]].map(([k, l]) => <Link key={k} href={`/agendamentos?${k === "semana" ? "" : `v=${k}`}${anchor !== today ? `${k === "semana" ? "" : "&"}d=${anchor}` : ""}`} className={view === k ? "on" : ""}>{l}</Link>)}</div>
      </Header>
      {sp.ok && <div className="ok">Mensagem agendada.</div>}
      {sp.erro && <div className="err">Preencha o texto, a data e escolha pelo menos um grupo.</div>}
      <div className="cols c-2-1" style={{ alignItems: "start" }}>
        <section className="pnl" style={{ padding: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 650, textTransform: "none" }}>{title}</h3>
              <small className="dim">{list.length} mensage{list.length === 1 ? "m programada" : "ns programadas"}</small>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {anchor !== today && <Link className="btn sm" href={href({ d: undefined })}>Hoje</Link>}
              <Link className="btn sm" href={href({ d: nav(-1) })} aria-label="Anterior"><ChevronLeft size={16} /></Link>
              <Link className="btn sm" href={href({ d: nav(1) })} aria-label="Próximo"><ChevronRight size={16} /></Link>
            </div>
          </div>

          {view === "mes" ? (
            <div className="mcal">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => <div className="wd" key={w}>{w}</div>)}
              {days.map((d) => {
                const evs = byDay(d);
                return (
                  <div key={d} className={`cell${d.slice(0, 7) !== anchor.slice(0, 7) ? " out" : ""}${d === today ? " today" : ""}`}>
                    <Link className="n" href={`/agendamentos?v=dia&d=${d}`}>{Number(d.slice(8))}</Link>
                    {evs.slice(0, 3).map((m) => <Event key={m.id} m={m} compact />)}
                    {evs.length > 3 && <Link className="dim" style={{ fontSize: 11 }} href={`/agendamentos?v=dia&d=${d}`}>+{evs.length - 3}</Link>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="wk" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d) => (
                <div key={d} className={`wk-c${d === today ? " today" : ""}${d < today ? " past" : ""}`}>
                  <Link className="wk-h" href={`/agendamentos?v=dia&d=${d}`}>{WD[new Date(`${d}T12:00:00`).getDay()]} {Number(d.slice(8))}</Link>
                  {byDay(d).map((m) => <Event key={m.id} m={m} />)}
                  {d >= today && <Link className="wk-add" href={href({ novo: d })} title="Agendar neste dia"><Plus size={14} /></Link>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pnl" style={{ padding: 20 }}>
          {sel ? (
            <div className="stack">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>Mensagem</h3>
                <Link className="menu-b" href={href({ id: undefined })} aria-label="Fechar"><X size={16} /></Link>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className={`chip ${STATUS[sel.status][1]}`}>{STATUS[sel.status][0]}</span>
                <span className="mut" style={{ fontSize: 13 }}>{new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(sel.sendAt)}</span>
              </div>
              <div className="bubble">{sel.text}</div>
              <div className="row" style={{ gap: 12, fontSize: 12.5 }} >
                {sel.mentionAll && <span className="mut"><AtSign size={13} /> marca todos</span>}
                {sel.mediaUrl && <span className="mut"><ImageIcon size={13} /> com anexo</span>}
                {sel.repeat && <span className="mut"><Repeat size={13} /> {sel.repeat === "daily" ? "todo dia" : "toda semana"}</span>}
              </div>
              <div className="dim" style={{ fontSize: 12.5 }}>{sel.groupJids.map((j) => names.get(j) ?? j).join(", ")}</div>
              {sel.error && <div className="err">{sel.error}</div>}
              <div className="row">
                {sel.status === "FAILED" && <form action={retrySchedule}><input type="hidden" name="id" value={sel.id} /><button className="btn pri sm" type="submit">Tentar de novo</button></form>}
                {(sel.status === "SCHEDULED" || sel.status === "FAILED") && <form action={cancelSchedule}><input type="hidden" name="id" value={sel.id} /><button className="btn sm danger" type="submit">Cancelar envio</button></form>}
                <Link className="btn sm" href={href({ id: undefined })}><Plus size={14} /> Nova mensagem</Link>
              </div>
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Nova mensagem{sp.novo ? ` para ${sp.novo.slice(8)}/${sp.novo.slice(5, 7)}` : ""}</h3>
              <ScheduleForm key={sp.novo ?? "x"} action={createSchedule} groups={opts} defaultDate={sp.novo && /^\d{4}-\d{2}-\d{2}$/.test(sp.novo) ? `${sp.novo}T19:00` : undefined} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
