import Link from "next/link";
import { BarChart3, Check, Library, Plus, Sparkles, X, Zap } from "lucide-react";
import { FLOW_TEMPLATES, TEMPLATE_CATS } from "@/lib/flowTemplates";
import { addSuggestions, applyFlowTemplate } from "../acoes11";
import { db } from "@/lib/db";
import { brl } from "@/lib/time";
import { Header, Panel } from "@/components/ui";
import { TRIGGERS, triggerLabel, type Flow } from "@/lib/automations";
import { createAutomation, toggleAutomation } from "../acoes10";

export const dynamic = "force-dynamic";

export default async function Automacoes({ searchParams }: { searchParams: Promise<{ novo?: string; cat?: string; adicionadas?: string }> }) {
  const sp = await searchParams;
  const list = await db.automation.findMany({ orderBy: { createdAt: "asc" } });
  const stats = await db.automationRun.groupBy({ by: ["automationId"], _count: true, _sum: { sent: true, value: true } });
  const clicks = await db.automationRun.groupBy({ by: ["automationId"], where: { clicks: { gt: 0 } }, _count: true });
  const st = new Map(stats.map((x) => [x.automationId, x]));
  const ck = new Map(clicks.map((x) => [x.automationId, x._count]));
  const groups = [...new Set(TRIGGERS.map((t) => t.group))];
  return (
    <>
      <Header title="Automações" lede="Mensagens no WhatsApp por gatilho, com sequência, espera e condição. Tudo começa desligado.">
        <Link className="btn" href="/mensagens"><Library size={15} /> Biblioteca de mensagens</Link>
        <Link className="btn" href="/modelos#manuais">Mensagens manuais</Link>
        <Link className="btn pri" href="/automacoes?novo=1"><Plus size={16} /> Criar automação</Link>
      </Header>
      {sp.adicionadas && <div className="ok">{sp.adicionadas} automações adicionadas, todas desligadas. Abra cada uma, confira as mensagens e ligue quando quiser.</div>}
      {sp.novo && (
        <Panel title="Criar automação" sub="Comece de um modelo pronto (já vem com as mensagens) ou do zero escolhendo o gatilho" right={<Link className="menu-b" href="/automacoes" aria-label="Fechar"><X size={16} /></Link>}>
          <div className="ag-wrap">
            <nav className="ag-cats">
              <Link className={!sp.cat ? "on" : ""} href="/automacoes?novo=1">Todos <small>{FLOW_TEMPLATES.length}</small></Link>
              {TEMPLATE_CATS.map((c) => <Link key={c} className={sp.cat === c ? "on" : ""} href={`/automacoes?novo=1&cat=${encodeURIComponent(c)}`}>{c} <small>{FLOW_TEMPLATES.filter((t) => t.cat === c).length}</small></Link>)}
              <Link className={sp.cat === "zero" ? "on" : ""} href="/automacoes?novo=1&cat=zero">Do zero</Link>
            </nav>
            <div style={{ flex: 1, minWidth: 0 }}>
              {sp.cat === "zero" ? groups.map((g) => (
                <div key={g} style={{ marginBottom: 14 }}>
                  <div className="dim" style={{ fontSize: 11.5, letterSpacing: ".08em", textTransform: "uppercase", margin: "4px 0 8px" }}>{g}</div>
                  <div className="trg-grid">
                    {TRIGGERS.filter((t) => t.group === g).map((t) => (
                      <form key={t.k} action={createAutomation}><input type="hidden" name="trigger" value={t.k} />
                        <button className="trg" type="submit"><span className="tile sm t-k"><Zap size={15} /></span><span><b>{t.label}</b><small>{t.desc}</small></span></button>
                      </form>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="ag-grid">
                  {FLOW_TEMPLATES.filter((t) => !sp.cat || t.cat === sp.cat).map((t) => (
                    <form key={t.key} action={applyFlowTemplate}>
                      <input type="hidden" name="key" value={t.key} />
                      <button type="submit" className="ag-card">
                        <span className="ag-top"><span className="chip c-k">{t.cat}</span><small>{triggerLabel(t.trigger)}</small></span>
                        <b>{t.name}</b>
                        <span className="ag-desc">{t.desc}</span>
                        <span className="ag-bubbles">{t.msgs.slice(0, 2).map((m) => <i key={m.key}>{(m.parts[0]?.text ?? "").split("\n")[0].replace(/\{(\w+)\}/g, (_x, k) => (k === "nome" ? "Leonardo" : k === "pedido" ? "#4388" : "…"))}</i>)}</span>
                        <span className="ag-foot">{t.msgs.length} mensage{t.msgs.length === 1 ? "m" : "ns"} · {Object.keys(t.nodes).length} blocos <em>Usar modelo</em></span>
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}
      {!sp.novo && (
        <details className="qs" open={!list.length}>
          <summary><span className="tile sm t-s"><Sparkles size={15} /></span><span><b>Comece rápido</b><small>Marque as sugestões e adicione de uma vez. Você edita e liga depois.</small></span></summary>
          <form action={addSuggestions}>
            <div className="qs-grid">
              {FLOW_TEMPLATES.map((t) => {
                const has = list.some((a) => a.trigger === t.trigger);
                return (
                  <label key={t.key} className={`qs-card${has ? " has" : ""}`}>
                    <input type="checkbox" name="key" value={t.key} />
                    <span className="qs-check"><Check size={12} /></span>
                    <b>{t.name}</b>
                    <small>{t.desc}</small>
                    {has && <em>Você já tem uma com esse gatilho</em>}
                  </label>
                );
              })}
            </div>
            <button className="btn pri sm" type="submit" style={{ marginTop: 12 }}>Adicionar sugestões marcadas</button>
          </form>
        </details>
      )}
      {list.length ? (
        <div className="auto-grid">
          {list.map((a) => {
            const s = st.get(a.id);
            const sent = s?._sum.sent ?? 0;
            const steps = Object.values(((a.flow ?? {}) as Flow).nodes ?? {}).filter((n) => n.type === "send").length;
            return (
              <div key={a.id} className="auto-c">
                <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                  <Link href={`/automacoes/${a.id}`} style={{ fontWeight: 600, fontSize: 14.5 }}>{a.name}</Link>
                  <form action={toggleAutomation}><input type="hidden" name="id" value={a.id} /><button type="submit" className={`sw2${a.active ? " on" : ""}`} aria-label={a.active ? "Desligar" : "Ligar"} /></form>
                </div>
                <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>{triggerLabel(a.trigger)} · {steps} mensage{steps === 1 ? "m" : "ns"}</div>
                <Link href={`/automacoes/${a.id}`} className="auto-st">
                  <div><b>{sent.toLocaleString("pt-BR")}</b><span>envios</span></div>
                  <div><b>{s?._count ? `${Math.round(((ck.get(a.id) ?? 0) / s._count) * 100)}%` : "0%"}</b><span>clique</span></div>
                  <div><b style={s?._sum.value ? { color: "var(--lagoon)" } : undefined}>{brl(s?._sum.value ?? 0, 0)}</b><span>conversão</span></div>
                </Link>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className={`chip ${a.active ? "c-l" : "c-n"}`}>{a.active ? "Ativada" : "Desativada"}</span>
                  <Link className="dim" href={`/automacoes/${a.id}/relatorio`} style={{ fontSize: 12, display: "inline-flex", gap: 4, alignItems: "center" }}><BarChart3 size={13} /> Relatório</Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : !sp.novo && <div className="empty-art"><Zap size={26} className="dim" /><div>Nenhuma automação ainda. Clique em Criar automação e escolha o gatilho.</div></div>}
    </>
  );
}
