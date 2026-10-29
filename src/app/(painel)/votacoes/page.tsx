import Link from "next/link";
import { BellRing, ListChecks, Plus, Trophy, Vote, X } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { Header, Panel } from "@/components/ui";
import { GroupPicker } from "@/components/fields";
import { CopyButton } from "@/components/CopyButton";
import { closePoll, createPoll, pollToPresale, pollToTask } from "../acoes2";

export const dynamic = "force-dynamic";

export default async function Votacoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; id?: string; nova?: string; tarefa?: string }> }) {
  const sp = await searchParams;
  const [polls, groups, members] = await Promise.all([
    db.poll.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { votes: true } }),
    db.group.findMany({ where: { archived: false, isCommunity: true }, orderBy: { name: "asc" } }),
    db.membership.count({ where: { leftAt: null, group: { isCommunity: true } } }),
  ]);
  const base = env.appUrl().replace(/\/$/, "");
  const cur = polls.find((p) => p.id === sp.id) ?? polls[0];
  const counts = cur ? cur.options.map((_, i) => cur.votes.filter((v) => v.option === i).length) : [];
  const total = cur?.votes.length ?? 0;
  const lead = counts.length ? counts.indexOf(Math.max(...counts)) : -1;
  const showForm = sp.nova || !polls.length;
  const closes = cur?.closesAt ? Math.ceil((cur.closesAt.getTime() - Date.now()) / 864e5) : null;

  return (
    <>
      <Header title="Votações da comunidade" lede="A comunidade escolhe o próximo drop. Você produz o que já tem gente querendo comprar.">
        <Link className="btn pri" href={showForm && polls.length ? "/votacoes" : "/votacoes?nova=1"}><Plus size={16} /> Nova votação</Link>
      </Header>
      {sp.ok && <div className="ok">Votação criada e enviada para os grupos.</div>}
      {sp.tarefa && <div className="ok">Tarefa de produção criada. <Link href="/tarefas" style={{ textDecoration: "underline" }}>Ver tarefas</Link></div>}
      {sp.erro && <div className="err">Escreva a pergunta e pelo menos 2 opções.</div>}
      {showForm && (
        <Panel title="Nova votação" right={polls.length ? <Link className="menu-b" href="/votacoes"><X size={16} /></Link> : undefined}>
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
            <div className="field"><label>Fotos das opções, na mesma ordem (só página fechada)</label><input className="in file" type="file" name="images" accept="image/*" multiple /></div>
            <div className="field">
              <label>Grupos</label>
              <GroupPicker name="groups" groups={groups.map((g) => ({ jid: g.jid, name: g.name, size: g.size, checked: true }))} />
            </div>
            <div><button className="btn pri" type="submit">Criar e enviar</button></div>
          </form>
        </Panel>
      )}
      {cur && (
        <div className="cols c-2-1" style={{ alignItems: "start" }}>
          <section className="pnl" style={{ padding: 22 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 650 }}>{cur.question}</h3>
                <small className="dim">Enviada em {cur.groupJids.length} grupo(s){cur.mode === "pagina" ? " · página fechada com fotos" : " · enquete no grupo"}{closes != null && cur.status === "aberta" ? ` · fecha em ${closes} dia(s)` : ""}</small>
              </div>
              <span className={`chip ${cur.status === "aberta" ? "c-l" : "c-n"}`}><Vote size={12} /> {cur.status === "aberta" ? "Aberta" : "Encerrada"}</span>
            </div>
            {cur.mode === "pagina" ? (
              <div className="stack" style={{ gap: 10 }}>
                {cur.options.map((o, i) => {
                  const pctv = total ? Math.round((counts[i] / total) * 100) : 0;
                  return (
                    <div key={i} className={`popt${i === lead && total ? " lead" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {cur.imageUrls[i] ? <img src={cur.imageUrls[i].replace(/^https?:\/\/[^/]+/, "")} alt="" /> : <span className="tile t-n"><Trophy size={18} /></span>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row" style={{ justifyContent: "space-between" }}><b>{o}</b><span className="pct">{pctv}%</span></div>
                        <div className="hbar" style={{ height: 9, margin: "8px 0 4px" }}><i className={i === lead && total ? "s" : ""} style={{ width: `${Math.max(2, pctv)}%` }} /></div>
                        <small className="dim">{counts[i]} voto{counts[i] === 1 ? "" : "s"}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="callout sun">Na enquete do grupo o resultado fica no próprio WhatsApp. Para ver os votos aqui e ter fotos, use a página fechada. Opções: {cur.options.join(", ")}.</div>
            )}
          </section>
          <div className="stack">
            <Panel title="Resumo">
              <div className="kv"><span className="mut">Votos</span><b>{total.toLocaleString("pt-BR")}</b></div>
              <div className="kv"><span className="mut">Participação</span><b>{members ? `${Math.round((total / members) * 100)}% da comunidade` : "–"}</b></div>
              {lead >= 0 && total > 0 && <div className="kv"><span className="mut">Na frente</span><b style={{ color: "var(--sun)" }}>{cur.options[lead]}</b></div>}
              <div className="stack" style={{ gap: 8, marginTop: 14 }}>
                <form action={pollToTask}><input type="hidden" name="id" value={cur.id} /><button className="btn pri lg" type="submit" disabled={!total} style={{ width: "100%", justifyContent: "center" }}><ListChecks size={16} /> Virar tarefa de produção</button></form>
                <form action={pollToPresale}><input type="hidden" name="id" value={cur.id} /><button className="btn" type="submit" disabled={!total} style={{ width: "100%", justifyContent: "center" }}><BellRing size={15} /> Abrir pré-venda para quem votou</button></form>
                {cur.status === "aberta" && <form action={closePoll}><input type="hidden" name="id" value={cur.id} /><button className="btn ghost sm" type="submit" style={{ width: "100%", justifyContent: "center" }}>Encerrar votação</button></form>}
              </div>
              {cur.mode === "pagina" && (
                <>
                  <div className="ib-sec">Link da votação</div>
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <span className="trk" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "9px 10px" }}>{base.replace(/^https?:\/\//, "")}/votar/{cur.id}</span>
                    <CopyButton text={`${base}/votar/${cur.id}`} className="btn sm" />
                  </div>
                </>
              )}
            </Panel>
            {polls.length > 1 && (
              <Panel title="Outras votações">
                {polls.filter((p) => p.id !== cur.id).slice(0, 8).map((p) => (
                  <Link key={p.id} href={`/votacoes?id=${p.id}`} className="lrow" style={{ color: "inherit" }}>
                    <div style={{ minWidth: 0 }}><div className="t" style={{ fontSize: 13.5 }}>{p.question}</div><div className="s">{p.votes.length} votos · {p.status}</div></div>
                  </Link>
                ))}
              </Panel>
            )}
          </div>
        </div>
      )}
    </>
  );
}
