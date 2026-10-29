import { NumberInput } from "@/components/NumberInput";
import Link from "next/link";
import { Download, RotateCcw, TrendingUp, UserMinus, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/phone";
import { addDays, isoDayLocal } from "@/lib/time";
import { daysBetween } from "@/lib/periods";
import { Header, Kpi, Panel } from "@/components/ui";
import { UpDownBars } from "@/components/charts";
import { AutoRefresh } from "@/components/AutoRefresh";
import { saveWinback } from "../actions";

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

export default async function Entradas({ searchParams }: { searchParams: Promise<{ r?: string; g?: string; t?: string }> }) {
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
    const vals: Record<string, string | undefined> = { r: sp.r, g: sp.g, t: sp.t, [k]: v ?? undefined };
    for (const [kk, vv] of Object.entries(vals)) if (vv) p.set(kk, vv);
    return `/entradas${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <>
      <AutoRefresh seconds={30} />
      <Header title="Entradas e saídas" lede={group ? `Movimentos do grupo ${group.name}.` : "Cada pessoa que entra ou sai dos grupos, na hora. Quem sai recebe a mensagem de volta."}>
        <div className="seg">{RANGES.map(([k, l]) => <Link key={k} href={q("r", k === "7" ? null : k)} className={range[0] === k ? "on" : ""}>{l}</Link>)}</div>
        <a className="btn" href={`/api/export/entradas?dias=${Math.max(range[2], 30)}`}><Download size={16} /> Exportar</a>
      </Header>
      {chosen.length > 0 ? (
        <div className="chips" style={{ alignSelf: "flex-start" }}>
          <Link href={q("g", null)} className={!gSel ? "on" : ""}>Todos os selecionados<b>{chosen.length}</b></Link>
          {chosen.map((x) => <Link key={x.id} href={q("g", x.id)} className={gSel === x.id ? "on" : ""}>{x.name}{x.isResults ? " (resultados)" : ""}</Link>)}
        </div>
      ) : (
        <div className="note">Nenhum grupo selecionado ainda. Marque os grupos da comunidade em <Link href="/grupos?v=escolher" style={{ textDecoration: "underline" }}>Grupos</Link> e só eles aparecem aqui.</div>
      )}
      <div className="grid g4">
        <Kpi icon={<UserPlus size={15} />} label="Entraram" value={joins.toLocaleString("pt-BR")} sub={dj == null ? "sem período anterior" : <><span className={dj >= 0 ? "up" : "dn"}>{dj >= 0 ? "+" : ""}{dj}%</span> que no período anterior</>} />
        <Kpi icon={<UserMinus size={15} />} tone="c" label="Saíram" value={leaves.toLocaleString("pt-BR")} sub={joins ? `${((leaves / joins) * 100).toFixed(1).replace(".", ",")}% de quem entrou` : "–"} />
        <Kpi icon={<RotateCcw size={15} />} tone="s" label="Voltaram" value={returns.toLocaleString("pt-BR")} sub={winbacks ? `${winbacks} receberam a mensagem de volta` : "saíram e entraram de novo"} />
        <Kpi icon={<TrendingUp size={15} />} tone="k" label={range[2] === 1 ? "Saldo de hoje" : `Saldo em ${range[1]}`} value={<span className={net >= 0 ? "up" : "dn"}>{net >= 0 ? "+" : ""}{net.toLocaleString("pt-BR")}</span>} sub={`antes: ${pnet >= 0 ? "+" : ""}${pnet}`} />
      </div>
      <div className="cols c-1-1">
        <Panel title="Por dia" sub="Verde entrou, vermelho saiu">
          <UpDownBars items={bars} />
        </Panel>
        <Panel title="Agora" sub="Atualiza sozinho" right={<div className="row" style={{ gap: 10 }}>
          <div className="seg">{[["", "Tudo"], ["JOIN", "Entradas"], ["LEAVE", "Saídas"]].map(([k, l]) => <Link key={l} href={q("t", k || null)} className={(sp.t ?? "") === k ? "on" : ""}>{l}</Link>)}</div>
          <span className="row" style={{ gap: 6, fontSize: 13 }}><span className="live-dot" /> Ao vivo</span></div>}>
          {events.length ? events.slice(0, 12).map((e) => {
            const I = INFO[e.type];
            const sub = e.type === "LEAVE" ? [stay(e.groupId, e.contactId, e.createdAt), e.byAdmin ? "removido por admin" : null].filter(Boolean).join(" · ") : e.type === "RETURN" ? "voltou depois de sair" : formatPhone(e.contact.phone);
            return (
              <div className="lrow" key={e.id}>
                <span className={`tile sm ${I.tone}`}><I.icon size={16} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5 }}><b style={{ fontWeight: 650 }}>{e.contact.name ?? formatPhone(e.contact.phone)}</b> <span className="mut">{I.verb} {e.group.name}</span></div>
                  <div className="s">{sub}</div>
                </div>
                {e.winbackSent && <span className="chip c-s">Mensagem de volta enviada</span>}
                <span className="dim" style={{ fontSize: 12, minWidth: 44, textAlign: "right" }}>{ago(e.createdAt)}</span>
              </div>
            );
          }) : <div className="empty">Os movimentos aparecem aqui assim que o WhatsApp estiver conectado e os grupos marcados.</div>}
        </Panel>
      </div>
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
