import { db } from "@/lib/db";
import { TRIGGERS } from "@/lib/funnels";
import { Header, Panel } from "@/components/ui";
import { saveFunnel, toggleFunnel } from "../acoes3";

export const dynamic = "force-dynamic";

type Step = { delayMin: number; text: string };
const human = (m: number) => (m === 0 ? "na hora" : m % 1440 === 0 ? `${m / 1440} dia(s) depois` : m % 60 === 0 ? `${m / 60} hora(s) depois` : `${m} min depois`);

function StepRow({ i, step }: { i: number; step?: Step }) {
  const unit = !step ? "h" : step.delayMin % 1440 === 0 && step.delayMin ? "d" : step.delayMin % 60 === 0 && step.delayMin ? "h" : "m";
  const val = !step ? "" : unit === "d" ? step.delayMin / 1440 : unit === "h" ? step.delayMin / 60 : step.delayMin;
  return (
    <div className="stack" style={{ gap: 6, padding: 12, border: "1px solid var(--line)", borderRadius: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <b style={{ fontSize: 13 }}>Mensagem {i + 1}</b>
        <input className="in" name={`s${i}_delay`} defaultValue={val} style={{ width: 70, height: 32 }} inputMode="numeric" />
        <select className="in" name={`s${i}_unit`} defaultValue={unit} style={{ width: 110, height: 32 }}>
          <option value="m">minutos</option><option value="h">horas</option><option value="d">dias</option>
        </select>
        <span className="dim" style={{ fontSize: 12 }}>{i === 0 ? "depois do gatilho" : "depois da anterior"}</span>
      </div>
      <textarea className="in" name={`s${i}_text`} defaultValue={step?.text ?? ""} style={{ minHeight: 60 }} placeholder="Deixe vazio para não usar" />
    </div>
  );
}

export default async function Funis({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const sp = await searchParams;
  const funnels = await db.funnel.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { runs: true } } } });
  const editing = sp.e ? funnels.find((f) => f.id === sp.e) : undefined;
  const steps = (editing?.steps as Step[] | undefined) ?? [];
  const done = await db.funnelRun.groupBy({ by: ["funnelId", "status"], _count: true });

  return (
    <>
      <Header title="Funis" lede="Sequências de mensagens no privado que começam sozinhas quando algo acontece: virou lead, entrou ou saiu do grupo, fez a primeira compra." />
      {sp.ok && <div className="ok">Funil salvo.</div>}
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title={editing ? `Editar: ${editing.name}` : "Novo funil"}>
          <form action={saveFunnel} className="stack" key={editing?.id ?? "novo"}>
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <div className="field"><label>Nome</label><input className="in" name="name" defaultValue={editing?.name ?? ""} placeholder="Boas-vindas ao Grupo VIP" required /></div>
            <div className="field">
              <label>Começa quando</label>
              <select className="in" name="trigger" defaultValue={editing?.trigger ?? "lead_novo"}>
                {Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {[0, 1, 2, 3].map((i) => <StepRow key={i} i={i} step={steps[i]} />)}
            <span className="hint">{"{nome}"} = primeiro nome, {"{link}"} = link do grupo com vaga, {"{loja}"} = nome da loja. Quem responder SAIR não recebe mais.</span>
            <label className="check"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Ligado</label>
            <div className="row">
              <button className="btn pri" type="submit">Salvar funil</button>
              {editing && <a className="btn" href="/funis">Cancelar</a>}
            </div>
          </form>
        </Panel>
        <Panel title="Funis" body={false}>
          {funnels.length ? (
            <table className="tb"><tbody>
              {funnels.map((f) => {
                const st = (f.steps as Step[]) ?? [];
                const finished = done.find((d) => d.funnelId === f.id && d.status === "concluido")?._count ?? 0;
                return (
                  <tr key={f.id}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <b style={{ fontWeight: 550 }}>{f.name}</b>
                        <span className={`chip ${f.active ? "c-l" : "c-n"}`}>{f.active ? "ligado" : "desligado"}</span>
                      </div>
                      <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{TRIGGERS[f.trigger] ?? f.trigger} · {st.map((s) => human(s.delayMin)).join(", ")}</div>
                      <div className="dim" style={{ fontSize: 12 }}>{f._count.runs} pessoas entraram, {finished} concluíram</div>
                    </td>
                    <td className="r" style={{ width: 170 }}>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <a className="btn sm" href={`/funis?e=${f.id}`}>Editar</a>
                        <form action={toggleFunnel}><input type="hidden" name="id" value={f.id} /><button className="btn sm">{f.active ? "Desligar" : "Ligar"}</button></form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody></table>
          ) : <div className="empty">Nenhum funil ainda.</div>}
        </Panel>
      </div>
    </>
  );
}
