import Link from "next/link";
import { Check, CreditCard, History, Instagram, ListChecks, Megaphone, Package, RefreshCw, Ruler, Smartphone, Sparkles, Users, X } from "lucide-react";
import { db } from "@/lib/db";
import { creds } from "@/lib/integrations";
import { parseDiagnosis } from "@/lib/diagnosis";
import { Header, Panel } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { diagnosisToTasks, generateDiagnosis } from "../acoes3";

export const dynamic = "force-dynamic";

const AREA = { checkout: [CreditCard, "t-c"], celular: [Smartphone, "t-s"], anuncios: [Megaphone, "t-k"], instagram: [Instagram, "t-p"], estoque: [Ruler, "t-n"], comunidade: [Users, "t-l"], produto: [Package, "t-s"], outro: [Sparkles, "t-n"] } as const;
const PRIO = { alta: ["Alta", "c-c"], media: ["Média", "c-s"], baixa: ["Baixa", "c-n"] } as const;
const SRC: Record<string, string> = { Shopify: "c-l", "Meta Ads": "c-k", Comunidade: "c-n" };

function Gauge({ score }: { score: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const color = score >= 70 ? "#34c26a" : score >= 45 ? "#f7c928" : "#ef4444";
  return (
    <div style={{ position: "relative", width: 130, height: 130 }}>
      <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="#1f2523" strokeWidth="11" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} style={{ filter: `drop-shadow(0 0 8px ${color}66)` }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", font: "650 40px Geist, system-ui", letterSpacing: "-.03em" }}>{score}</span>
    </div>
  );
}
const bold = (t: string) => t.split(/\*\*(.+?)\*\*/g).map((x, i) => (i % 2 ? <b key={i} style={{ color: "#fff" }}>{x}</b> : x));

export default async function Diagnostico({ searchParams }: { searchParams: Promise<{ erro?: string; id?: string; hist?: string; tarefas?: string }> }) {
  const sp = await searchParams;
  const [c, list] = await Promise.all([creds(), db.diagnosis.findMany({ orderBy: { createdAt: "desc" }, take: 20 })]);
  const current = list.find((d) => d.id === sp.id) ?? list[0];
  const prev = current ? list[list.indexOf(current) + 1] : undefined;
  const data = current ? parseDiagnosis(current.content) : null;
  const prevData = prev ? parseDiagnosis(prev.content) : null;
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Header title="Diagnóstico do e-commerce" lede={current ? `Análise feita pela IA em ${fmt.format(current.createdAt)}, com os dados da Shopify, dos anúncios e da comunidade.` : "A IA olha vendas, anúncios, conversão, estoque, recuperação e comunidade dos últimos 30 dias e diz o que fazer primeiro."}>
        <Link className="btn" href={sp.hist ? "/diagnostico" : "/diagnostico?hist=1"}><History size={15} /> Análises anteriores</Link>
        <form action={generateDiagnosis}>
          <button className="btn pri" type="submit" disabled={!c.ai.key}><RefreshCw size={15} /> Atualizar agora</button>
        </form>
      </Header>
      {!c.ai.key && <div className="note">Conecte a IA em <Link href="/integracoes" style={{ textDecoration: "underline" }}>Integrações</Link> para gerar o diagnóstico. Leva uns 30 segundos.</div>}
      {sp.erro && <div className="err">{sp.erro}</div>}
      {sp.tarefas && <div className="ok">{sp.tarefas} tarefas criadas. <Link href="/tarefas" style={{ textDecoration: "underline" }}>Ver tarefas</Link></div>}

      {sp.hist && (
        <Panel title="Análises anteriores" right={<Link className="menu-b" href="/diagnostico"><X size={16} /></Link>}>
          <div className="row" style={{ gap: 8 }}>
            {list.map((d) => {
              const p = parseDiagnosis(d.content);
              return <Link key={d.id} href={`/diagnostico?id=${d.id}`} className={`chip ${d.id === current?.id ? "c-l" : "c-n"}`} style={{ padding: "6px 10px" }}>{fmt.format(d.createdAt)}{p ? ` · ${p.score}` : ""}</Link>;
            })}
          </div>
        </Panel>
      )}

      {data ? (
        <>
          <div className="cols" style={{ gridTemplateColumns: "300px minmax(0, 1fr)" }}>
            <section className="pnl" style={{ padding: 22, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8 }}>
              <Gauge score={data.score} />
              <b style={{ fontSize: 15 }}>Saúde da loja</b>
              <span className="mut" style={{ fontSize: 13, lineHeight: 1.45 }}>{prevData ? `${data.score >= prevData.score ? "Subiu" : "Caiu"} ${Math.abs(data.score - prevData.score)} pontos desde a análise anterior. ` : ""}{data.scoreNote}</span>
            </section>
            <section className="pnl" style={{ padding: 22 }}>
              <b style={{ fontSize: 15 }}>Resumo</b>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink)", margin: "10px 0 14px" }}>{bold(data.summary)}</p>
              <div className="row" style={{ gap: 6 }}>{(data.sources ?? []).map((s) => <span key={s} className={`chip ${SRC[s] ?? "c-n"}`}>{s}</span>)}</div>
              {data.good?.length > 0 && (
                <div className="stack" style={{ gap: 6, marginTop: 16 }}>
                  {data.good.map((g, i) => <div key={i} className="row" style={{ gap: 8, flexWrap: "nowrap", fontSize: 13.5 }}><Check size={15} className="up" style={{ flexShrink: 0 }} /> {g}</div>)}
                </div>
              )}
            </section>
          </div>
          <div className="cols c-1-1">
            {data.items.map((it, i) => {
              const [Icon, tone] = AREA[it.area] ?? AREA.outro;
              const [pl, pc] = PRIO[it.priority] ?? PRIO.media;
              return (
                <section key={i} className="pnl dg">
                  <div className="row" style={{ gap: 12, flexWrap: "nowrap", alignItems: "flex-start" }}>
                    <span className={`tile ${tone}`}><Icon size={18} /></span>
                    <div style={{ flex: 1 }}>
                      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "flex-start", gap: 10 }}>
                        <b style={{ fontSize: 15.5, lineHeight: 1.35 }}>{it.title}</b>
                        <span className={`chip ${pc}`}>{pl}</span>
                      </div>
                      <p className="mut" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{it.detail}</p>
                    </div>
                  </div>
                  <ul className="dg-a">{it.actions.map((a, j) => <li key={j}><Check size={14} /> {a}</li>)}</ul>
                  <form action={diagnosisToTasks} className="dg-f">
                    <input type="hidden" name="title" value={it.title} />
                    <input type="hidden" name="priority" value={it.priority} />
                    <input type="hidden" name="id" value={current!.id} />
                    {it.actions.map((a, j) => <input key={j} type="hidden" name="action" value={a} />)}
                    <span className="mut" style={{ fontSize: 13 }}>Potencial estimado <b className="up" style={{ fontSize: 15, marginLeft: 6 }}>{it.potential}</b></span>
                    <button className="btn sm ghost" type="submit" style={{ color: "var(--lagoon)" }}><ListChecks size={14} /> Criar tarefas</button>
                  </form>
                </section>
              );
            })}
          </div>
        </>
      ) : current ? (
        <Panel title={`Diagnóstico de ${fmt.format(current.createdAt)}`}><Markdown text={current.content} /></Panel>
      ) : (
        <section className="pnl empty-art" style={{ padding: 60 }}>
          <Sparkles size={30} className="dim" />
          <b>Nenhum diagnóstico ainda</b>
          <div className="dim">Clique em Atualizar agora. A IA lê os números dos últimos 30 dias e monta o plano.</div>
        </section>
      )}
    </>
  );
}
