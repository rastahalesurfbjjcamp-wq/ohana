import { Pause, Pencil, Play, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { customers } from "@/lib/store";
import { inSegment, normalizePhone, SEGMENTS, type SegmentKey } from "@/lib/segments";
import { Bar, Panel } from "@/components/ui";
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

export default async function Disparos({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; lista?: string; teste?: string; reenvio?: string; editado?: string }> }) {
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
      {sp.erro === "reenvio" && <div className="err">Não tinha ninguém para reenviar. Quem falhou por não ter WhatsApp fica de fora.</div>}
      {sp.reenvio && <div className="ok">Reenvio começou para {sp.reenvio} pessoas. Acompanhe o andamento aqui embaixo.</div>}
      {sp.editado && <div className="ok">Disparo atualizado.</div>}
      {!waOpen && <div className="err">O WhatsApp está desconectado. Os disparos ficam parados até reconectar em Configurações.</div>}
      {sp.erro === "numero" && <div className="err">Não achei o número conectado. Confira o WhatsApp em Configurações.</div>}
      <BroadcastComposer action={createBroadcast} testAction={sendBroadcastTest} audiences={audiences} defaultAudience={selected && sp.lista ? "selecionados" : "leads-nao-entrou"}
        store={env.storeName()} maxPerHour={await (await import("@/lib/send")).broadcastCap(false)} owner={(session?.name ?? "Leonardo").split(" ")[0]} library={await libMsgs()} lite={process.env.HUB_LITE === "1"} />
        <Panel title="Disparos anteriores" sub="Andamento de cada envio" body={false}>
          {list.length ? (
            <table className="tb">
              <tbody>
                {list.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <b style={{ fontWeight: 550 }}>{b.name}</b>
                        <span className={`chip ${ST[b.status][1]}`}>{ST[b.status][0]}</span>
                      </div>
                      <div className="dim" style={{ fontSize: 12, margin: "4px 0 6px" }}>{AUD[b.audience] ?? b.audience} · {b.sendAt ? fmt.format(b.sendAt) : "sem data"}</div>
                      <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                        <div style={{ flex: 1 }}><Bar value={b.sent + b.failed} max={b.total} /></div>
                        <span className="mut" style={{ fontSize: 12 }}>{b.sent}/{b.total}{b.failed ? `, ${b.failed} falharam` : ""}</span>
                      </div>
                      {b.status === "SENDING" && !waOpen && <div className="dim" style={{ fontSize: 12, marginTop: 4, color: "var(--coral)" }}>Parado esperando o WhatsApp reconectar. Continua sozinho quando voltar.</div>}
                    </td>
                    <td className="r" style={{ width: 220 }}>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        {(b.status === "DRAFT" || b.status === "PAUSED") && <ActBtn id={b.id} act="start" title="Começar"><Play size={14} /></ActBtn>}
                        {["DRAFT", "SCHEDULED", "PAUSED"].includes(b.status) && <Link className="btn sm" href={`/disparos/${b.id}`} title="Editar"><Pencil size={14} /></Link>}
                        {b.status === "SENDING" && <ActBtn id={b.id} act="pause" title="Pausar"><Pause size={14} /></ActBtn>}
                        {b.failed > 0 && ["DONE", "PAUSED"].includes(b.status) && <ActBtn id={b.id} act="retry" title="Reenviar para quem falhou"><RotateCcw size={14} /> Tentar de novo</ActBtn>}
                        {!["DONE", "CANCELED"].includes(b.status) && <ActBtn id={b.id} act="cancel" title="Cancelar" danger><X size={14} /></ActBtn>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum disparo ainda.</div>
          )}
        </Panel>
    </>
  );
}

// Um formulário por botão: o nome do botão não chega na ação do servidor
function ActBtn({ id, act, title, danger, children }: { id: string; act: string; title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <form action={broadcastAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="act" value={act} />
      <button className={`btn sm${danger ? " danger" : ""}`} title={title}>{children}</button>
    </form>
  );
}
