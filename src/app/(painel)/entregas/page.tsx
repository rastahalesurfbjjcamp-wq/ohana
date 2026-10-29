import Link from "next/link";
import { AlertTriangle, Check, Download, ExternalLink, Hourglass, MapPin, PackageCheck, Truck, Undo2 } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { recentOrders, shipments, type Order, type Shipment } from "@/lib/store";
import { ErrorNote, Header, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const days = (a: string, b?: string | null) => Math.max(0, ((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 864e5);
const REGION: Record<string, string> = {
  SP: "Sudeste", RJ: "Sudeste", MG: "Sudeste", ES: "Sudeste", PR: "Sul", SC: "Sul", RS: "Sul", DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  BA: "Nordeste", PE: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste", RN: "Nordeste", AL: "Nordeste", SE: "Nordeste", PI: "Nordeste",
  AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", AC: "Norte", AP: "Norte", TO: "Norte",
};
const STATUS: Record<string, [string, string]> = {
  FULFILLED: ["Postado", "c-k"], CONFIRMED: ["Postado", "c-k"], IN_TRANSIT: ["Em trânsito", "c-k"], OUT_FOR_DELIVERY: ["Saiu p/ entrega", "c-l"], DELIVERED: ["Entregue", "c-l"],
  ATTEMPTED_DELIVERY: ["Tentativa de entrega", "c-s"], READY_FOR_PICKUP: ["Retirar na agência", "c-s"], FAILURE: ["Problema", "c-c"], NOT_DELIVERED: ["Não entregue", "c-c"], CANCELED: ["Cancelado", "c-n"],
};
const EVENT: Record<string, string> = { IN_TRANSIT: "Objeto em trânsito", OUT_FOR_DELIVERY: "Saiu para entrega ao destinatário", DELIVERED: "Entregue ao destinatário", ATTEMPTED_DELIVERY: "Tentativa de entrega sem sucesso", READY_FOR_PICKUP: "Aguardando retirada", CONFIRMED: "Postado", FAILURE: "Falha na entrega", LABEL_PRINTED: "Etiqueta impressa" };
function ago(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return `há ${Math.max(1, m)} min`;
  if (m < 1440) return `há ${Math.round(m / 60)} h`;
  const d = Math.round(m / 1440);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export default async function Entregas({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const sp = await searchParams;
  const f = sp.f ?? "todas";
  const s = await getSettings();
  let list: Shipment[] = [];
  let waiting: Order[] = [];
  let error: unknown = null;
  try {
    [list, waiting] = await Promise.all([shipments(30), recentOrders(100, "fulfillment_status:unfulfilled financial_status:paid -status:cancelled")]);
  } catch (e) {
    error = e;
  }
  const notified = new Set((await db.recoveryCase.findMany({ where: { kind: { in: ["rastreio", "entregue"] }, sentCount: { gt: 0 }, orderName: { in: list.map((x) => x.order) } }, select: { orderName: true } })).map((c) => c.orderName));
  const status = (x: Shipment) => (x.deliveredAt ? "DELIVERED" : x.lastEvent?.status ?? x.status);
  const isLate = (x: Shipment) => !x.deliveredAt && days(x.shippedAt) > s.recovery.delayedDays;
  const isProblem = (x: Shipment) => ["FAILURE", "NOT_DELIVERED", "ATTEMPTED_DELIVERY"].includes(status(x));
  const delivered = list.filter((x) => x.deliveredAt);
  const transit = list.filter((x) => !x.deliveredAt && !["OUT_FOR_DELIVERY"].includes(status(x)));
  const out = list.filter((x) => status(x) === "OUT_FOR_DELIVERY");
  const alert = list.filter((x) => isLate(x) || isProblem(x));
  const returned = list.filter((x) => ["NOT_DELIVERED", "CANCELED"].includes(status(x)));
  const avgTransit = transit.length ? transit.reduce((a, x) => a + days(x.shippedAt), 0) / transit.length : 0;
  const avgDelivered = delivered.length ? delivered.reduce((a, x) => a + days(x.orderedAt, x.deliveredAt), 0) / delivered.length : 0;
  const oldestWaiting = waiting.length ? Math.max(...waiting.map((o) => days(o.createdAt))) : 0;

  const buckets: [string, number, number][] = [["até 3", 0, 3.5], ["4 a 5", 3.5, 5.5], ["6 a 7", 5.5, 7.5], ["8 a 10", 7.5, 10.5], ["11 a 14", 10.5, 14.5], ["15+", 14.5, 999]];
  const hist = buckets.map(([l, a, b]) => ({ label: l, value: delivered.filter((x) => { const d = days(x.orderedAt, x.deliveredAt); return d >= a && d < b; }).length }));
  const histMax = Math.max(1, ...hist.map((h) => h.value));
  const byRegion = new Map<string, number[]>();
  for (const x of delivered) { const r = REGION[x.state ?? ""] ?? "Outros"; byRegion.set(r, [...(byRegion.get(r) ?? []), days(x.orderedAt, x.deliveredAt)]); }
  const regions = [...byRegion.entries()].filter(([, v]) => v.length >= 2).map(([r, v]) => [r, v.reduce((a, b) => a + b, 0) / v.length] as [string, number]).sort((a, b) => a[1] - b[1]);
  const byCompany = new Map<string, number[]>();
  for (const x of delivered) { const k = (x.company ?? "Outra").replace("Olist Envios ", ""); byCompany.set(k, [...(byCompany.get(k) ?? []), days(x.shippedAt, x.deliveredAt)]); }
  const n1 = (v: number) => v.toFixed(1).replace(".", ",");

  const view = (f === "transito" ? [...transit, ...out] : f === "alerta" ? alert : f === "entregues" ? delivered : list).sort((a, b) => Number(isLate(b) || isProblem(b)) - Number(isLate(a) || isProblem(a)) || Date.parse(b.shippedAt) - Date.parse(a.shippedAt));
  const kpis = [
    { k: "Aguardando postagem", v: waiting.length, sub: waiting.length ? `mais antigo há ${Math.round(oldestWaiting)} dia(s)` : "nada parado", icon: Hourglass },
    { k: "Em trânsito", v: transit.length, sub: transit.length ? `média ${n1(avgTransit)} dias` : "–", icon: Truck },
    { k: "Saiu para entrega", v: out.length, sub: "hoje", icon: MapPin },
    { k: "Entregues", v: delivered.length, sub: delivered.length ? `30 dias · ${n1(avgDelivered)} dias em média` : "30 dias", icon: PackageCheck, hl: true },
    { k: "Em alerta", v: alert.length, sub: "atrasado ou falha na entrega", icon: AlertTriangle, warn: alert.length > 0 },
    { k: "Devolvidos", v: returned.length, sub: "30 dias", icon: Undo2 },
  ];

  return (
    <>
      <Header title="Logística" lede={`Rastreio dos envios dos últimos 30 dias. Em alerta: mais de ${s.recovery.delayedDays} dias sem entregar ou falha na entrega.`}>
        <a className="btn" href="/api/export/pedidos?dias=30"><Download size={16} /> Exportar</a>
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      <div className="kstrip">
        {kpis.map((x) => (
          <div key={x.k} className={`ks${x.hl ? " hl" : ""}${x.warn ? " warn" : ""}`}>
            <small><x.icon size={14} /> {x.k}</small>
            <b>{x.v}</b>
            <span>{x.sub}</span>
          </div>
        ))}
      </div>
      <div className="cols c-2-1" style={{ alignItems: "start" }}>
        <Panel title="Encomendas" body={false}
          right={<div className="chips">{[["todas", "Todas"], ["transito", "Em trânsito"], ["alerta", "Em alerta"], ["entregues", "Entregues"]].map(([k, l]) => <Link key={k} href={`/entregas${k === "todas" ? "" : `?f=${k}`}`} className={f === k ? "on" : ""}>{l}</Link>)}</div>}>
          {view.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="tb">
                <thead><tr><th>Pedido</th><th>Cliente</th><th>Rastreio</th><th>Status</th><th>Última atualização</th><th>Avisado</th></tr></thead>
                <tbody>
                  {view.slice(0, 200).map((x) => {
                    const st = status(x);
                    const late = isLate(x);
                    const [lbl, tone] = late && !isProblem(x) ? ["Atrasado", "c-s"] : STATUS[st] ?? [st.toLowerCase(), "c-n"];
                    const upd = x.deliveredAt ? `Entregue ao destinatário · ${ago(x.deliveredAt)}` : x.lastEvent ? `${x.lastEvent.message || EVENT[x.lastEvent.status] || x.lastEvent.status} · ${ago(x.lastEvent.at)}` : late ? `Sem movimentação há ${Math.round(days(x.shippedAt))} dias` : `Postado · ${ago(x.shippedAt)}`;
                    return (
                      <tr key={x.order} className={late || isProblem(x) ? "warn" : ""}>
                        <td><b style={{ fontWeight: 650 }}>{x.order}</b></td>
                        <td><b style={{ fontWeight: 600 }}>{x.customer}</b><div className="dim" style={{ fontSize: 12 }}>{[x.city, x.state].filter(Boolean).join(", ")}</div></td>
                        <td>{x.number ? (x.url ? <a className="trk" href={x.url} target="_blank" rel="noreferrer">{x.number} <ExternalLink size={11} /></a> : <span className="trk">{x.number}</span>) : "–"}</td>
                        <td><span className={`chip ${tone}`}>{lbl}</span></td>
                        <td className="mut" style={{ fontSize: 12.5, maxWidth: 240 }}>{upd}</td>
                        <td>
                          {late || isProblem(x) ? (x.url ? <a className="chip c-s" href={x.url} target="_blank" rel="noreferrer">Ver com transportadora</a> : <span className="chip c-s">Ver com transportadora</span>)
                            : notified.has(x.order) ? <span className="chip c-l"><Check size={11} /> WhatsApp</span> : <span className="dim" style={{ fontSize: 12 }}>{s.recovery.trackingEnabled ? "na fila" : "aviso desligado"}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : !error && <div className="empty">Nada por aqui.</div>}
        </Panel>
        <div className="stack">
          <Panel title="Prazo de entrega" sub="Dias entre o pedido e a entrega">
            <div className="hist">
              {hist.map((h, i) => (
                <div key={h.label} title={`${h.value} pedido(s)`}>
                  <span className="hv">{h.value || ""}</span>
                  <i style={{ height: `${Math.max(3, (h.value / histMax) * 100)}%`, background: i >= 5 ? "var(--coral)" : i === 4 ? "var(--sun)" : i === 0 || i === 3 ? "#249a54" : "var(--lagoon)" }} />
                  <small>{h.label}</small>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              {regions.length > 0 && <div className="kv"><span className="mut">Mais rápido</span><b>{regions[0][0]} · {n1(regions[0][1])} dias</b></div>}
              {regions.length > 1 && <div className="kv"><span className="mut">Mais lento</span><b style={{ color: "var(--sun)" }}>{regions[regions.length - 1][0]} · {n1(regions[regions.length - 1][1])} dias</b></div>}
              {[...byCompany.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3).map(([k, v]) => (
                <div className="kv" key={k}><span className="mut">{k}</span><b>{n1(v.reduce((a, b) => a + b, 0) / v.length)} dias do envio</b></div>
              ))}
              {!delivered.length && <div className="empty" style={{ padding: 12 }}>Sem entregas concluídas no período.</div>}
            </div>
          </Panel>
          <div className={`callout ${s.recovery.trackingEnabled ? "lagoon" : "sun"}`}>
            <Truck size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>{s.recovery.trackingEnabled ? "O cliente recebe o rastreio no WhatsApp assim que o pedido é postado." : "O aviso de rastreio no WhatsApp está desligado. Ligue em Recuperação para diminuir os \"cadê meu pedido\"."}</div>
            {!s.recovery.trackingEnabled && <Link className="act" href="/recuperacao?cfg=rastreio">Ligar</Link>}
          </div>
        </div>
      </div>
    </>
  );
}
