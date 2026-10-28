import { AtSign, ImageIcon, Repeat } from "lucide-react";
import { db } from "@/lib/db";
import { Header, Panel } from "@/components/ui";
import { cancelSchedule, createSchedule, retrySchedule } from "../actions";

export const dynamic = "force-dynamic";

const STATUS = {
  SCHEDULED: ["agendado", "c-k"],
  SENDING: ["enviando", "c-s"],
  SENT: ["enviado", "c-l"],
  FAILED: ["falhou", "c-c"],
  CANCELED: ["cancelado", "c-n"],
} as const;

export default async function Agendamentos({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const [groups, list] = await Promise.all([
    db.group.findMany({ where: { archived: false }, orderBy: [{ isCommunity: "desc" }, { name: "asc" }] }),
    db.scheduledMessage.findMany({ orderBy: [{ status: "asc" }, { sendAt: "desc" }], take: 80 }),
  ]);
  const names = new Map(groups.map((g) => [g.jid, g.name]));
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Header title="Agendamentos" lede="Mensagens programadas para os grupos, com opção de marcar todos os membros." />
      {sp.ok && <div className="ok">Mensagem agendada.</div>}
      {sp.erro && <div className="err">Preencha o texto, a data e escolha pelo menos um grupo.</div>}
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Nova mensagem">
          <form action={createSchedule} className="stack">
            <div className="field">
              <label>Texto</label>
              <textarea className="in" name="text" required placeholder="Ex.: Lançamento hoje às 19h, só para quem está no grupo." />
            </div>
            <div className="field">
              <label>Foto, vídeo ou arquivo (opcional)</label>
              <input className="in" type="file" name="media" accept="image/*,video/*,application/pdf" style={{ paddingTop: 8 }} />
              <span className="hint">O texto vira a legenda.</span>
            </div>
            <div className="field">
              <label>Grupos</label>
              <div className="stack" style={{ gap: 8, maxHeight: 220, overflowY: "auto", padding: "4px 2px" }}>
                {groups.map((g) => (
                  <label key={g.id} className="check">
                    <input type="checkbox" name="groups" value={g.jid} defaultChecked={g.isCommunity && !g.isResults} />
                    {g.name} <span className="dim">({g.size})</span>
                  </label>
                ))}
                {!groups.length && <span className="dim">Nenhum grupo sincronizado.</span>}
              </div>
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1, minWidth: 200 }}>
                <label>Quando</label>
                <input className="in" type="datetime-local" name="sendAt" />
              </div>
              <div className="field" style={{ width: 170 }}>
                <label>Repetir</label>
                <select className="in" name="repeat" defaultValue="">
                  <option value="">Não repetir</option>
                  <option value="daily">Todo dia</option>
                  <option value="weekly">Toda semana</option>
                </select>
              </div>
            </div>
            <label className="check">
              <input type="checkbox" name="mentionAll" defaultChecked /> Marcar todos os membros (sem aparecer a lista de nomes)
            </label>
            <div className="row">
              <button className="btn pri" type="submit">Agendar</button>
              <button className="btn" type="submit" name="now" value="1">Enviar agora</button>
            </div>
          </form>
        </Panel>
        <Panel title="Mensagens" body={false}>
          {list.length ? (
            <table className="tb">
              <tbody>
                {list.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                        <span className={`chip ${STATUS[m.status][1]}`}>{STATUS[m.status][0]}</span>
                        <span className="mut" style={{ fontSize: 12.5 }}>{fmt.format(m.sendAt)}</span>
                        {m.repeat && <Repeat size={13} className="dim" />}
                        {m.mentionAll && <AtSign size={13} className="dim" />}
                        {m.mediaUrl && <ImageIcon size={13} className="dim" />}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{m.text.length > 180 ? `${m.text.slice(0, 180)}…` : m.text}</div>
                      <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                        {m.groupJids.map((j) => names.get(j) ?? j).slice(0, 4).join(", ")}
                        {m.groupJids.length > 4 ? ` e mais ${m.groupJids.length - 4}` : ""}
                        {m.sentCount ? ` · ${m.sentCount} envios` : ""}
                      </div>
                      {m.error && <div className="dn" style={{ fontSize: 12, marginTop: 4 }}>{m.error}</div>}
                    </td>
                    <td className="r" style={{ width: 110 }}>
                      {m.status === "FAILED" && (
                        <form action={retrySchedule}>
                          <input type="hidden" name="id" value={m.id} />
                          <button className="btn sm" type="submit">Tentar de novo</button>
                        </form>
                      )}
                      {(m.status === "SCHEDULED" || m.status === "FAILED") && (
                        <form action={cancelSchedule} style={{ marginTop: 6 }}>
                          <input type="hidden" name="id" value={m.id} />
                          <button className="btn sm danger" type="submit">Cancelar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma mensagem ainda.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
