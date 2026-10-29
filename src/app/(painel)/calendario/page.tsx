import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, MapPin, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { customers } from "@/lib/store";
import { holidaysForYear, upcomingHolidays, ufFromCep, type Holiday } from "@/lib/holidays";
import { isoDayLocal, weekdayName } from "@/lib/time";
import { Header, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const pad = (n: number) => String(n).padStart(2, "0");
type Ev = { date: string; name: string; kind: Holiday["kind"] | "loja"; uf?: string; tip?: string };

export default async function Calendario({ searchParams }: { searchParams: Promise<{ m?: string; uf?: string }> }) {
  const sp = await searchParams;
  const today = isoDayLocal();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7);
  const uf = sp.uf && /^[A-Z]{2}$/.test(sp.uf) ? sp.uf : "";
  const [y, mo] = month.split("-").map(Number);
  const prevM = mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`;
  const nextM = mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`;
  const link = (q: { m?: string; uf?: string }) => {
    const p = new URLSearchParams();
    const mm = q.m ?? month;
    const u = q.uf ?? uf;
    if (mm !== today.slice(0, 7)) p.set("m", mm);
    if (u) p.set("uf", u);
    const s = p.toString();
    return `/calendario${s ? `?${s}` : ""}`;
  };

  const byUf = new Map<string, number>();
  let total = 0;
  let hasCustomers = false;
  try {
    for (const c of await customers()) {
      total++;
      const u = c.state ?? ufFromCep(c.zip);
      if (u) byUf.set(u, (byUf.get(u) ?? 0) + 1);
    }
    hasCustomers = true;
  } catch {
    hasCustomers = false;
  }
  const keepState = (h: Holiday) => h.kind !== "estadual" || (uf ? h.uf === uf : !hasCustomers || (h.uf ? (byUf.get(h.uf) ?? 0) > 0 : false));
  const mStart = new Date(Date.UTC(y, mo - 1, 1));
  const mEnd = new Date(Date.UTC(y, mo, 1));
  const [scheduled, launches] = await Promise.all([
    db.scheduledMessage.findMany({ where: { status: "SCHEDULED", sendAt: { gte: mStart, lt: mEnd } }, select: { sendAt: true, text: true } }),
    db.launch.findMany({ where: { opensAt: { gte: mStart, lt: mEnd } }, select: { opensAt: true, name: true } }),
  ]);
  const events: Ev[] = [
    ...holidaysForYear(y).filter((h) => h.date.startsWith(month) && keepState(h)),
    ...launches.map((l) => ({ date: isoDayLocal(l.opensAt), name: `Lançamento: ${l.name}`, kind: "loja" as const })),
    ...scheduled.map((s) => ({ date: isoDayLocal(s.sendAt), name: s.text.split("\n")[0].slice(0, 40), kind: "loja" as const })),
  ];

  // grade de semanas
  const first = new Date(y, mo - 1, 1).getDay();
  const dim = new Date(y, mo, 0).getDate();
  const cells: { d: string; out: boolean }[] = [];
  for (let i = first; i > 0; i--) {
    const dt = new Date(y, mo - 1, 1 - i);
    cells.push({ d: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, out: true });
  }
  for (let i = 1; i <= dim; i++) cells.push({ d: `${month}-${pad(i)}`, out: false });
  while (cells.length % 7) {
    const dt = new Date(y, mo - 1, dim + (cells.length - first - dim) + 1);
    cells.push({ d: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, out: true });
  }

  const daysTo = (d: string) => Math.round((Date.parse(d) - Date.parse(today)) / 864e5);
  const opps = upcomingHolidays(today, 120).filter((h) => (h.kind === "comercial" || h.kind === "nacional") && keepState(h)).slice(0, 4);
  const states = [...byUf.entries()].sort((a, b) => b[1] - a[1]);
  const stMax = states[0]?.[1] ?? 1;
  const monthName = new Date(y, mo - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <Header title="Calendário de vendas" lede="Feriados nacionais, estaduais (pelo estado dos seus clientes) e datas boas para vender, junto com o que você já agendou.">
        <div className="seg">
          <Link href={link({ m: prevM })} aria-label="Mês anterior"><ChevronLeft size={15} /></Link>
          <Link href={link({ m: today.slice(0, 7) })} className={month === today.slice(0, 7) ? "on" : ""} style={{ textTransform: "capitalize", minWidth: 150, textAlign: "center" }}>{monthName}</Link>
          <Link href={link({ m: nextM })} aria-label="Próximo mês"><ChevronRight size={15} /></Link>
        </div>
        {uf ? <Link className="btn" href={link({ uf: "" })}><MapPin size={15} /> {uf} · ver todos</Link> : <span className="btn" style={{ cursor: "default" }}><MapPin size={15} /> Todos os estados</span>}
      </Header>

      <div className="cols c-3-1">
        <section className="pnl" style={{ padding: 20 }}>
          <div className="legend" style={{ marginBottom: 14 }}>
            <span><i style={{ background: "#34c26a" }} />Nacional</span>
            <span><i style={{ background: "#a78bfa" }} />Estadual</span>
            <span><i style={{ background: "#f7c928" }} />Data do varejo</span>
            <span><i style={{ background: "#ef4444" }} />{env.storeName()}</span>
          </div>
          <div className="mcal">
            {WD.map((w) => <div className="wd" key={w}>{w}</div>)}
            {cells.map((c) => {
              const evs = events.filter((e) => e.date === c.d);
              return (
                <div key={c.d} className={`cell${c.out ? " out" : ""}${c.d === today ? " today" : ""}`}>
                  <span className="n">{Number(c.d.slice(8))}</span>
                  {!c.out && evs.slice(0, 3).map((e, i) => <span key={i} className={`ev ${e.kind}`} title={e.tip ? `${e.name}: ${e.tip}` : e.name}>{e.name}{e.uf ? ` (${e.uf})` : ""}</span>)}
                  {!c.out && evs.length > 3 && <span className="dim" style={{ fontSize: 11 }}>+{evs.length - 3}</span>}
                </div>
              );
            })}
          </div>
        </section>

        <div className="stack">
          <Panel title="Próximas oportunidades">
            <div className="stack" style={{ gap: 10 }}>
              {opps.map((h) => (
                <div className="opp" key={h.date + h.name}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="when" style={{ textTransform: "capitalize" }}>{weekdayName(h.date)}, {h.date.slice(8)}/{h.date.slice(5, 7)}</span>
                    <span className={`ev ${h.kind}`} style={{ fontSize: 11 }}>{h.kind === "comercial" ? "varejo" : h.kind}</span>
                  </div>
                  <b style={{ fontSize: 15 }}>{h.name}</b>
                  <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
                    <span className="big">{daysTo(h.date)}</span><span className="dim">dias</span>
                    {hasCustomers && <span className="mut" style={{ marginLeft: "auto", fontSize: 12.5 }}>{total.toLocaleString("pt-BR")} clientes</span>}
                  </div>
                  {h.tip && <div className="dim" style={{ fontSize: 12.5 }}><Sparkles size={12} /> {h.tip}</div>}
                  <Link className="btn pri sm" href="/agendamentos" style={{ alignSelf: "flex-start" }}><CalendarClock size={14} /> Agendar</Link>
                </div>
              ))}
              {!opps.length && <div className="empty">Nada nos próximos meses.</div>}
            </div>
          </Panel>
          <Panel title="Clientes por estado" sub={hasCustomers ? "Clique para ver os feriados do estado" : "Conecte a Shopify"}>
            {states.slice(0, 8).map(([s, n]) => (
              <Link href={link({ uf: s })} className="lrow" key={s} style={{ color: "inherit", padding: "9px 0" }}>
                <b style={{ width: 28 }}>{s}</b>
                <div className="hbar" style={{ flex: 1 }}><i className={s === uf ? "s" : ""} style={{ width: `${(n / stMax) * 100}%` }} /></div>
                <span className="mut end" style={{ width: 50 }}>{n}</span>
              </Link>
            ))}
            {hasCustomers && !states.length && <div className="empty">Sem estado nos cadastros.</div>}
          </Panel>
        </div>
      </div>
    </>
  );
}
