import { NumberInput } from "@/components/NumberInput";
import Link from "next/link";
import { Download, RotateCcw, UserMinus, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/phone";
import { addDays, isoDayLocal } from "@/lib/time";
import { daysBetween } from "@/lib/periods";
import { Panel } from "@/components/ui";
import { AutoRefresh } from "@/components/AutoRefresh";
import { saveWinback } from "../actions";
import { NxHead, NxRow2, NxHero, NxStat, NxBars, NxTabsCard, NxFilters, NxPill, NxPanel, NxItem, NxEmpty, NxDHead, NxDNum, NxDText, NxWho, NxDCards, NxDFoot, NxBtn, NxQuote } from "@/components/nx";

export const dynamic = "force-dynamic";

const RANGES: [string, string, number][] = [["hoje", "Hoje", 1], ["7", "7 dias", 7], ["30", "30 dias", 30]];
const INFO = {
  JOIN: { icon: UserPlus, tone: "t-l", verb: "entrou no" },
  RETURN: { icon: RotateCcw, tone: "t-s", verb: "voltou para o" },
  LEAVE: { icon: UserMinus, tone: "t-c", verb: "saiu do" },
} as const;

function ago(d: Date) {
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 90) return "agora";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}
const pctDelta = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);

export default async function Entradas({ searchParams }: { searchParams: Promise<{ r?: string; g?: string; t?: string; sel?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.find((x) => x[0] === sp.r) ?? RANGES[1];
  const today = isoDayLocal();
  const fromDay = addDays(today, -(range[2] - 1));
  const since = new Date(`${fromDay}T03:00:00Z`);
  const prevSince = new Date(since.getTime() - range[2] * 864e5);
  // Só os grupos que você selecionou (comunidade e grupo de resultados)
  const chosen = await db.group.findMany({ where: { archived: false, OR: [{ isCommunity: true }, { isResults: true }] }, orderBy: [{ isResults: "asc" }, { name: "asc" }] });
  const gSel = sp.g && chosen.some((x) => x.id === sp.g) ? sp.g : undefined;
  const groupFilter = gSel ? { groupId: gSel } : { groupId: { in: chosen.map((x) => x.id) } };
  const where = { createdAt: { gte: since }, ...groupFilter };
  const wherePrev = { createdAt: { gte: prevSince, lt: since }, ...groupFilter };
  const [byType, prevByType, winbacks, events, s, hist, group] = await Promise.all([
    db.memberEvent.groupBy({ by: ["type"], where, _count: true }),
    db.memberEvent.groupBy({ by: ["type"], where: wherePrev, _count: true }),
    db.memberEvent.count({ where: { ...where, type: "LEAVE", winbackSent: true } }),
    db.memberEvent.findMany({ where: { ...groupFilter, ...(sp.t ? { type: sp.t as "JOIN" | "LEAVE" | "RETURN" } : {}) }, orderBy: { createdAt: "desc" }, take: 40, include: { contact: true, group: true } }),
    getSettings(),
    db.memberEvent.findMany({ where: { createdAt: { gte: new Date(Date.now() - (range[2] === 1 ? 7 : range[2]) * 864e5) }, ...groupFilter }, select: { type: true, createdAt: true } }),
    gSel ? db.group.findUnique({ where: { id: gSel } }) : null,
  ]);
  const c = (arr: typeof byType, t: string) => arr.find((x) => x.type === t)?._count ?? 0;
  const joins = c(byType, "JOIN"), leaves = c(byType, "LEAVE"), returns = c(byType, "RETURN");
  const pj = c(prevByType, "JOIN"), pl = c(prevByType, "LEAVE"), pr = c(prevByType, "RETURN");
  const net = joins + returns - leaves, pnet = pj + pr - pl;
  const chartDays = daysBetween(addDays(today, -((range[2] === 1 ? 7 : range[2]) - 1)), today);
  const per = new Map<string, { up: number; down: number }>();
  for (const e of hist) {
    const d = isoDayLocal(e.createdAt);
    const cur = per.get(d) ?? { up: 0, down: 0 };
    if (e.type === "LEAVE") cur.down++; else cur.up++;
    per.set(d, cur);
  }
  const bars = chartDays.map((d) => ({ label: `${d.slice(8)}/${d.slice(5, 7)}`, ...(per.get(d) ?? { up: 0, down: 0 }) }));
  // tempo de casa de quem saiu
  const leftIds = events.filter((e) => e.type === "LEAVE").map((e) => ({ g: e.groupId, c: e.contactId }));
  const memberships = leftIds.length ? await db.membership.findMany({ where: { OR: leftIds.map((x) => ({ groupId: x.g, contactId: x.c })) } }) : [];
  const stay = (gId: string, cId: string, at: Date) => {
    const m = memberships.find((x) => x.groupId === gId && x.contactId === cId);
    if (!m) return null;
    const d = Math.round((at.getTime() - m.joinedAt.getTime()) / 864e5);
    return d <= 0 ? "entrou hoje" : d === 1 ? "membro há 1 dia" : `membro há ${d} dias`;
  };
  const dj = pctDelta(joins, pj);
  const q = (k: string, v: string | null) => {
    const p = new URLSearchParams();
    const vals: Record<string, string | undefined> = { r: sp.r, g: sp.g, t: sp.t, ...(k === "sel" ? {} : {}), [k]: v ?? undefined };
    for (const [kk, vv] of Object.entries(vals)) if (vv) p.set(kk, vv);
    return `/entradas${p.toString() ? `?${p}` : ""}`;
  };

  const sel = events.find((e) => e.id === sp.sel) ?? events[0];
  const [selGroups, selHist] = sel ? await Promise.all([
    db.membership.findMany({ where: { contactId: sel.contactId }, include: { group: true } }).catch(() => []),
    db.memberEvent.findMany({ where: { contactId: sel.contactId }, orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []),
  ]) : [[], []];
  const dfmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const lastOf = (t: string) => selHist.find((h) => h.type === t)?.createdAt;
  const topGroups = [...chosen].sort((x, y) => y.size - x.size).slice(0, 3);
  const members = chosen.reduce((a2, g2) => a2 + g2.size, 0);
  const VERB: Record<string, string> = { JOIN: "Entrou", LEAVE: "Saiu", RETURN: "Voltou" };

  return (
    <>
      <AutoRefresh seconds={30} />
      <NxHead title="Entradas e saídas" back="/">
        <a className="btn" href={`/api/export/entradas?dias=${Math.max(range[2], 30)}`}><Download size={16} /> Exportar</a>
        <Link className="btn pri" href="/disparos">Novo disparo</Link>
      </NxHead>
      {chosen.length === 0 && <div className="note">Nenhum grupo selecionado ainda. Marque os grupos da comunidade em <Link href="/grupos?v=escolher" style={{ textDecoration: "underline" }}>Grupos</Link> e só eles aparecem aqui.</div>}
      <NxRow2>
        <NxHero stats={<>
          <NxStat label="Entraram" value={joins.toLocaleString("pt-BR")} sub={dj == null ? "sem período anterior" : `${dj >= 0 ? "↑" : "↓"} ${Math.abs(dj)}% vs período anterior`} tone={dj == null ? "mut" : dj >= 0 ? "up" : "dn"} />
          <NxStat label="Saíram" value={leaves.toLocaleString("pt-BR")} sub={joins ? `${Math.round((leaves / joins) * 100)}% de quem entrou` : "–"} />
          <NxStat label="Voltaram" value={returns.toLocaleString("pt-BR")} sub={winbacks ? `${winbacks} receberam a mensagem de volta` : "saíram e entraram de novo"} />
        </>}>
          <NxBars items={bars.flatMap((x) => [{ label: x.label, value: x.up }, { label: "", value: x.down, neg: true }])} ticks={7} />
        </NxHero>
        <NxTabsCard title={range[2] === 1 ? "Saldo de hoje" : `Saldo em ${range[1]}`} value={`${net >= 0 ? "+" : ""}${net.toLocaleString("pt-BR")}`} chip={`${members.toLocaleString("pt-BR")} pessoas`}
          tabs={topGroups.map((g2) => ({ top: g2.size.toLocaleString("pt-BR"), label: g2.name.replace(/^.*?·\s*/, ""), href: q("g", gSel === g2.id ? null : g2.id), on: gSel === g2.id }))}
          button={{ label: "Ver grupos", href: "/grupos" }} />
      </NxRow2>
      <NxFilters count={[sp.r, gSel].filter(Boolean).length}>
        {RANGES.map(([k, l]) => <NxPill key={k} href={q("r", k === "7" ? null : k)} on={range[0] === k}>{l}</NxPill>)}
        <NxPill href={q("g", null)} on={!gSel}>Todos os grupos</NxPill>
        {chosen.filter((x) => !topGroups.includes(x)).slice(0, 6).map((x) => <NxPill key={x.id} href={q("g", x.id)} on={gSel === x.id}>{x.name.replace(/^.*?·\s*/, "")}</NxPill>)}
      </NxFilters>
      <NxPanel title="Agora"
        tabs={[{ label: "Tudo", href: q("t", null), on: !sp.t }, { label: "Entradas", count: joins, href: q("t", "JOIN"), on: sp.t === "JOIN" }, { label: "Saídas", count: leaves, href: q("t", "LEAVE"), on: sp.t === "LEAVE" }]}
        tools={<span className="row" style={{ gap: 6, fontSize: 12, color: "#555" }}><span className="live-dot" /> Ao vivo</span>}
        list={events.length ? events.slice(0, 9).map((e) => {
          const I = INFO[e.type];
          const sub = e.type === "LEAVE" ? [stay(e.groupId, e.contactId, e.createdAt), e.byAdmin ? "removido por admin" : null].filter(Boolean).join(" · ") : e.type === "RETURN" ? "voltou depois de sair" : formatPhone(e.contact.phone);
          return <NxItem key={e.id} href={q("sel", e.id)} name={e.contact.name ?? e.contact.phone} title={e.contact.name ?? formatPhone(e.contact.phone)} sub={`${I.verb} ${e.group.name} · ${ago(e.createdAt)}${sub ? ` · ${sub}` : ""}`} status={e.winbackSent ? "Mensagem enviada" : VERB[e.type]} ok={e.type !== "LEAVE" || e.winbackSent} on={sel?.id === e.id} />;
        }) : <NxEmpty>Os movimentos aparecem aqui assim que o WhatsApp estiver conectado e os grupos marcados.</NxEmpty>}
        detail={sel ? (<>
          <NxDHead cols={[
            { label: "Pessoa", node: <NxWho name={sel.contact.name ?? formatPhone(sel.contact.phone)} sub={formatPhone(sel.contact.phone)} /> },
            { label: "Grupo", node: <NxDText>{sel.group.name}</NxDText> },
            { label: "Situação", node: <NxDNum chip={sel.type === "LEAVE" ? (selHist[0]?.type === "RETURN" ? "Voltou ao grupo" : sel.winbackSent ? "Mensagem de volta enviada" : "Saiu") : VERB[sel.type]}>{null}</NxDNum> },
          ]} />
          <NxDCards cols={3} items={[
            { v: selGroups.length, d: "Grupos em que está" },
            { v: selHist.filter((h) => h.type === "LEAVE").length, d: "Vezes que saiu" },
            { v: sel.type === "LEAVE" ? stay(sel.groupId, sel.contactId, sel.createdAt) ?? "–" : ago(sel.createdAt), d: sel.type === "LEAVE" ? "Tempo no grupo" : "Desde o movimento" },
          ]} />
          {sel.type === "LEAVE" && <NxQuote>{sel.winbackSent ? "Mensagem de volta enviada: " : "Mensagem de volta configurada: "}{s.winback.text}</NxQuote>}
          <NxDFoot vals={[{ l: "Entrou", v: lastOf("JOIN") ? dfmt.format(lastOf("JOIN")!) : "–" }, { l: "Saiu", v: lastOf("LEAVE") ? dfmt.format(lastOf("LEAVE")!) : "–" }, { l: "Voltou", v: lastOf("RETURN") ? dfmt.format(lastOf("RETURN")!) : "–" }]}>
            <NxBtn href={`/atendimento?tel=${sel.contact.phone}`}>↗</NxBtn>
            <NxBtn href={`https://wa.me/${sel.contact.phone.replace(/\D/g, "")}`} target="_blank" lime>Chamar no WhatsApp</NxBtn>
          </NxDFoot>
        </>) : <NxEmpty>Escolha uma pessoa da lista.</NxEmpty>} />
        <Panel title="Mensagem de volta" sub="Enviada no privado para quem sai de um grupo da comunidade.">
          <form action={saveWinback} className="stack">
            <label className="check">
              <input type="checkbox" name="enabled" defaultChecked={s.winback.enabled} /> Mandar mensagem para quem sai
            </label>
            <div className="field">
              <label>Texto</label>
              <textarea className="in" name="text" defaultValue={s.winback.text} />
              <span className="hint">Use {"{loja}"} para o nome da loja, {"{nome}"} para o primeiro nome, {"{grupo}"} para o nome do grupo e {"{link}"} para o convite.</span>
            </div>
            <div className="field">
              <label>Esperar quantos minutos antes de mandar</label>
              <div><NumberInput name="delayMinutes" defaultValue={s.winback.delayMinutes} suffix="min" step={5} width={170} /></div>
            </div>
            <label className="check">
              <input type="checkbox" name="onlyIfNotRemovedByAdmin" defaultChecked={s.winback.onlyIfNotRemovedByAdmin} /> Não mandar para quem foi removido por um admin
            </label>
            <div>
              <button className="btn pri" type="submit">Salvar</button>
            </div>
          </form>
        </Panel>
    </>
  );
}
