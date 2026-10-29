import { Rocket } from "lucide-react";
import { db } from "@/lib/db";
import { ordersBetween } from "@/lib/store";
import { brl } from "@/lib/time";
import { Header, Kpi, Panel } from "@/components/ui";
import { createLaunch } from "../acoes3";

export const dynamic = "force-dynamic";

const STEPS: [string, string, string][] = [
  ["warm7", "7 dias antes", "Pessoal, daqui a 7 dias chega o {drop}. Só quem está aqui no grupo vai ver primeiro."],
  ["warm3", "3 dias antes", "Faltam 3 dias para o {drop}. Já escolheu o seu tamanho?"],
  ["warm1", "1 dia antes", "Amanhã abre o {drop}. Ativa as notificações do grupo para não perder."],
  ["h1", "1 hora antes", "Em 1 hora o {drop} abre aqui primeiro. Fica de olho!"],
  ["open", "Na abertura", "ABRIU! O {drop} está liberado para o grupo: https://rastahale.com.br"],
  ["last", "1 dia depois", "Últimas peças do {drop} em alguns tamanhos. Corre que está acabando."],
];

export default async function Lancamento({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const [launches, groups] = await Promise.all([
    db.launch.findMany({ orderBy: { opensAt: "desc" }, take: 10 }),
    db.group.findMany({ where: { archived: false, isCommunity: true }, orderBy: { name: "asc" } }),
  ]);
  const msgs = await db.scheduledMessage.findMany({ where: { launchId: { in: launches.map((l) => l.id) } }, orderBy: { sendAt: "asc" } });
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const salesOf = async (l: (typeof launches)[number]) => {
    if (l.opensAt > new Date()) return null;
    try {
      const end = l.closesAt ?? new Date();
      const orders = await ordersBetween(l.opensAt, end);
      let n = 0, v = 0;
      for (const o of orders) {
        if (o.cancelled) continue;
        for (const li of o.lines) {
          if (!l.productKey || li.title.toLowerCase().includes(l.productKey)) { n += li.quantity; v += li.revenue; }
        }
      }
      return { n, v, orders: orders.length };
    } catch {
      return null;
    }
  };
  const sales = await Promise.all(launches.map(salesOf));

  return (
    <>
      <Header title="Lançamento" lede="Monte o drop uma vez: o sistema agenda o aquecimento nos grupos (7 dias, 3 dias, 1 dia, 1 hora, abertura e últimas peças) e mostra as vendas desde a abertura." />
      {sp.ok && <div className="ok">Lançamento criado e mensagens agendadas. Elas aparecem também em Agendamentos.</div>}
      {sp.erro && <div className="err">Preencha nome, data de abertura e escolha os grupos.</div>}
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Novo lançamento">
          <form action={createLaunch} className="stack">
            <div className="row">
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Nome do drop</label><input className="in" name="name" required placeholder="Collab Pura" /></div>
              <div className="field" style={{ width: 210 }}><label>Abre em</label><input className="in" type="datetime-local" name="opensAt" required /></div>
            </div>
            <div className="field"><label>Palavra do produto (para contar as vendas)</label><input className="in" name="productKey" placeholder="pura" /></div>
            <div className="field">
              <label>Grupos</label>
              <div className="stack" style={{ gap: 8, maxHeight: 140, overflowY: "auto" }}>
                {groups.map((g) => <label key={g.id} className="check"><input type="checkbox" name="groups" value={g.jid} defaultChecked /> {g.name}</label>)}
                {!groups.length && <span className="dim">Marque os grupos da comunidade na página Grupos.</span>}
              </div>
            </div>
            {STEPS.map(([k, label, text]) => (
              <div className="field" key={k}>
                <label>{label}</label>
                <textarea className="in" name={`msg_${k}`} defaultValue={text} style={{ minHeight: 60 }} />
              </div>
            ))}
            <span className="hint">{"{drop}"} vira o nome do drop. Deixe uma mensagem vazia para pular. Todas marcam todos do grupo.</span>
            <div><button className="btn pri" type="submit"><Rocket size={15} /> Criar lançamento</button></div>
          </form>
        </Panel>
        <div className="stack">
          {launches.length ? launches.map((l, i) => {
            const s = sales[i];
            const lm = msgs.filter((m) => m.launchId === l.id);
            return (
              <Panel key={l.id} title={l.name} sub={`Abre ${fmt.format(l.opensAt)}`}>
                {s && (
                  <div className="grid g3" style={{ marginBottom: 12 }}>
                    <Kpi label="Peças vendidas" value={s.n} />
                    <Kpi label="Faturamento do drop" value={brl(s.v, 0)} />
                  </div>
                )}
                <table className="tb"><tbody>
                  {lm.map((m) => (
                    <tr key={m.id}>
                      <td className="mut" style={{ width: 150, fontSize: 12.5 }}>{fmt.format(m.sendAt)}</td>
                      <td style={{ fontSize: 13 }}>{m.text.slice(0, 90)}{m.text.length > 90 ? "…" : ""}</td>
                      <td><span className={`chip ${m.status === "SENT" ? "c-l" : m.status === "FAILED" ? "c-c" : "c-k"}`}>{m.status === "SENT" ? "enviada" : m.status === "FAILED" ? "falhou" : m.status === "CANCELED" ? "cancelada" : "agendada"}</span></td>
                    </tr>
                  ))}
                </tbody></table>
              </Panel>
            );
          }) : <Panel title="Lançamentos"><div className="empty">Nenhum lançamento ainda.</div></Panel>}
        </div>
      </div>
    </>
  );
}
