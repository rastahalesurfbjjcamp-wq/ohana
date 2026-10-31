import Link from "next/link";
import { Plus, X, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { brl } from "@/lib/time";
import { Header, Panel } from "@/components/ui";
import { TRIGGERS, triggerLabel, type Flow } from "@/lib/automations";
import { createAutomation, toggleAutomation } from "../acoes10";

export const dynamic = "force-dynamic";

export default async function Automacoes({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
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
        <Link className="btn" href="/modelos#manuais">Mensagens manuais</Link>
        <Link className="btn pri" href="/automacoes?novo=1"><Plus size={16} /> Criar automação</Link>
      </Header>
      {sp.novo && (
        <Panel title="Escolha o gatilho da automação" sub="O que coloca a pessoa nesta automação" right={<Link className="menu-b" href="/automacoes" aria-label="Fechar"><X size={16} /></Link>}>
          {groups.map((g) => (
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
          ))}
        </Panel>
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
                <span className={`chip ${a.active ? "c-l" : "c-n"}`}>{a.active ? "Ativada" : "Desativada"}</span>
              </div>
            );
          })}
        </div>
      ) : !sp.novo && <div className="empty-art"><Zap size={26} className="dim" /><div>Nenhuma automação ainda. Clique em Criar automação e escolha o gatilho.</div></div>}
    </>
  );
}
