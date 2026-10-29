import { NumberInput } from "@/components/NumberInput";
import Link from "next/link";
import { Megaphone, RefreshCw, ShieldCheck, Users } from "lucide-react";
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

export default async function Grupos({ searchParams }: { searchParams: Promise<{ ok?: string; v?: string }> }) {
  const sp = await searchParams;
  const view = sp.v ?? "admin";
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
      <Header title="Grupos" lede="Suas comunidades e grupos do WhatsApp. Por padrão aparecem só os que você administra. Marque os que o Hub vai cuidar: o resto fica de fora.">
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
