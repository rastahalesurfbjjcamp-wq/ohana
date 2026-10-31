import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Clock, Copy, GitBranch, ListPlus, LogOut, MessageCircle, Plus, Tag, Trash2, X, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { brl } from "@/lib/time";
import { Header } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { TRIGGERS, VARS, triggerLabel, type Flow, type Node } from "@/lib/automations";
import { addNode, deleteAutomation, deleteNode, duplicateAutomation, saveAutomation, saveNode, toggleAutomation } from "../../acoes10";

export const dynamic = "force-dynamic";

const BLOCKS: { type: string; label: string; icon: ReactNode; tone: string }[] = [
  { type: "send", label: "Enviar WhatsApp", icon: <MessageCircle size={15} />, tone: "t-l" },
  { type: "wait", label: "Aguardar", icon: <Clock size={15} />, tone: "t-s" },
  { type: "waitHour", label: "Aguardar até a hora", icon: <CalendarClock size={15} />, tone: "t-s" },
  { type: "cond", label: "Condição", icon: <GitBranch size={15} />, tone: "t-p" },
  { type: "tag", label: "Etiqueta", icon: <Tag size={15} />, tone: "t-k" },
  { type: "list", label: "Lista", icon: <ListPlus size={15} />, tone: "t-k" },
  { type: "exit", label: "Sair", icon: <LogOut size={15} />, tone: "t-c" },
];
const CHECK: Record<string, string> = { pagou: "Pagou / comprou?", respondeu: "Respondeu?", clicou: "Clicou em algum link?", etiqueta: "Tem a etiqueta?", lista: "Está na lista?" };
const UNIT: Record<string, string> = { min: "minuto(s)", h: "hora(s)", d: "dia(s)" };

export default async function Editor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ node?: string; add?: string; salvo?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const a = await db.automation.findUnique({ where: { id } });
  if (!a) notFound();
  const fl = (a.flow ?? {}) as Partial<Flow>;
  const flow: Flow = { start: fl.start, nodes: fl.nodes ?? {} };
  const cfg = (a.config ?? {}) as { delayMin?: number; listId?: string };
  const [lists, agg, clicked, recent] = await Promise.all([
    db.contactList.findMany({ orderBy: { name: "asc" } }),
    db.automationRun.aggregate({ where: { automationId: id }, _count: true, _sum: { sent: true, value: true } }),
    db.automationRun.count({ where: { automationId: id, clicks: { gt: 0 } } }),
    db.automationRun.findMany({ where: { automationId: id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const listName = new Map(lists.map((l) => [l.id, l.name]));
  const sel = sp.node ? flow.nodes[sp.node] : null;
  const [addParent, addPort] = (sp.add ?? "").split(":");
  const href = (q: string) => `/automacoes/${id}${q}`;

  const desc = (n: Node) => {
    if (n.type === "send") return n.parts.map((p) => (p.productImage ? "📷 foto do produto" : p.mediaUrl ? "📎 arquivo" : "") + (p.text ? `${p.productImage || p.mediaUrl ? " · " : ""}${p.text}` : "")).join("\n") || "Clique para escrever a mensagem";
    if (n.type === "wait") return `${n.amount} ${UNIT[n.unit]}`;
    if (n.type === "waitHour") return `Até as ${n.hour}`;
    if (n.type === "cond") return `${CHECK[n.check]}${n.value ? ` ${n.check === "lista" ? listName.get(n.value) ?? "" : n.value}` : ""}`;
    if (n.type === "tag") return `${n.action === "add" ? "Adicionar" : "Remover"} etiqueta "${n.tag || "?"}"`;
    if (n.type === "list") return `${n.action === "add" ? "Adicionar à" : "Remover da"} lista ${listName.get(n.listId) ?? "?"}`;
    return "Fim da automação";
  };
  const Dot = ({ parent, port, label }: { parent: string; port: string; label?: string }) => (
    <div className="fl-dot">
      <div className="fl-ln" />
      <Link className={addParent === parent && addPort === port ? "on" : ""} href={href(`?add=${parent}:${port}`)} title={label ?? "Adicionar bloco aqui"}><Plus size={14} /></Link>
      <div className="fl-ln" />
    </div>
  );
  const render = (nid: string | undefined, parent: string, port: string, depth = 0): ReactNode => {
    if (!nid || depth > 40) return <Dot parent={parent} port={port} />;
    const n = flow.nodes[nid];
    if (!n) return <Dot parent={parent} port={port} />;
    const b = BLOCKS.find((x) => x.type === n.type)!;
    return (
      <>
        <Dot parent={parent} port={port} />
        <Link href={href(`?node=${nid}`)} className={`fl-n${sp.node === nid ? " on" : ""}`}>
          <div className="h"><span className={`tile sm ${b.tone}`}>{b.icon}</span>{b.label}</div>
          <div className="d">{desc(n)}</div>
        </Link>
        {n.type === "cond" ? (
          <div className="fl-br" style={{ marginTop: 12 }}>
            <div><span className="fl-lbl c-l">Sim</span><div className="fl">{render(n.yes, nid, "yes", depth + 1)}</div></div>
            <div><span className="fl-lbl c-c">Não</span><div className="fl">{render(n.no, nid, "no", depth + 1)}</div></div>
          </div>
        ) : n.type !== "exit" ? render((n as { next?: string }).next, nid, "next", depth + 1) : null}
      </>
    );
  };

  return (
    <>
      <Header title={a.name} lede={`${triggerLabel(a.trigger)} · ${agg._count} entraram · ${agg._sum.sent ?? 0} envios · ${agg._count ? Math.round((clicked / agg._count) * 100) : 0}% clique · ${brl(agg._sum.value ?? 0, 0)} em conversão`}>
        <Link className="btn" href="/automacoes">Voltar</Link>
        <form action={duplicateAutomation}><input type="hidden" name="id" value={a.id} /><button className="btn" type="submit"><Copy size={15} /> Duplicar</button></form>
        <form action={toggleAutomation}><input type="hidden" name="id" value={a.id} /><ConfirmButton className={`btn ${a.active ? "" : "pri"}`} message={a.active ? "Desligar esta automação? Quem está no meio para de receber." : "Ligar esta automação? As mensagens começam a sair para quem entrar no gatilho a partir de agora."}>{a.active ? "Desligar" : "Ligar automação"}</ConfirmButton></form>
      </Header>
      {sp.salvo && <div className="ok">Salvo.</div>}
      <div className="cols" style={{ gridTemplateColumns: "minmax(300px, 380px) minmax(0, 1fr)", alignItems: "start" }}>
        <section className="pnl" style={{ padding: 18, position: "sticky", top: 16 }}>
          {sp.add ? (
            <>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}><b>Adicionar bloco</b><Link className="menu-b" href={href("")} aria-label="Fechar"><X size={15} /></Link></div>
              <div className="pal">
                {BLOCKS.map((b) => (
                  <form key={b.type} action={addNode}>
                    <input type="hidden" name="id" value={a.id} /><input type="hidden" name="parent" value={addParent} /><input type="hidden" name="port" value={addPort} /><input type="hidden" name="type" value={b.type} />
                    <button type="submit"><span className={`tile sm ${b.tone}`}>{b.icon}</span>{b.label}</button>
                  </form>
                ))}
              </div>
            </>
          ) : sel && sp.node ? (
            <form action={saveNode} className="stack" style={{ gap: 10 }}>
              <input type="hidden" name="id" value={a.id} /><input type="hidden" name="node" value={sp.node} />
              <div className="row" style={{ justifyContent: "space-between" }}><b>{BLOCKS.find((x) => x.type === sel.type)?.label}</b><Link className="menu-b" href={href("")} aria-label="Fechar"><X size={15} /></Link></div>
              {sel.type === "send" && (() => {
                const count = Math.min(6, Math.max(1, sel.parts.length));
                const n = Math.min(6, count + 1);
                return (
                  <>
                    <input type="hidden" name="n" value={n} />
                    {Array.from({ length: n }, (_, i) => (
                      <div key={i} className="seq-part" style={{ gap: 6 }}>
                        <b style={{ fontSize: 12.5 }}>{i < count ? `Parte ${i + 1}` : "Nova parte (opcional)"}</b>
                        <textarea className="in" name={`text_${i}`} rows={i === 0 ? 5 : 3} defaultValue={sel.parts[i]?.text ?? ""} placeholder="Texto ou link" />
                        <label className="check" style={{ fontSize: 12.5 }}><input type="checkbox" name={`img_${i}`} defaultChecked={!!sel.parts[i]?.productImage} /> Foto do produto</label>
                        <input type="file" name={`file_${i}`} accept="image/*,video/*,application/pdf" style={{ fontSize: 12 }} />
                        {sel.parts[i]?.mediaUrl && <label className="check" style={{ fontSize: 12.5 }}><input type="checkbox" name={`keep_${i}`} value="1" defaultChecked /> manter arquivo atual</label>}
                      </div>
                    ))}
                    <small className="dim">Campos: {VARS.join(" ")}. Em listas, use o nome da coluna da planilha, ex.: {"{link}"}. Os links contam clique sozinhos.</small>
                  </>
                );
              })()}
              {sel.type === "wait" && <div className="row" style={{ gap: 8 }}><input className="in" name="amount" inputMode="numeric" defaultValue={sel.amount} style={{ width: 90 }} /><select className="in" name="unit" defaultValue={sel.unit}>{Object.entries(UNIT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>}
              {sel.type === "waitHour" && <input className="in" type="time" name="hour" defaultValue={sel.hour} />}
              {sel.type === "cond" && (
                <>
                  <select className="in" name="check" defaultValue={sel.check}>{Object.entries(CHECK).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  {lists.length > 0 && <select className="in" name="value_list" defaultValue={sel.check === "lista" ? sel.value ?? "" : ""}><option value="">Lista (só para &quot;Está na lista?&quot;)</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
                  <input className="in" name="value_tag" defaultValue={sel.check === "etiqueta" ? sel.value ?? "" : ""} placeholder="Etiqueta (só para &quot;Tem a etiqueta?&quot;)" />
                  <small className="dim">&quot;Pagou&quot; vira sim quando a pessoa tem um pedido pago depois de receber a mensagem.</small>
                </>
              )}
              {sel.type === "tag" && <><select className="in" name="action" defaultValue={sel.action}><option value="add">Adicionar etiqueta</option><option value="remove">Remover etiqueta</option></select><input className="in" name="tag" defaultValue={sel.tag} placeholder="Ex.: carrinho frio" /></>}
              {sel.type === "list" && <><select className="in" name="action" defaultValue={sel.action}><option value="add">Adicionar à lista</option><option value="remove">Remover da lista</option></select><select className="in" name="listId" defaultValue={sel.listId}><option value="">Escolha a lista</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></>}
              {sel.type === "exit" && <p className="dim" style={{ fontSize: 13 }}>A pessoa sai da automação aqui.</p>}
              <div className="row" style={{ gap: 8 }}>
                {sel.type !== "exit" && <button className="btn pri sm" type="submit">Salvar bloco</button>}
              </div>
            </form>
          ) : (
            <form action={saveAutomation} className="stack" style={{ gap: 10 }}>
              <input type="hidden" name="id" value={a.id} />
              <b>Configurações</b>
              <div className="field"><label>Nome</label><input className="in" name="name" defaultValue={a.name} /></div>
              <div className="field"><label>Gatilho</label><select className="in" name="trigger" defaultValue={a.trigger}>{TRIGGERS.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}</select></div>
              <div className="field"><label>Esperar antes de começar (minutos)</label><input className="in" name="delayMin" inputMode="numeric" defaultValue={cfg.delayMin ?? 0} /></div>
              {a.trigger === "lista" && <div className="field"><label>Qual lista</label><select className="in" name="listId" defaultValue={cfg.listId ?? ""}><option value="">Qualquer lista</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>}
              <div><button className="btn pri sm" type="submit">Salvar</button></div>
              <p className="dim" style={{ fontSize: 12.5 }}>Clique no <b>+</b> entre os blocos para adicionar um passo. Clique num bloco para editar.</p>
              <div style={{ borderTop: "1px solid var(--line2)", paddingTop: 10 }}>
                <b style={{ fontSize: 13 }}>Últimas pessoas</b>
                {recent.length ? recent.map((r) => <div key={r.id} className="row" style={{ justifyContent: "space-between", fontSize: 12.5, padding: "5px 0" }}><span>{r.name || r.phone}</span><span className={`chip ${r.convertedAt ? "c-l" : r.status === "erro" ? "c-c" : r.status === "ativo" ? "c-k" : "c-n"}`}>{r.convertedAt ? "converteu" : r.status === "ativo" ? "no meio" : r.status === "erro" ? "erro" : "terminou"}</span></div>) : <div className="dim" style={{ fontSize: 12.5, marginTop: 6 }}>Ninguém ainda.</div>}
              </div>
            </form>
          )}
          {sel && sp.node && (
            <form action={deleteNode} style={{ marginTop: 10 }}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="node" value={sp.node} /><ConfirmButton className="btn sm ghost danger" message="Apagar este bloco?"><Trash2 size={14} /> Apagar bloco</ConfirmButton></form>
          )}
        </section>

        <section className="pnl" style={{ padding: "22px 18px 30px", overflowX: "auto" }}>
          <div className="fl">
            <div className="fl-n" style={{ borderColor: "rgba(96,165,250,.4)" }}>
              <div className="h"><span className="tile sm t-k"><Zap size={15} /></span>{triggerLabel(a.trigger)}</div>
              <div className="d">{TRIGGERS.find((t) => t.k === a.trigger)?.desc}{cfg.delayMin ? `. Começa ${cfg.delayMin} min depois.` : ""}</div>
            </div>
            {render(flow.start, "start", "start")}
          </div>
        </section>
      </div>
      <form action={deleteAutomation} style={{ alignSelf: "flex-start" }}><input type="hidden" name="id" value={a.id} /><ConfirmButton className="btn sm ghost danger" message={`Apagar a automação "${a.name}"?`}><Trash2 size={14} /> Apagar automação</ConfirmButton></form>
    </>
  );
}
