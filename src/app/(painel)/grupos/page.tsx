import { RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { Bar, Header, Kpi, Panel } from "@/components/ui";
import { syncGroupsAction, updateGroup } from "../actions";

export const dynamic = "force-dynamic";

export default async function Grupos() {
  const groups = await db.group.findMany({ where: { archived: false }, orderBy: [{ isResults: "desc" }, { size: "desc" }] });
  const community = groups.filter((g) => g.isCommunity);
  const members = community.reduce((s, g) => s + g.size, 0);
  const cap = community.reduce((s, g) => s + g.capacity, 0);
  const full = community.filter((g) => g.size >= g.capacity * 0.95).length;
  const contacts = await db.contact.count({ where: { memberships: { some: { leftAt: null, group: { isCommunity: true } } } } });

  return (
    <>
      <Header title="Grupos" lede="Todos os grupos do número conectado. Marque quais são da comunidade e qual é o grupo de resultados.">
        <form action={syncGroupsAction}>
          <button className="btn" type="submit">
            <RefreshCw size={15} /> Atualizar agora
          </button>
        </form>
      </Header>
      <div className="grid g4">
        <Kpi label="Grupos da comunidade" value={community.length} />
        <Kpi label="Pessoas nos grupos" value={members.toLocaleString("pt-BR")} sub={`${contacts.toLocaleString("pt-BR")} números diferentes`} />
        <Kpi label="Lotação" value={cap ? `${Math.round((members / cap) * 100)}%` : "–"} sub={`${(cap - members).toLocaleString("pt-BR")} vagas`} />
        <Kpi label="Grupos lotados" value={full} sub="95% ou mais" />
      </div>
      <Panel title="Lista de grupos" sub="As mudanças valem na hora." body={false}>
        {groups.length ? (
          <table className="tb">
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Lotação</th>
                <th>Convite</th>
                <th>Comunidade</th>
                <th>Resultados</th>
                <th>Limite</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>
                    <b style={{ fontWeight: 550 }}>{g.name}</b>
                    {g.isResults && <span className="chip c-s" style={{ marginLeft: 8 }}>resultados</span>}
                  </td>
                  <td style={{ minWidth: 170 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <Bar value={g.size} max={g.capacity} />
                      </div>
                      <span className="mut">{g.size}</span>
                    </div>
                  </td>
                  <td>
                    {g.inviteCode ? (
                      <a className="chip c-k" href={`https://chat.whatsapp.com/${g.inviteCode}`} target="_blank" rel="noreferrer">
                        copiar link
                      </a>
                    ) : (
                      <span className="dim">precisa ser admin</span>
                    )}
                  </td>
                  <td colSpan={4}>
                    <form action={updateGroup} className="row" style={{ gap: 18 }}>
                      <input type="hidden" name="id" value={g.id} />
                      <label className="check" style={{ width: 90 }}>
                        <input type="checkbox" name="isCommunity" defaultChecked={g.isCommunity} />
                        sim
                      </label>
                      <label className="check" style={{ width: 90 }}>
                        <input type="checkbox" name="isResults" defaultChecked={g.isResults} />
                        sim
                      </label>
                      <input className="in" name="capacity" defaultValue={g.capacity} style={{ width: 90, height: 32 }} inputMode="numeric" />
                      <button className="btn sm" type="submit">Salvar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">Nenhum grupo ainda. Conecte o WhatsApp em Configurações e clique em Atualizar agora.</div>
        )}
      </Panel>
    </>
  );
}
