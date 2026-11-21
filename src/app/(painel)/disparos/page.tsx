import { Pause, Pencil, Play, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { customers } from "@/lib/store";
import { inSegment, normalizePhone, SEGMENTS, type SegmentKey } from "@/lib/segments";
import { NxHead, NxRow2, NxHero, NxStat, NxTracks, NxTrack, NxNote, NxTabsCard, NxFilters, NxPill, NxPanel, NxItem, NxEmpty, NxDHead, NxDNum, NxDText, NxDCards, NxDFoot, NxBtn, NxQuote } from "@/components/nx";
import { BroadcastComposer, type Audience } from "@/components/BroadcastComposer";
import { libMsgs } from "@/lib/libMsgs";
import { broadcastAction, createBroadcast, sendBroadcastTest } from "../acoes2";

export const dynamic = "force-dynamic";

const AUD: Record<string, string> = {
  selecionados: "Leads selecionados",
  leads: "Todos os leads",
  "leads-nao-entrou": "Leads que não entraram no grupo",
  "saiu-30": "Saíram do grupo nos últimos 30 dias",
  comunidade: "Todos dos grupos da comunidade (no privado)",
  "clientes-todos": "Clientes: todos",
  "clientes-vip": "Clientes: VIP",
  "clientes-recorrentes": "Clientes: recorrentes",
  "clientes-novos": "Clientes: novos",
  "clientes-inativos": "Clientes: inativos",
  lista: "Lista colada",
};
const ST = {
  DRAFT: ["rascunho", "c-n"], SCHEDULED: ["agendado", "c-k"], SENDING: ["enviando", "c-s"], PAUSED: ["pausado", "c-n"], DONE: ["concluído", "c-l"], CANCELED: ["cancelado", "c-n"],
} as const;

export default async function Disparos({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; lista?: string; teste?: string; reenvio?: string; editado?: string; f?: string; sel?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  const waOpen = (await (await import("@/lib/evolution")).evolution.connectionState().catch(() => "open")) === "open";
  const [list, s, leads, selRow, shop] = await Promise.all([
    db.broadcast.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    getSettings(),
    db.lead.findMany({ where: { status: { not: "descadastrado" } }, select: { phone: true } }),
    db.setting.findUnique({ where: { key: "_disparo_lista" } }),
    process.env.HUB_LITE === "1" ? Promise.resolve([]) : customers().catch(() => []),
  ]);
  const inG = new Set((await db.contact.findMany({ where: { phone: { in: leads.map((l) => l.phone) }, memberships: { some: { group: { isCommunity: true } } } }, select: { phone: true } })).map((c) => c.phone));
  const leftEv = await db.memberEvent.findMany({ where: { type: "LEAVE", createdAt: { gte: new Date(Date.now() - 30 * 864e5) }, group: { isCommunity: true } }, select: { contactId: true } });
  const members = await db.membership.count({ where: { leftAt: null, group: { isCommunity: true } } });
  const selected = ((selRow?.value as { phones?: string[] } | undefined)?.phones ?? []).length;
  const seg = (k: SegmentKey) => shop.filter((c) => normalizePhone(c.phone) && inSegment(c, k)).length;
  const audiences: Audience[] = [
    ...(selected && sp.lista ? [{ key: "selecionados", label: "Leads selecionados", count: selected }] : []),
    { key: "leads-nao-entrou", label: "Leads que não entraram no grupo", count: leads.filter((l) => !inG.has(l.phone)).length },
    { key: "saiu-30", label: "Saíram do grupo nos últimos 30 dias", count: new Set(leftEv.map((e) => e.contactId)).size },
    { key: "leads", label: "Todos os leads", count: leads.length },
    ...(process.env.HUB_LITE === "1" ? [] : ["vip", "recorrentes", "novos", "inativos", "todos"] as SegmentKey[]).map((k) => ({ key: `clientes-${k}`, label: `Clientes: ${SEGMENTS[k].label.toLowerCase()}`, hint: SEGMENTS[k].desc, count: seg(k) })),
    { key: "comunidade", label: "Todos dos grupos da comunidade", hint: "Cada pessoa recebe no privado", count: members },
    { key: "lista", label: "Colar uma lista de números", count: 0, unit: "" },
  ];
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const cap = await (await import("@/lib/send")).broadcastCap(false);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthList = list.filter((b) => (b.sendAt ?? b.createdAt) >= monthStart);
  const monthSent = monthList.reduce((a, b) => a + b.sent, 0);
  const monthFailed = monthList.reduce((a, b) => a + b.failed, 0);
  const lastHour = await db.broadcastRecipient.count({ where: { status: "enviado", sentAt: { gte: new Date(Date.now() - 3600e3) } } }).catch(() => 0);
  const running = list.filter((b) => b.status === "SENDING");
  const scheduled = list.filter((b) => b.status === "SCHEDULED");
  const f = sp.f && sp.f in ST ? sp.f : "";
  const shown = list.filter((b) => !f || b.status === f || (f === "DRAFT" && b.status === "PAUSED"));
  const cur = shown.find((b) => b.id === sp.sel) ?? shown[0];
  const q = (k: string) => (k ? `/disparos?f=${k}` : "/disparos");

  return (
    <>
      {sp.ok && <div className="ok">Disparo criado. Ele começa no horário escolhido e você acompanha o andamento aqui embaixo.</div>}
      {sp.teste && <div className="ok">Teste enviado para o número conectado. Confira no WhatsApp.</div>}
      {sp.erro === "vazio" && <div className="err">Ninguém com WhatsApp válido nesse público.</div>}
      {sp.erro === "campos" && <div className="err">Escreva a mensagem e escolha o público.</div>}
      {sp.erro === "texto" && <div className="err">Escreva a mensagem antes de agendar.</div>}
      {sp.erro === "publico" && <div className="err">Escolha o público do disparo.</div>}
      {sp.erro === "lista" && <div className="err">Cole os números na caixa da lista, um por linha.</div>}
      {sp.erro === "envio" && <div className="err">O formulário não chegou completo. Se anexou um vídeo, ele pode ser grande demais (máximo 45 MB). Tente de novo com um arquivo menor.</div>}
      {sp.erro === "acao" && <div className="err">Não consegui identificar o disparo. Atualize a página e tente de novo.</div>}
      {sp.erro === "reenvio" && <div className="err">Não tinha ninguém para reenviar. Quem falhou por não ter WhatsApp fica de fora.</div>}
      {sp.reenvio && <div className="ok">Reenvio começou para {sp.reenvio} pessoas. Acompanhe o andamento aqui embaixo.</div>}
      {sp.editado && <div className="ok">Disparo atualizado.</div>}
      {!waOpen && <div className="err">O WhatsApp está desconectado. Os disparos ficam parados até reconectar em Configurações.</div>}
      {sp.erro === "numero" && <div className="err">Não achei o número conectado. Confira o WhatsApp em Configurações.</div>}
      <NxHead title="Disparos" back="/">
        <Link className="btn" href="/agendamentos">Agendar</Link>
        <a className="btn pri" href="#novo">Novo disparo</a>
      </NxHead>
      <NxRow2>
        <NxHero stats={<>
          <NxStat label="Enviadas no mês" value={monthSent.toLocaleString("pt-BR")} sub={`${monthList.length} disparo(s)`} />
          <NxStat label="Entregues" value={monthSent + monthFailed ? `${Math.round((monthSent / (monthSent + monthFailed)) * 100)}%` : "–"} sub={`${monthSent.toLocaleString("pt-BR")} mensagens`} tone="up" />
          <NxStat label="Falharam" value={monthFailed.toLocaleString("pt-BR")} sub="número sem WhatsApp ou erro" tone={monthFailed ? "dn" : "mut"} />
        </>}>
          <NxTracks>
            {[...running, ...scheduled].slice(0, 2).map((b) => (
              <NxTrack key={b.id} l={b.name} r={b.status === "SENDING" ? "rodando" : b.sendAt ? `agendado ${fmt.format(b.sendAt)}` : "rascunho"} pct={b.total ? ((b.sent + b.failed) / b.total) * 100 : 0}>
                <NxNote>{(b.sent + b.failed).toLocaleString("pt-BR")} de {b.total.toLocaleString("pt-BR")}</NxNote>
              </NxTrack>
            ))}
            {[...running, ...scheduled].length < 2 && Array.from({ length: 2 - Math.min(2, [...running, ...scheduled].length) }).map((_, i) => <NxTrack key={`e${i}`} l="Nenhum disparo" r="" pct={0}><NxNote>agende pelo formulário abaixo</NxNote></NxTrack>)}
            <NxTrack l="Limite por hora" r={cap.toLocaleString("pt-BR")} pct={cap ? Math.min(100, (lastHour / cap) * 100) : 0}><NxNote>{lastHour.toLocaleString("pt-BR")} na última hora</NxNote></NxTrack>
          </NxTracks>
        </NxHero>
        <NxTabsCard title="WhatsApp" value={waOpen ? "Conectado" : "Desconectado"}
          tabs={[{ top: running.length, label: "Rodando", href: q("SENDING"), on: f === "SENDING" }, { top: scheduled.length, label: "Agendados", href: q("SCHEDULED"), on: f === "SCHEDULED" }, { top: list.filter((b) => b.status === "DRAFT" || b.status === "PAUSED").length, label: "Rascunhos", href: q("DRAFT"), on: f === "DRAFT" }]}
          button={{ label: "Novo disparo", href: "#novo" }} />
      </NxRow2>
      <NxFilters>
        <NxPill href={q("")} on={!f}>Todos</NxPill>
        {Object.entries(ST).map(([k, [l]]) => <NxPill key={k} href={q(k)} on={f === k}>{l[0].toUpperCase() + l.slice(1)}</NxPill>)}
      </NxFilters>
      <NxPanel title="Disparos"
        tabs={[{ label: "Todos", href: q(""), on: !f }, { label: "Rodando", count: running.length, href: q("SENDING"), on: f === "SENDING" }, { label: "Agendados", count: scheduled.length, href: q("SCHEDULED"), on: f === "SCHEDULED" }]}
        list={shown.length ? shown.slice(0, 9).map((b) => (
          <NxItem key={b.id} href={`/disparos?${f ? `f=${f}&` : ""}sel=${b.id}`} name={b.name} title={b.name} sub={`${AUD[b.audience] ?? b.audience} · ${b.total.toLocaleString("pt-BR")} pessoas`} status={ST[b.status][0][0].toUpperCase() + ST[b.status][0].slice(1)} ok={b.status === "SENDING" || b.status === "DONE"} value={b.total ? `${Math.round(((b.sent + b.failed) / b.total) * 100)}%` : b.sendAt ? fmt.format(b.sendAt) : ""} on={cur?.id === b.id} />
        )) : <NxEmpty>Nenhum disparo ainda.</NxEmpty>}
        detail={cur ? (<>
          <NxDHead cols={[
            { label: "Disparo", node: <NxDNum chip={ST[cur.status][0][0].toUpperCase() + ST[cur.status][0].slice(1)}>{null}</NxDNum> },
            { label: "Público", node: <NxDText>{AUD[cur.audience] ?? cur.audience}</NxDText> },
            { label: cur.status === "SCHEDULED" ? "Começa" : "Data", node: <NxDText>{cur.sendAt ? fmt.format(cur.sendAt) : "sem data"}</NxDText> },
          ]} />
          <div className="nx-dnum" style={{ marginTop: -6 }}>{cur.name}</div>
          <NxQuote>{cur.text}</NxQuote>
          <NxDCards cols={3} items={[{ v: cur.sent.toLocaleString("pt-BR"), d: "Enviadas" }, { v: Math.max(0, cur.total - cur.sent - cur.failed).toLocaleString("pt-BR"), d: "Faltam" }, { v: cur.failed.toLocaleString("pt-BR"), d: "Falharam" }]} />
          {cur.status === "SENDING" && !waOpen && <div style={{ fontSize: 12, color: "#ff7b72" }}>Parado esperando o WhatsApp reconectar. Continua sozinho quando voltar.</div>}
          <NxDFoot vals={[{ l: "Total", v: cur.total.toLocaleString("pt-BR") }, { l: "Andamento", v: cur.total ? `${Math.round(((cur.sent + cur.failed) / cur.total) * 100)}%` : "–" }]}>
            {["DRAFT", "SCHEDULED", "PAUSED"].includes(cur.status) && <NxBtn href={`/disparos/${cur.id}`}><Pencil size={15} /></NxBtn>}
            {!["DONE", "CANCELED"].includes(cur.status) && <ActBtn id={cur.id} act="cancel" title="Cancelar" nx><X size={15} /></ActBtn>}
            {(cur.status === "DRAFT" || cur.status === "PAUSED") && <ActBtn id={cur.id} act="start" title="Começar" nx lime><Play size={14} /> Começar</ActBtn>}
            {cur.status === "SENDING" && <ActBtn id={cur.id} act="pause" title="Pausar" nx lime><Pause size={14} /> Pausar disparo</ActBtn>}
            {cur.failed > 0 && ["DONE", "PAUSED"].includes(cur.status) && <ActBtn id={cur.id} act="retry" title="Reenviar para quem falhou" nx lime><RotateCcw size={14} /> Tentar de novo</ActBtn>}
          </NxDFoot>
        </>) : <NxEmpty>Escolha um disparo da lista.</NxEmpty>} />
      <div id="novo" style={{ scrollMarginTop: 20 }} />
      <BroadcastComposer action={createBroadcast} testAction={sendBroadcastTest} audiences={audiences} defaultAudience={selected && sp.lista ? "selecionados" : "leads-nao-entrou"}
        store={env.storeName()} maxPerHour={cap} owner={(session?.name ?? "Leonardo").split(" ")[0]} library={await libMsgs()} lite={process.env.HUB_LITE === "1"} />
    </>
  );
}

// Um formulário por botão: o nome do botão não chega na ação do servidor
function ActBtn({ id, act, title, danger, nx, lime, children }: { id: string; act: string; title: string; danger?: boolean; nx?: boolean; lime?: boolean; children: React.ReactNode }) {
  return (
    <form action={broadcastAction}>
      <input type="hidden" name="_" value="1" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="act" value={`${act}:${id}`} />
      <button className={nx ? (lime ? "nx-lime" : "nx-ic") : `btn sm${danger ? " danger" : ""}`} title={title}>{children}</button>
    </form>
  );
}
