import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/phone";
import { Header, Kpi, Panel } from "@/components/ui";
import { saveWinback } from "../actions";

export const dynamic = "force-dynamic";

const LABEL = { JOIN: ["entrou", "c-l"], RETURN: ["voltou", "c-k"], LEAVE: ["saiu", "c-c"] } as const;

export default async function Entradas() {
  const since = new Date(Date.now() - 7 * 864e5);
  const where = { createdAt: { gte: since }, group: { isCommunity: true } };
  const [joins, returns, leaves, winbacks, events, s] = await Promise.all([
    db.memberEvent.count({ where: { ...where, type: "JOIN" } }),
    db.memberEvent.count({ where: { ...where, type: "RETURN" } }),
    db.memberEvent.count({ where: { ...where, type: "LEAVE" } }),
    db.memberEvent.count({ where: { ...where, type: "LEAVE", winbackSent: true } }),
    db.memberEvent.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { contact: true, group: true } }),
    getSettings(),
  ]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Header title="Entradas e saídas" lede="Quem entrou, saiu e voltou nos grupos da comunidade. Quem sai recebe a mensagem de volta automaticamente." />
      <div className="grid g4">
        <Kpi label="Entraram (7 dias)" value={<span className="up">+{joins}</span>} />
        <Kpi label="Voltaram (7 dias)" value={returns} sub="saíram e entraram de novo" />
        <Kpi label="Saíram (7 dias)" value={<span className="dn">{leaves}</span>} sub={`saldo ${joins + returns - leaves >= 0 ? "+" : ""}${joins + returns - leaves}`} />
        <Kpi label="Mensagens de volta" value={winbacks} sub={leaves ? `${Math.round((winbacks / leaves) * 100)}% de quem saiu` : undefined} />
      </div>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Últimos movimentos" body={false}>
          {events.length ? (
            <table className="tb">
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td style={{ width: 90 }}>
                      <span className={`chip ${LABEL[e.type][1]}`}>{LABEL[e.type][0]}</span>
                    </td>
                    <td>
                      {e.contact.name ?? formatPhone(e.contact.phone)}
                      <div className="dim" style={{ fontSize: 12 }}>
                        {e.group.name}
                        {e.byAdmin ? " · removido por admin" : ""}
                        {e.winbackSent ? " · recebeu mensagem de volta" : ""}
                      </div>
                    </td>
                    <td className="r dim">{fmt.format(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Os movimentos aparecem aqui assim que o WhatsApp estiver conectado.</div>
          )}
        </Panel>
        <Panel title="Mensagem de volta" sub="Enviada no privado para quem sai de um grupo da comunidade.">
          <form action={saveWinback} className="stack">
            <label className="check">
              <input type="checkbox" name="enabled" defaultChecked={s.winback.enabled} /> Mandar mensagem para quem sai
            </label>
            <div className="field">
              <label>Texto</label>
              <textarea className="in" name="text" defaultValue={s.winback.text} />
              <span className="hint">Use {"{nome}"} para o primeiro nome, {"{grupo}"} para o nome do grupo e {"{link}"} para o convite.</span>
            </div>
            <div className="field">
              <label>Esperar quantos minutos antes de mandar</label>
              <input className="in" name="delayMinutes" defaultValue={s.winback.delayMinutes} inputMode="numeric" style={{ maxWidth: 140 }} />
            </div>
            <label className="check">
              <input type="checkbox" name="onlyIfNotRemovedByAdmin" defaultChecked={s.winback.onlyIfNotRemovedByAdmin} /> Não mandar para quem foi removido por um admin
            </label>
            <div>
              <button className="btn pri" type="submit">Salvar</button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
