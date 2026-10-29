import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, LogIn, LogOut, Megaphone, RotateCcw, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeMetrics, type Metrics } from "@/lib/report";
import { brl, dayRange, isoDayLocal } from "@/lib/time";
import { addDays } from "@/lib/time";
import { AreaChart } from "@/components/charts";
import { AutoRefresh } from "@/components/AutoRefresh";
import { onboardingSteps } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

const RANGES: [string, string, number][] = [["30", "30 dias", 30], ["90", "90 dias", 90], ["ano", "Ano", 365]];
const tz = "America/Sao_Paulo";

function ago(d: Date) {
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const range = RANGES.find((x) => x[0] === r) ?? RANGES[0];
  const today = isoDayLocal();
  const { start } = dayRange(today);
  const from = addDays(today, -(range[2] - 1));
  const session = await getSession();
  const ob = await onboardingSteps();
  const obDone = ob.filter((x) => x.done).length;
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  let m: Metrics | null = null;
  try {
    m = await computeMetrics(today, today);
  } catch {
    m = null;
  }
  const community = { group: { isCommunity: true } };
  const week = new Date(Date.now() - 7 * 864e5);
  const [todayEv, feed, next, groups, history, sentDays, weekEv] = await Promise.all([
    db.memberEvent.groupBy({ by: ["type"], where: { createdAt: { gte: start }, ...community }, _count: true }),
    db.memberEvent.findMany({ where: community, orderBy: { createdAt: "desc" }, take: 7, include: { contact: true, group: true } }),
    db.scheduledMessage.findMany({ where: { status: "SCHEDULED" }, orderBy: { sendAt: "asc" }, take: 4 }),
    db.group.findMany({ where: { isCommunity: true, archived: false }, orderBy: { size: "desc" } }),
    db.memberEvent.findMany({ where: { createdAt: { gte: dayRange(from).start }, ...community }, select: { type: true, createdAt: true } }),
    db.scheduledMessage.findMany({ where: { status: "SENT", sendAt: { gte: dayRange(from).start } }, select: { sendAt: true, text: true }, orderBy: { sendAt: "asc" } }),
    db.memberEvent.groupBy({ by: ["groupId", "type"], where: { createdAt: { gte: week }, ...community }, _count: true }),
  ]);
  const count = (t: string) => todayEv.find((e) => e.type === t)?._count ?? 0;
  const members = groups.reduce((s, g) => s + g.size, 0);

  // Reconstrói o total de membros dia a dia, voltando a partir do total de hoje
  const net = new Map<string, number>();
  for (const e of history) {
    const d = isoDayLocal(e.createdAt);
    net.set(d, (net.get(d) ?? 0) + (e.type === "LEAVE" ? -1 : 1));
  }
  const days: string[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) days.push(d);
  const series: { label: string; value: number }[] = [];
  let level = members;
  for (let i = days.length - 1; i >= 0; i--) {
    series.unshift({ label: `${days[i].slice(8)}/${days[i].slice(5, 7)}`, value: level });
    level -= net.get(days[i]) ?? 0;
  }
  const startLevel = series[0]?.value ?? members;
  const growth = members - startLevel;
  const markers: { index: number; label: string }[] = [];
  for (const s of sentDays) {
    const i = days.indexOf(isoDayLocal(s.sendAt));
    if (i >= 0 && !markers.some((mk) => mk.index === i)) markers.push({ index: i, label: s.text.split("\n")[0].slice(0, 22) });
  }

  const weekBy = (gid: string) => {
    const j = weekEv.filter((w) => w.groupId === gid && w.type !== "LEAVE").reduce((s, w) => s + w._count, 0);
    const l = weekEv.filter((w) => w.groupId === gid && w.type === "LEAVE").reduce((s, w) => s + w._count, 0);
    return j - l;
  };
  const full = groups.filter((g) => g.capacity && g.size / g.capacity >= 0.95);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const evInfo: Record<string, { icon: typeof LogIn; tone: string; verb: string }> = {
    JOIN: { icon: LogIn, tone: "t-l", verb: "entrou em" },
    RETURN: { icon: RotateCcw, tone: "t-k", verb: "voltou para" },
    LEAVE: { icon: LogOut, tone: "t-c", verb: "saiu de" },
  };

  return (
    <>
      <AutoRefresh seconds={60} />
      <div className="hd row" style={{ justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 30, letterSpacing: "-.03em" }}>{hello}, {session?.name.split(" ")[0]}</h1>
          <p className="mut" style={{ marginTop: 6 }}>
            {new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date())}
            <span className="live-dot" style={{ marginLeft: 12 }} /> ao vivo
          </p>
        </div>
        <div className="row acts">
          <Link className="btn" href="/agendamentos"><CalendarClock size={16} /> Agendar</Link>
          <Link className="btn pri" href="/disparos"><Megaphone size={16} /> Novo disparo</Link>
        </div>
      </div>

      {obDone < ob.length && (
        <Link href="/comecar" className="callout lagoon" style={{ alignItems: "center" }}>
          <b>Falta pouco para a loja ficar pronta: {obDone} de {ob.length} passos.</b>
          <span className="dim">Próximo: {ob.find((x) => !x.done)?.title}</span>
          <span className="act">Continuar <ArrowRight size={14} /></span>
        </Link>
      )}
      <div className="cols c-2-1">
        <section className="pnl" style={{ padding: 26 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="row" style={{ gap: 10 }}>
                <span className="tile sm t-l"><Users size={17} /></span>
                <span className="mut">Pessoas na comunidade</span>
              </div>
              <div className="row" style={{ alignItems: "baseline", gap: 14, marginTop: 14 }}>
                <span className="hero-num">{members.toLocaleString("pt-BR")}</span>
                <span className={`delta ${growth >= 0 ? "up" : "dn"}`}>{growth >= 0 ? "+" : ""}{growth.toLocaleString("pt-BR")} em {range[1].toLowerCase()}</span>
              </div>
            </div>
            <div className="seg">
              {RANGES.map(([k, l]) => <Link key={k} href={k === "30" ? "/" : `/?r=${k}`} className={range[0] === k ? "on" : ""}>{l}</Link>)}
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            {groups.length ? (
              <AreaChart id="mem" data={series} markers={markers} height={230} format={(v) => v.toLocaleString("pt-BR")} />
            ) : (
              <div className="empty">Marque os grupos da comunidade em Grupos para ver a evolução aqui.</div>
            )}
          </div>
          {markers.length > 0 && <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Marcas amarelas: dias com mensagem enviada aos grupos</div>}
        </section>

        <section className="pnl" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Hoje</h3>
          {[
            { l: "Entraram", v: count("JOIN"), icon: LogIn, tone: "t-l", href: "/entradas" },
            { l: "Saíram", v: count("LEAVE"), icon: LogOut, tone: "t-c", href: "/entradas?t=LEAVE" },
            { l: "Voltaram", v: count("RETURN"), icon: RotateCcw, tone: "t-k", href: "/entradas" },
          ].map((x) => (
            <Link href={x.href} className="lrow" key={x.l} style={{ color: "inherit" }}>
              <span className={`tile ${x.tone}`}><x.icon size={18} /></span>
              <div className="t">{x.l}</div>
              <div className="end mid-num" style={{ fontSize: 28 }}>{x.v}</div>
            </Link>
          ))}
          <div className="lrow">
            <span className="tile t-s"><ShoppingBag size={18} /></span>
            <div>
              <div className="t">Vendas</div>
              <div className="s">{m ? `${m.orders} pedidos` : "conecte a Shopify"}</div>
            </div>
            <div className="end mid-num" style={{ fontSize: 24 }}>{m ? brl(m.net, 0) : "–"}</div>
          </div>
          <div className="lrow">
            <span className="tile t-p"><TrendingUp size={18} /></span>
            <div>
              <div className="t">Lucro</div>
              <div className="s">antes dos custos fixos{m?.ads != null ? ` · anúncios ${brl(m.ads, 0)}` : ""}</div>
            </div>
            <div className={`end mid-num ${m && m.profitBeforeFixed < 0 ? "dn" : "up"}`} style={{ fontSize: 24 }}>{m ? brl(m.profitBeforeFixed, 0) : "–"}</div>
          </div>
        </section>
      </div>

      <div className="cols c-1-1-1">
        <section className="pnl" style={{ padding: 22 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Agora na comunidade</h3>
            <span className="live-dot" />
          </div>
          {feed.length ? feed.map((e) => {
            const info = evInfo[e.type] ?? evInfo.JOIN;
            return (
              <div className="lrow" key={e.id}>
                <span className={`tile sm ${info.tone}`}><info.icon size={15} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="t" style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.contact.name || `+${e.contact.phone}`}</div>
                  <div className="s" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{info.verb} {e.group.name}</div>
                </div>
                <span className="dim end" style={{ fontSize: 12 }}>{ago(e.createdAt)}</span>
              </div>
            );
          }) : <div className="empty">Nenhum movimento ainda.</div>}
        </section>

        <section className="pnl" style={{ padding: 22 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Grupos</h3>
            <Link className="btn sm ghost" href="/grupos">Ver todos <ArrowRight size={14} /></Link>
          </div>
          {full.length > 0 && (
            <div className="callout coral" style={{ margin: "8px 0" }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <div>{full.length === 1 ? `${full[0].name} está cheio.` : `${full.length} grupos estão cheios.`} O link de convite já manda as pessoas para um grupo com vaga.</div>
            </div>
          )}
          {groups.length ? groups.slice(0, 6).map((g) => {
            const w = weekBy(g.id);
            const ratio = g.capacity ? g.size / g.capacity : 0;
            return (
              <div className="lrow" key={g.id} style={{ display: "block" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="t" style={{ fontSize: 13.5 }}>{g.name}</span>
                  <span className="row" style={{ gap: 10 }}>
                    <span className={`delta ${w >= 0 ? "up" : "dn"}`}>{w >= 0 ? "+" : ""}{w} 7d</span>
                    <span className="dim" style={{ fontSize: 12 }}>{g.size}/{g.capacity}</span>
                  </span>
                </div>
                <div className="hbar" style={{ marginTop: 8 }}><i className={ratio >= 0.95 ? "c" : ratio >= 0.8 ? "s" : ""} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
              </div>
            );
          }) : <div className="empty">Nenhum grupo marcado.</div>}
        </section>

        <section className="pnl" style={{ padding: 22 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Próximos envios</h3>
            <Link className="btn sm ghost" href="/agendamentos">Agenda <ArrowRight size={14} /></Link>
          </div>
          {next.length ? next.map((s) => (
            <div className="lrow" key={s.id}>
              <span className="tile sm t-s"><CalendarClock size={15} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="t" style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.text.split("\n")[0]}</div>
                <div className="s" style={{ textTransform: "capitalize" }}>{fmt.format(s.sendAt)} · {s.groupJids.length} grupo(s)</div>
              </div>
            </div>
          )) : (
            <div className="empty-art" style={{ padding: "24px 0" }}>
              <p className="mut" style={{ marginBottom: 12 }}>Nada agendado.</p>
              <Link className="btn pri sm" href="/agendamentos">Agendar mensagem</Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
