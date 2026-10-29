import { Pause, Play, X } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Bar, Header, Kpi, Panel } from "@/components/ui";
import { broadcastAction, createBroadcast } from "../acoes2";

export const dynamic = "force-dynamic";

const AUD: Record<string, string> = {
  leads: "Leads do Grupo VIP",
  comunidade: "Todos dos grupos da comunidade",
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

export default async function Disparos({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const [list, s, optouts] = await Promise.all([db.broadcast.findMany({ orderBy: { createdAt: "desc" }, take: 30 }), getSettings(), db.optOut.count()]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const sentMonth = list.filter((b) => b.createdAt.getTime() > Date.now() - 30 * 864e5).reduce((a, b) => a + b.sent, 0);

  return (
    <>
      <Header title="Disparos" lede="Mensagem no privado para leads, clientes ou um grupo de clientes. O sistema manda aos poucos para proteger o número." />
      {sp.ok && <div className="ok">Disparo criado. Ele começa no horário escolhido e você acompanha o andamento aqui.</div>}
      {sp.erro === "vazio" && <div className="err">Ninguém com WhatsApp válido nesse público.</div>}
      {sp.erro === "campos" && <div className="err">Escreva a mensagem e escolha o público.</div>}
      <div className="note">
        Disparo pelo WhatsApp normal (não oficial) tem risco de bloqueio se muita gente denunciar. Mande para quem conhece a marca, com mensagens curtas e úteis. Hoje o limite é de {s.sending.maxPerHour} mensagens por hora. Para volumes grandes, a API oficial da Meta custa cerca de R$ 0,32 por mensagem de marketing.
      </div>
      <div className="grid g4">
        <Kpi label="Enviadas (30 dias)" value={sentMonth.toLocaleString("pt-BR")} />
        <Kpi label="Disparos ativos" value={list.filter((b) => b.status === "SENDING" || b.status === "SCHEDULED").length} />
        <Kpi label="Pediram para sair" value={optouts} sub="não recebem mais" />
        <Kpi label="Limite por hora" value={s.sending.maxPerHour} sub="muda em Configurações" />
      </div>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Novo disparo">
          <form action={createBroadcast} className="stack">
            <div className="field"><label>Nome (só para você)</label><input className="in" name="name" placeholder="Ex.: Lançamento Pura para VIPs" /></div>
            <div className="field">
              <label>Para quem</label>
              <select className="in" name="audience" defaultValue="clientes-vip">
                {Object.entries(AUD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field"><label>Lista (só se escolher “Lista colada”)</label><textarea className="in" name="list" placeholder="Um WhatsApp por linha" style={{ minHeight: 70 }} /></div>
            <div className="field">
              <label>Mensagem</label>
              <textarea className="in" name="text" required placeholder="Oi {nome}, ..." />
              <span className="hint">{"{nome}"} vira o primeiro nome. No fim vai sozinho: “Para não receber mais, responda SAIR”.</span>
            </div>
            <div className="field"><label>Foto ou vídeo (opcional)</label><input className="in" type="file" name="media" accept="image/*,video/*" style={{ paddingTop: 8 }} /></div>
            <div className="field"><label>Quando</label><input className="in" type="datetime-local" name="sendAt" /></div>
            <div className="row">
              <button className="btn pri" type="submit">Agendar</button>
              <button className="btn" type="submit" name="now" value="1">Começar agora</button>
            </div>
          </form>
        </Panel>
        <Panel title="Disparos" body={false}>
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
                    </td>
                    <td className="r" style={{ width: 120 }}>
                      <form action={broadcastAction} className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <input type="hidden" name="id" value={b.id} />
                        {(b.status === "DRAFT" || b.status === "PAUSED") && <button className="btn sm" name="act" value="start" title="Começar"><Play size={14} /></button>}
                        {b.status === "SENDING" && <button className="btn sm" name="act" value="pause" title="Pausar"><Pause size={14} /></button>}
                        {!["DONE", "CANCELED"].includes(b.status) && <button className="btn sm danger" name="act" value="cancel" title="Cancelar"><X size={14} /></button>}
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum disparo ainda.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
