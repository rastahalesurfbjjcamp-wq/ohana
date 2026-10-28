import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { Bar, Header, Kpi, Panel } from "@/components/ui";
import { saveGroupSelection, syncGroupsAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function Grupos({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const [groups, wa] = await Promise.all([
    db.group.findMany({ where: { archived: false }, orderBy: [{ isResults: "desc" }, { isCommunity: "desc" }, { size: "desc" }] }),
    db.setting.findUnique({ where: { key: "_whatsapp" } }),
  ]);
  const connected = (wa?.value as { state?: string } | undefined)?.state === "open";
  const community = groups.filter((g) => g.isCommunity);
  const members = community.reduce((s, g) => s + g.size, 0);
  const cap = community.reduce((s, g) => s + g.capacity, 0);
  const full = community.filter((g) => g.size >= g.capacity * 0.95).length;
  const firstTime = groups.length > 0 && !community.length && !groups.some((g) => g.isResults);

  return (
    <>
      <Header title="Grupos" lede="Todos os grupos do WhatsApp conectado. Escolha quais a Tribo vai gerenciar e qual é o grupo de resultados.">
        <form action={syncGroupsAction}>
          <button className="btn" type="submit">
            <RefreshCw size={15} /> Atualizar lista
          </button>
        </form>
      </Header>
      {sp.ok && <div className="ok">Seleção salva.</div>}
      {firstTime && (
        <div className="note">
          WhatsApp conectado. Agora marque abaixo os grupos da comunidade (entradas e saídas, mensagem de volta, agendamentos) e escolha um grupo de resultados (relatório diário e comandos). Os outros grupos ficam de fora.
        </div>
      )}
      {!groups.length && (
        <Panel title="Nenhum grupo ainda">
          <div className="stack">
            <p className="mut">
              {connected
                ? "O número está conectado. Clique em Atualizar lista para puxar os grupos."
                : "Primeiro conecte o WhatsApp lendo o QR code em Configurações. Os grupos aparecem aqui logo depois."}
            </p>
            {!connected && (
              <div>
                <Link className="btn pri" href="/configuracoes">Conectar WhatsApp</Link>
              </div>
            )}
          </div>
        </Panel>
      )}
      {groups.length > 0 && (
        <>
          <div className="grid g4">
            <Kpi label="Grupos gerenciados" value={community.length} sub={`de ${groups.length} no número`} />
            <Kpi label="Pessoas nos grupos" value={members.toLocaleString("pt-BR")} />
            <Kpi label="Lotação" value={cap ? `${Math.round((members / cap) * 100)}%` : "–"} sub={cap ? `${(cap - members).toLocaleString("pt-BR")} vagas` : undefined} />
            <Kpi label="Grupos lotados" value={full} sub="95% ou mais" />
          </div>
          <form action={saveGroupSelection}>
            <Panel
              title="Escolha dos grupos"
              sub="Comunidade: a Tribo acompanha e manda mensagens. Resultados: só um, recebe o relatório e os comandos."
              right={<button className="btn pri" type="submit">Salvar seleção</button>}
              body={false}
            >
              <table className="tb">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Comunidade</th>
                    <th style={{ width: 100 }}>Resultados</th>
                    <th>Grupo</th>
                    <th style={{ width: 220 }}>Lotação</th>
                    <th style={{ width: 110 }}>Limite</th>
                    <th style={{ width: 120 }}>Convite</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <label className="check">
                          <input type="checkbox" name="community" value={g.id} defaultChecked={g.isCommunity} />
                        </label>
                      </td>
                      <td>
                        <label className="check">
                          <input type="radio" name="results" value={g.id} defaultChecked={g.isResults} />
                        </label>
                      </td>
                      <td>
                        <b style={{ fontWeight: 550 }}>{g.name}</b>
                        {g.isResults && <span className="chip c-s" style={{ marginLeft: 8 }}>resultados</span>}
                        {!g.isCommunity && !g.isResults && <span className="dim" style={{ marginLeft: 8, fontSize: 12 }}>fora da Tribo</span>}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                          <div style={{ flex: 1 }}>
                            <Bar value={g.size} max={g.capacity} />
                          </div>
                          <span className="mut">{g.size}</span>
                        </div>
                      </td>
                      <td>
                        <input className="in" name={`cap_${g.id}`} defaultValue={g.capacity} style={{ width: 90, height: 32 }} inputMode="numeric" />
                      </td>
                      <td>
                        {g.inviteCode ? (
                          <a className="chip c-k" href={`https://chat.whatsapp.com/${g.inviteCode}`} target="_blank" rel="noreferrer">
                            abrir link
                          </a>
                        ) : (
                          <span className="dim" style={{ fontSize: 12 }}>precisa ser admin</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </form>
        </>
      )}
    </>
  );
}
