import { ExternalLink } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { shipments, type Shipment } from "@/lib/store";
import { ErrorNote, Header, Kpi, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const days = (a: string, b?: string | null) => Math.max(0, Math.round(((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 864e5));

export default async function Entregas({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "transito" } = await searchParams;
  const s = await getSettings();
  let list: Shipment[] = [];
  let error: unknown = null;
  try {
    list = await shipments(30);
  } catch (e) {
    error = e;
  }
  const delivered = list.filter((x) => x.deliveredAt);
  const transit = list.filter((x) => !x.deliveredAt);
  const late = transit.filter((x) => days(x.shippedAt) > s.recovery.delayedDays);
  const avg = delivered.length ? delivered.reduce((a, x) => a + days(x.shippedAt, x.deliveredAt), 0) / delivered.length : 0;
  const byCompany = new Map<string, { n: number; d: number }>();
  for (const x of delivered) {
    const k = x.company ?? "Outra";
    const cur = byCompany.get(k) ?? { n: 0, d: 0 };
    cur.n++; cur.d += days(x.shippedAt, x.deliveredAt);
    byCompany.set(k, cur);
  }
  const view = f === "atrasados" ? late : f === "entregues" ? delivered : f === "todos" ? list : transit;
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

  return (
    <>
      <Header title="Entregas" lede={`Envios dos últimos 30 dias pelo rastreio da Olist. Atrasado = mais de ${s.recovery.delayedDays} dias sem entregar (muda em Recuperação).`} />
      {error ? <ErrorNote error={error} /> : null}
      <div className="grid g4">
        <Kpi label="Em trânsito" value={transit.length} />
        <Kpi label="Atrasados" value={<span className={late.length ? "dn" : ""}>{late.length}</span>} />
        <Kpi label="Entregues" value={delivered.length} />
        <Kpi label="Prazo médio" value={avg ? `${avg.toFixed(1).replace(".", ",")} dias` : "–"} sub="do envio até a entrega" />
      </div>
      <div className="tabs">
        {[["transito", "Em trânsito"], ["atrasados", "Atrasados"], ["entregues", "Entregues"], ["todos", "Todos"]].map(([k, l]) => (
          <a key={k} href={`/entregas?f=${k}`} className={f === k ? "on" : ""}>{l}</a>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(240px,1fr)", alignItems: "start" }}>
        <Panel title="Envios" body={false}>
          {view.length ? (
            <table className="tb">
              <thead><tr><th>Pedido</th><th>Destino</th><th>Enviado</th><th>Situação</th><th>Rastreio</th></tr></thead>
              <tbody>
                {view.map((x) => {
                  const d = days(x.shippedAt, x.deliveredAt);
                  const isLate = !x.deliveredAt && d > s.recovery.delayedDays;
                  return (
                    <tr key={x.order}>
                      <td><b style={{ fontWeight: 550 }}>{x.order}</b><div className="dim" style={{ fontSize: 12 }}>{x.customer}</div></td>
                      <td className="mut">{[x.city, x.state].filter(Boolean).join(" / ")}</td>
                      <td className="mut">{fmt.format(new Date(x.shippedAt))}</td>
                      <td>
                        {x.deliveredAt ? <span className="chip c-l">entregue em {d} dias</span> : <span className={`chip ${isLate ? "c-c" : "c-k"}`}>{isLate ? "atrasado, " : ""}{d} dias</span>}
                      </td>
                      <td>
                        {x.url ? (
                          <a className="dim" style={{ fontSize: 12, display: "inline-flex", gap: 4, alignItems: "center" }} href={x.url} target="_blank" rel="noreferrer">{x.number} <ExternalLink size={11} /></a>
                        ) : <span className="dim" style={{ fontSize: 12 }}>{x.number ?? "–"}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            !error && <div className="empty">Nada por aqui.</div>
          )}
        </Panel>
        <Panel title="Por transportadora" body={false}>
          <table className="tb">
            <tbody>
              {[...byCompany.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => (
                <tr key={k}><td style={{ fontSize: 13 }}>{k.replace("Olist Envios ", "")}</td><td className="r mut" style={{ fontSize: 13 }}>{(v.d / v.n).toFixed(1).replace(".", ",")} dias</td></tr>
              ))}
              {!byCompany.size && <tr><td className="dim">Sem entregas concluídas.</td></tr>}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
