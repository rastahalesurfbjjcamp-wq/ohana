import { NumberInput } from "@/components/NumberInput";
import Link from "next/link";
import { ChevronRight, ImagePlus, Layers, Link2, ListChecks, LogOut, Megaphone, PencilLine, RefreshCw, ShieldCheck, Users, UsersRound } from "lucide-react";
import { redis } from "@/lib/queue";
import { fillOrder, hasRoom, redirectLink } from "@/lib/redirect";
import { addDays, isoDayLocal } from "@/lib/time";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Menu } from "@/components/Menu";
import { bulkGroupAdmins, bulkGroupInfo, bulkGroupPicture, createGroupsBatch, leaveHub } from "../acoes4";
import { db } from "@/lib/db";
import { Bar, Header, Kpi, Panel } from "@/components/ui";
import { saveGroupSelection, syncGroupsAction } from "../actions";

export const dynamic = "force-dynamic";

type G = Awaited<ReturnType<typeof db.group.findMany>>[number];

function Row({ g, nested }: { g: G; nested?: boolean }) {
  const isAnnounce = g.kind === "avisos";
  return (
    <tr>
      <td style={{ width: 110 }}>
        <label className="check"><input type="checkbox" name="community" value={g.id} defaultChecked={g.isCommunity} /></label>
      </td>
      <td style={{ width: 100 }}>
        <label className="check"><input type="radio" name="results" value={g.id} defaultChecked={g.isResults} /></label>
      </td>
      <td style={{ paddingLeft: nested ? 40 : undefined }}>
        <div className="row" style={{ gap: 8 }}>
          {isAnnounce ? <Megaphone size={14} className="dim" /> : null}
          <b style={{ fontWeight: 550 }}>{isAnnounce ? `Avisos: ${g.name}` : g.name}</b>
          {g.iAmAdmin && <span className="chip c-l"><ShieldCheck size={12} /> admin</span>}
          {g.isResults && <span className="chip c-s">resultados</span>}
        </div>
        {isAnnounce && <div className="dim" style={{ fontSize: 12 }}>Mensagem aqui chega em todo mundo da comunidade</div>}
      </td>
      <td style={{ width: 200 }}>
        <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
          <div style={{ flex: 1 }}><Bar value={g.size} max={g.capacity} /></div>
          <span className="mut">{g.size}</span>
        </div>
      </td>
      <td style={{ width: 100 }}>
        <NumberInput size="sm" name={`cap_${g.id}`} defaultValue={g.capacity} step={50} />
      </td>
    </tr>
  );
}

async function Escolher({ sp }: { sp: { ok?: string; v?: string } }) {
  const view = sp.v === "escolher" ? "admin" : sp.v ?? "admin";
  const [all, wa] = await Promise.all([
    db.group.findMany({ where: { archived: false }, orderBy: [{ size: "desc" }] }),
    db.setting.findUnique({ where: { key: "_whatsapp" } }),
  ]);
  const connected = (wa?.value as { state?: string } | undefined)?.state === "open";
  const selected = all.filter((g) => g.isCommunity || g.isResults);
  const groups = view === "selecionados" ? selected : view === "todos" ? all : all.filter((g) => g.iAmAdmin || g.isCommunity || g.isResults);
  const communities = all.filter((g) => g.kind === "comunidade");
  const shown = new Set<string>();
  const blocks: { title: string; parent?: G; items: G[] }[] = [];
  for (const c of communities) {
    const items = groups.filter((g) => g.parentJid === c.jid);
    if (!items.length) continue;
    items.sort((a, b) => (a.kind === "avisos" ? -1 : b.kind === "avisos" ? 1 : b.size - a.size));
    items.forEach((g) => shown.add(g.id));
    blocks.push({ title: c.name, parent: c, items });
  }
  const loose = groups.filter((g) => !shown.has(g.id) && g.kind !== "comunidade");
  if (loose.length) blocks.push({ title: "Grupos fora de comunidade", items: loose });
  const members = selected.filter((g) => g.isCommunity).reduce((s, g) => s + g.size, 0);
  const firstTime = all.length > 0 && !selected.length;

  return (
    <>
      <Header title="Escolher grupos" lede="Por padrão aparecem só os grupos que você administra. Marque os que o Hub vai cuidar: o resto fica de fora.">
        <Link className="btn ghost" href="/grupos">Voltar</Link>
        <form action={syncGroupsAction}>
          <button className="btn" type="submit"><RefreshCw size={15} /> Atualizar lista</button>
        </form>
      </Header>
      {sp.ok && <div className="ok">Seleção salva. O Hub agora trabalha só com os grupos marcados.</div>}
      {firstTime && <div className="note">Marque os grupos da comunidade (entradas e saídas, mensagem de volta, agendamentos, disparos) e escolha um grupo de resultados (relatório e comandos).</div>}
      {!all.length && (
        <Panel title="Nenhum grupo ainda">
          <div className="stack">
            <p className="mut">{connected ? "O número está conectado. Clique em Atualizar lista para puxar os grupos." : "Primeiro conecte o WhatsApp em Configurações. Os grupos aparecem aqui logo depois."}</p>
            {!connected && <div><Link className="btn pri" href="/configuracoes">Conectar WhatsApp</Link></div>}
          </div>
        </Panel>
      )}
      {all.length > 0 && (
        <>
          <div className="grid g4">
            <Kpi icon={<Users size={15} />} label="Grupos selecionados" value={selected.filter((g) => g.isCommunity).length} sub={`de ${all.filter((g) => g.iAmAdmin).length} onde você é admin`} />
            <Kpi label="Pessoas nos selecionados" value={members.toLocaleString("pt-BR")} />
            <Kpi label="Comunidades" value={communities.length} />
            <Kpi label="Grupo de resultados" value={all.find((g) => g.isResults)?.name ?? "–"} />
          </div>
          <div className="tabs">
            <a href="/grupos?v=admin" className={view === "admin" ? "on" : ""}>Onde sou admin</a>
            <a href="/grupos?v=selecionados" className={view === "selecionados" ? "on" : ""}>Selecionados ({selected.length})</a>
            <a href="/grupos?v=todos" className={view === "todos" ? "on" : ""}>Todos ({all.length})</a>
          </div>
          <form action={saveGroupSelection}>
            {/* mantém marcados os grupos que não aparecem neste filtro */}
            {all.filter((g) => !groups.includes(g)).map((g) => (
              <span key={g.id}>
                {g.isCommunity && <input type="hidden" name="community" value={g.id} />}
                {g.isResults && <input type="hidden" name="results" value={g.id} />}
              </span>
            ))}
            <div className="stack">
              {blocks.map((b) => (
                <Panel key={b.title} title={b.parent ? `Comunidade: ${b.title}` : b.title} sub={b.parent ? `${b.items.length} grupo(s) nesta comunidade` : undefined} body={false}
                  right={<button className="btn pri sm" type="submit">Salvar seleção</button>}>
                  <table className="tb">
                    <thead><tr><th>Cuidar</th><th>Resultados</th><th>Grupo</th><th>Lotação</th><th>Limite</th></tr></thead>
                    <tbody>{b.items.map((g) => <Row key={g.id} g={g} nested={!!b.parent} />)}</tbody>
                  </table>
                </Panel>
              ))}
              {!blocks.length && <Panel title="Nada neste filtro"><p className="mut">Nenhum grupo onde o número conectado é admin. Veja em “Todos”.</p></Panel>}
            </div>
          </form>
        </>
      )}
    </>
  );
}

const initials = (name: string) => {
  const num = name.match(/(\d+)\s*$/)?.[1];
  const w = name.replace(/\d+\s*$/, "").trim().split(/\s+/).filter((x) => !/^(grupo|de|da|do)$/i.test(x));
  return ((w[0]?.[0] ?? "G") + (num ? String(Number(num)) : w[1]?.[0] ?? "")).toUpperCase().slice(0, 3);
};

export default async function Grupos({ searchParams }: { searchParams: Promise<{ ok?: string; v?: string; acao?: string; criar?: string; f?: string; feito?: string; falha?: string; criados?: string; erro?: string }> }) {
  const sp = await searchParams;
  if (sp.v) return <Escolher sp={sp} />;
  const [order, results, all] = await Promise.all([
    fillOrder(),
    db.group.findMany({ where: { isResults: true, archived: false } }),
    db.group.count({ where: { archived: false } }),
  ]);
  if (!order.length && !results.length) return <Escolher sp={sp} />;
  const now = order.find((g) => g.inviteCode && hasRoom(g)) ?? null;
  const week = new Date(Date.now() - 7 * 864e5);
  const ev = await db.memberEvent.groupBy({ by: ["groupId", "type"], where: { createdAt: { gte: week }, groupId: { in: order.map((g) => g.id) } }, _count: true });
  const delta = (id: string) => ev.filter((e) => e.groupId === id).reduce((a, e) => a + (e.type === "LEAVE" ? -e._count : e._count), 0);
  let clicks7 = 0, clicksTotal = 0;
  try {
    const today = isoDayLocal();
    const vals = await redis().mget(...Array.from({ length: 7 }, (_, i) => `hub:gclicks:${addDays(today, -i)}`), "hub:gclicks:total");
    clicksTotal = Number(vals.pop() ?? 0);
    clicks7 = vals.reduce((a, v) => a + Number(v ?? 0), 0);
  } catch {}
  const people = order.reduce((a, g) => a + g.size, 0);
  const nowIdx = now ? order.indexOf(now) : -1;
  const chain = order.slice(Math.max(0, nowIdx - 1), Math.max(0, nowIdx - 1) + 3);
  const status = (g: (typeof order)[number]) => {
    const r = g.capacity ? g.size / g.capacity : 0;
    if (now && g.id === now.id) return ["Recebendo", "c-l"];
    if (!hasRoom(g)) return ["Cheio", "c-c"];
    if (!g.inviteCode) return ["Sem convite", "c-n"];
    if (r >= 0.85) return ["Quase cheio", "c-s"];
    return [order.indexOf(g) > nowIdx ? "Próximo da fila" : "Com vaga", "c-n"];
  };
  const f = sp.f ?? "todos";
  const rows = f === "resultados" ? results : f === "comunidade" ? order : [...order, ...results];
  const link = redirectLink();
  const acao = sp.acao;

  return (
    <>
      <Header title="Grupos" lede={`${order.length} grupos com ${people.toLocaleString("pt-BR")} pessoas. Quando um enche, o próximo abre sozinho.`}>
        <Link className="btn" href="/grupos?v=escolher"><ListChecks size={16} /> Escolher grupos</Link>
        <Link className="btn pri" href={sp.criar ? "/grupos" : "/grupos?criar=1"}><Layers size={16} /> Criar grupos em lote</Link>
      </Header>
      {sp.feito && <div className={Number(sp.falha) ? "note" : "ok"}>Feito em {sp.feito} grupo(s).{Number(sp.falha) ? ` ${sp.falha} não deram certo: confira se o número é admin neles.` : ""}</div>}
      {sp.ok && <div className="ok">Seleção salva. O Hub agora trabalha só com os grupos marcados.</div>}
      {sp.criados && <div className="ok">{sp.criados} grupo(s) criados e colocados no fim da fila.</div>}

      {sp.criar && (
        <Panel title="Criar grupos em lote" sub="O WhatsApp pede pelo menos uma pessoa junto na criação. Use o número de alguém da equipe.">
          <form action={createGroupsBatch} className="stack">
            {sp.erro === "numero" && <div className="err">Coloque um WhatsApp válido de alguém da equipe.</div>}
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Nome base</label><input className="in" name="prefix" defaultValue="Grupo VIP" /></div>
              <div className="field"><label>Começar do número</label><NumberInput name="start" defaultValue={order.length + 1} min={1} /></div>
              <div className="field"><label>Quantos grupos</label><NumberInput name="count" defaultValue={3} min={1} max={10} /></div>
              <div className="field" style={{ minWidth: 200 }}><label>WhatsApp de um admin</label><input className="in" name="admin" placeholder="21 99999-9999" inputMode="tel" /></div>
            </div>
            <div className="field"><label>Descrição (opcional)</label><textarea className="in" name="description" style={{ minHeight: 64 }} /></div>
            <div><ConfirmButton className="btn pri" message="Criar os grupos agora no WhatsApp?"><Layers size={15} /> Criar grupos</ConfirmButton></div>
          </form>
        </Panel>
      )}

      <div className="cols c-2-1">
        <section className="pnl" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Link único para os anúncios</h3>
          <p className="dim" style={{ fontSize: 12.5, margin: "3px 0 14px" }}>Um link só. O Hub manda cada pessoa para o grupo que ainda tem vaga.</p>
          <div className="biglink">
            <Link2 size={20} className="dim" />
            <span className="u">{link.replace(/^https?:\/\//, "")}</span>
            <span className="chip c-l" title={`${clicksTotal} no total`}>{clicks7.toLocaleString("pt-BR")} cliques em 7 dias</span>
            <CopyButton text={link} />
          </div>
          {chain.length > 0 ? (
            <div className="chain">
              {chain.map((g, i) => (
                <div key={g.id} style={{ display: "contents" }}>
                  {i > 0 && <span className="arr"><ChevronRight size={16} /></span>}
                  <div className={`gq${now && g.id === now.id ? " now" : ""}`}>
                    <b>{g.name}</b>
                    {now && g.id === now.id ? <small className="up">recebendo agora · {g.capacity - g.size} vagas</small> : !hasRoom(g) ? <small className="dn">cheio</small> : <small className="dim">{order.indexOf(g) > nowIdx ? `próximo · ${g.capacity - g.size} vagas` : `${g.capacity - g.size} vagas`}</small>}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {!now && <div className="note" style={{ marginTop: 14 }}>Nenhum grupo com vaga e convite agora. Crie mais grupos em lote ou aumente o limite.</div>}
        </section>

        <section className="pnl" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Ações em todos os grupos</h3>
          <div className="stack" style={{ gap: 8 }}>
            {[
              ["nome", PencilLine, "t-l", "Nome e descrição", "Troca em todos de uma vez"],
              ["foto", ImagePlus, "t-s", "Foto dos grupos", `Mesma arte em ${order.length} grupos`],
              ["admins", UsersRound, "t-k", "Quem pode mandar mensagem", "Só admins ou todo mundo"],
            ].map(([k, Icon, tone, t, d]) => {
              const I = Icon as typeof PencilLine;
              return (
                <Link key={k as string} href={acao === k ? "/grupos" : `/grupos?acao=${k}`} className={`act-card${acao === k ? " on" : ""}`}>
                  <span className={`tile ${tone}`}><I size={18} /></span>
                  <div><b>{t as string}</b><small>{d as string}</small></div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {acao === "nome" && (
        <Panel title="Nome e descrição de todos os grupos" sub="Use {n} no nome para numerar na ordem da fila (01, 02...). Campo vazio não muda nada.">
          <form action={bulkGroupInfo} className="stack">
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 1, minWidth: 240 }}><label>Nome</label><input className="in" name="name" placeholder="Rasta Hale VIP {n}" /></div>
              <div className="field"><label>Primeiro número</label><NumberInput name="start" defaultValue={1} min={1} /></div>
            </div>
            <div className="field"><label>Descrição</label><textarea className="in" name="description" placeholder="Regras, links e avisos do grupo" /></div>
            <div><ConfirmButton className="btn pri" message={`Trocar em ${order.length} grupos? Os membros veem a mudança.`}>Aplicar em todos</ConfirmButton></div>
          </form>
        </Panel>
      )}
      {acao === "foto" && (
        <Panel title="Foto de todos os grupos" sub="Imagem quadrada, de preferência 640 x 640.">
          <form action={bulkGroupPicture} className="row" style={{ alignItems: "center" }}>
            <input className="in file" type="file" name="photo" accept="image/*" required style={{ maxWidth: 360 }} />
            <ConfirmButton className="btn pri" message={`Trocar a foto de ${order.length} grupos?`}><ImagePlus size={15} /> Trocar foto</ConfirmButton>
          </form>
        </Panel>
      )}
      {acao === "admins" && (
        <Panel title="Quem pode mandar mensagem" sub="Vale para todos os grupos da comunidade.">
          <form action={bulkGroupAdmins} className="row" style={{ alignItems: "center" }}>
            <label className="check"><input type="radio" name="mode" value="admins" defaultChecked /> Só admins</label>
            <label className="check"><input type="radio" name="mode" value="todos" /> Todo mundo</label>
            <ConfirmButton className="btn pri" message={`Aplicar em ${order.length} grupos?`}><ShieldCheck size={15} /> Aplicar</ConfirmButton>
          </form>
        </Panel>
      )}

      <Panel title="Todos os grupos" sub="Lotação e entradas nos últimos 7 dias" body={false}
        right={<div className="seg">{[["todos", "Todos"], ["comunidade", "Comunidade"], ["resultados", "Resultados"]].map(([k, l]) => <Link key={k} href={`/grupos?f=${k}`} className={f === k ? "on" : ""}>{l}</Link>)}</div>}>
        <div style={{ overflowX: "auto" }}>
          <table className="tb">
            <thead><tr><th>Grupo</th><th>Membros</th><th style={{ width: 200 }}>Lotação</th><th>7 dias</th><th>Status</th><th style={{ width: 50 }} /></tr></thead>
            <tbody>
              {rows.map((g) => {
                const isRes = g.isResults;
                const d = delta(g.id);
                const [st, tone] = isRes ? ["Resultados", "c-k"] : status(g);
                return (
                  <tr key={g.id}>
                    <td>
                      <div className="row" style={{ gap: 12, flexWrap: "nowrap" }}>
                        <span className="gav">{initials(g.name)}</span>
                        <div>
                          <b style={{ fontWeight: 600 }}>{g.kind === "avisos" ? `Avisos: ${g.name}` : g.name}</b>
                          {g.iAmAdmin && <div className="dim" style={{ fontSize: 12 }}><ShieldCheck size={11} /> você é admin</div>}
                        </div>
                      </div>
                    </td>
                    <td><b style={{ fontWeight: 600 }}>{g.size.toLocaleString("pt-BR")}</b><span className="dim">/{g.capacity.toLocaleString("pt-BR")}</span></td>
                    <td><Bar value={g.size} max={g.capacity} /></td>
                    <td className={d > 0 ? "up" : d < 0 ? "dn" : "dim"} style={{ fontWeight: 600 }}>{d > 0 ? "+" : ""}{d}</td>
                    <td><span className={`chip ${tone}`}>{st}</span></td>
                    <td className="r">
                      <Menu>
                        <Link href={`/entradas?g=${g.id}`}><Users size={15} /> Ver entradas e saídas</Link>
                        {g.inviteCode && <a href={`https://chat.whatsapp.com/${g.inviteCode}`} target="_blank" rel="noreferrer"><Link2 size={15} /> Abrir convite</a>}
                        <Link href="/grupos?v=escolher"><Megaphone size={15} /> Mudar limite</Link>
                        <form action={leaveHub}><input type="hidden" name="id" value={g.id} /><button type="submit" className="dn"><LogOut size={15} /> Tirar do Hub</button></form>
                      </Menu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {all > rows.length && <div className="dim" style={{ fontSize: 12.5, padding: "12px 22px" }}>{all - order.length - results.length} grupo(s) do WhatsApp ficam de fora. <Link href="/grupos?v=escolher" style={{ color: "var(--lagoon)" }}>Escolher grupos</Link></div>}
      </Panel>
      <form action={syncGroupsAction} style={{ alignSelf: "flex-start" }}><button className="btn ghost sm" type="submit"><RefreshCw size={14} /> Atualizar lista do WhatsApp</button></form>
    </>
  );
}
