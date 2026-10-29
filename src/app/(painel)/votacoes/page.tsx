import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { Bar, Header, Panel } from "@/components/ui";
import { closePoll, createPoll } from "../acoes2";

export const dynamic = "force-dynamic";

export default async function Votacoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const [polls, groups] = await Promise.all([
    db.poll.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { votes: true } }),
    db.group.findMany({ where: { archived: false, isCommunity: true }, orderBy: { name: "asc" } }),
  ]);
  const base = env.appUrl().replace(/\/$/, "");

  return (
    <>
      <Header title="Votações" lede="A comunidade escolhe estampa, cor ou próximo drop. Enquete direto no grupo, ou página fechada com as fotos protegidas por marca d’água." />
      {sp.ok && <div className="ok">Votação criada.</div>}
      {sp.erro && <div className="err">Escreva a pergunta e pelo menos 2 opções.</div>}
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Nova votação">
          <form action={createPoll} className="stack">
            <div className="field"><label>Pergunta</label><input className="in" name="question" required placeholder="Qual estampa entra no próximo drop?" /></div>
            <div className="field"><label>Opções (uma por linha)</label><textarea className="in" name="options" required placeholder={"Estampa A\nEstampa B\nEstampa C"} /></div>
            <div className="field">
              <label>Como votar</label>
              <select className="in" name="mode" defaultValue="grupo">
                <option value="grupo">Enquete do WhatsApp dentro do grupo</option>
                <option value="pagina">Página fechada com fotos (só quem está nos grupos vota)</option>
              </select>
              <span className="hint">Na enquete do grupo não dá para colocar foto e os resultados ficam no próprio WhatsApp. Na página fechada as fotos ficam com marca d’água e não vão para o grupo.</span>
            </div>
            <div className="field"><label>Fotos das opções, na mesma ordem (só página fechada)</label><input className="in" type="file" name="images" accept="image/*" multiple style={{ paddingTop: 8 }} /></div>
            <div className="field">
              <label>Grupos</label>
              <div className="stack" style={{ gap: 8, maxHeight: 180, overflowY: "auto" }}>
                {groups.map((g) => (
                  <label key={g.id} className="check"><input type="checkbox" name="groups" value={g.jid} defaultChecked /> {g.name}</label>
                ))}
                {!groups.length && <span className="dim">Marque os grupos da comunidade na página Grupos.</span>}
              </div>
            </div>
            <div><button className="btn pri" type="submit">Criar e enviar</button></div>
          </form>
        </Panel>
        <Panel title="Votações" body={false}>
          {polls.length ? (
            <table className="tb">
              <tbody>
                {polls.map((p) => {
                  const counts = p.options.map((_, i) => p.votes.filter((v) => v.option === i).length);
                  const total = p.votes.length;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                          <b style={{ fontWeight: 550 }}>{p.question}</b>
                          <span className={`chip ${p.status === "aberta" ? "c-l" : "c-n"}`}>{p.status}</span>
                          <span className="chip c-k">{p.mode === "pagina" ? "página" : "enquete no grupo"}</span>
                        </div>
                        {p.mode === "pagina" ? (
                          <div className="stack" style={{ gap: 6 }}>
                            {p.options.map((o, i) => (
                              <div key={i} className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                                <span style={{ width: 140, fontSize: 13 }}>{o}</span>
                                <div style={{ flex: 1 }}><Bar value={counts[i]} max={Math.max(1, total)} /></div>
                                <span className="mut" style={{ fontSize: 12, width: 60, textAlign: "right" }}>{counts[i]} votos</span>
                              </div>
                            ))}
                            <a className="dim" style={{ fontSize: 12 }} href={`${base}/votar/${p.id}`} target="_blank" rel="noreferrer">{base.replace(/^https?:\/\//, "")}/votar/{p.id}</a>
                          </div>
                        ) : (
                          <div className="dim" style={{ fontSize: 12.5 }}>{p.options.join(" · ")}. Resultado na própria enquete do grupo.</div>
                        )}
                      </td>
                      <td className="r" style={{ width: 90 }}>
                        {p.status === "aberta" && (
                          <form action={closePoll}><input type="hidden" name="id" value={p.id} /><button className="btn sm">Encerrar</button></form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma votação ainda.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
