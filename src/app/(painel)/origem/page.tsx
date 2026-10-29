import { Info, Megaphone, ShieldCheck } from "lucide-react";
import { DateRange } from "@/components/DateRange";
import { UtmBuilder } from "@/components/UtmBuilder";
import { CampaignTree, type TNode } from "@/components/CampaignTree";
import { AutoRefresh } from "@/components/AutoRefresh";
import { channelOf } from "@/lib/attribution";
import { metaAds, type AdRow } from "@/lib/meta";
import { resolvePeriod } from "@/lib/periods";
import { getSettings } from "@/lib/settings";
import { ordersBetween, type Order } from "@/lib/store";
import { brl, dayRange } from "@/lib/time";
import { ErrorNote, Header, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const COLORS = ["#8a948f", "#60a5fa", "#34c26a", "#f7c928", "#a78bfa", "#f472b6", "#fb923c", "#2dd4bf", "#4b5563"];

export default async function Origem({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string }> }) {
  const { p, de, ate } = await searchParams;
  const period = resolvePeriod(p, "7d", de, ate);
  const s = await getSettings();
  let orders: Order[] = [];
  let error: unknown = null;
  try {
    orders = (await ordersBetween(dayRange(period.from).start, dayRange(period.to).end)).filter((o) => !o.cancelled);
  } catch (e) {
    error = e;
  }
  let ads: AdRow[] | null = null;
  try { ads = await metaAds(period.from, period.to); } catch { ads = null; }

  const total = orders.reduce((a, o) => a + o.subtotal, 0);
  const byChannel = new Map<string, { n: number; v: number }>();
  for (const o of orders) { const c = channelOf(o).channel; const cur = byChannel.get(c) ?? { n: 0, v: 0 }; cur.n++; cur.v += o.subtotal; byChannel.set(c, cur); }
  const channels = [...byChannel.entries()].sort((a, b) => b[1].v - a[1].v);
  const metaUtm = orders.filter((o) => channelOf(o).channel === "Meta Ads");
  const metaUtmV = metaUtm.reduce((a, o) => a + o.subtotal, 0);
  const spend = (ads ?? []).reduce((a, r) => a + r.spend, 0);
  const metaSays = (ads ?? []).reduce((a, r) => a + r.purchases, 0);
  const metaSaysV = (ads ?? []).reduce((a, r) => a + r.value, 0);

  // Árvore campanha > conjunto com o que o Meta diz e o que a UTM confirma
  const camps = new Map<string, TNode>();
  const alias = new Map<string, string>();
  const mk = (key: string, label: string, sub?: string): TNode => ({ key, label, sub, spend: null, metaLeads: null, leads: 0, inGroup: 0, sales: 0, value: 0, children: [] });
  for (const a of ads ?? []) {
    if (!camps.has(a.campaignId)) camps.set(a.campaignId, mk(a.campaignId, a.campaign));
    alias.set(a.campaignId, a.campaignId); alias.set(a.campaign.toLowerCase(), a.campaignId);
    const c = camps.get(a.campaignId)!;
    let st = c.children.find((x) => x.key === a.adsetId);
    if (!st) { st = mk(a.adsetId, a.adset); c.children.push(st); }
    for (const n of [c, st]) { n.spend = (n.spend ?? 0) + a.spend; n.metaLeads = (n.metaLeads ?? 0) + a.purchases; }
  }
  for (const o of metaUtm) {
    const camp = o.utm?.campaign;
    if (!camp) continue;
    const k = alias.get(camp) ?? alias.get(camp.toLowerCase());
    let c = k ? camps.get(k) : undefined;
    if (!c) { const key = `utm:${camp}`; c = camps.get(key) ?? mk(key, camp, "só pela UTM"); camps.set(key, c); alias.set(camp, key); }
    c.leads++; c.value += o.subtotal;
    const st = o.utm?.term ? c.children.find((x) => x.key === o.utm!.term || x.label.toLowerCase() === o.utm!.term) : undefined;
    if (st) { st.leads++; st.value += o.subtotal; }
  }
  const nodes = [...camps.values()].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0) || b.value - a.value);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const recent = [...orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 8);
  const colorOf = (ch: string) => COLORS[Math.max(0, channels.findIndex(([k]) => k === ch)) % COLORS.length];

  return (
    <>
      <AutoRefresh seconds={90} />
      <Header title="Vendas por origem" lede="Cada venda conferida pela UTM do link, sem depender do pixel do Meta, do TikTok ou da Shopify.">
        <DateRange current={period.key} from={period.from} to={period.to} label={period.label} />
        <UtmBuilder store={s.postsale.storeUrl} />
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      <div className="cols c-2-1">
        <section className="pnl" style={{ padding: 26 }}>
          <div className="vs">
            <div>
              <small><Megaphone size={14} /> O Meta Ads diz</small>
              <span className="hero-num" style={{ fontSize: 54 }}>{ads ? `${metaSays} vendas` : "–"}</span>
              <p>{ads ? <><b>{brl(metaSaysV, 0)}</b> e retorno de <b>{spend ? (metaSaysV / spend).toFixed(1).replace(".", ",") : "0"}x</b> sobre {brl(spend, 0)} investidos</> : "Conecte o Meta Ads em Integrações"}</p>
            </div>
            <div>
              <small className="up"><ShieldCheck size={14} /> A UTM confirma</small>
              <span className="hero-num up" style={{ fontSize: 54 }}>{metaUtm.length} vendas</span>
              <p><b>{brl(metaUtmV, 0)}</b>{spend ? <> e retorno real de <b>{(metaUtmV / spend).toFixed(1).replace(".", ",")}x</b></> : " vindas do clique no anúncio"}</p>
            </div>
          </div>
          <div className="callout sun" style={{ marginTop: 18 }}>
            <Info size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>O Meta também conta quem só viu o anúncio e comprou depois por outro caminho, então o número dele sempre é maior. A UTM mostra a venda que veio do clique no anúncio. Para decidir onde pôr dinheiro, a UTM é o número mais seguro.</div>
          </div>
        </section>
        <Panel title="De onde veio o dinheiro" sub={`${orders.length} pedidos, ${brl(total, 0)} no período`}>
          <div className="stackbar">{channels.map(([k, v]) => <i key={k} title={`${k}: ${brl(v.v, 0)}`} style={{ width: `${total ? (v.v / total) * 100 : 0}%`, background: colorOf(k) }} />)}</div>
          {channels.map(([k, v]) => (
            <div className="row" key={k} style={{ justifyContent: "space-between", padding: "8px 0", fontSize: 14, flexWrap: "nowrap" }}>
              <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}><i style={{ width: 10, height: 10, borderRadius: 3, background: colorOf(k), display: "inline-block" }} /> {k}</span>
              <span className="row" style={{ gap: 18, flexWrap: "nowrap" }}><span className="dim" style={{ fontSize: 13 }}>{v.n} pedido{v.n > 1 ? "s" : ""}</span><b style={{ minWidth: 80, textAlign: "right" }}>{brl(v.v, 0)}</b></span>
            </div>
          ))}
          {!channels.length && !error && <div className="empty">Sem vendas no período.</div>}
        </Panel>
      </div>
      <div className="cols c-2-1" style={{ alignItems: "start" }}>
        <Panel title="Campanhas e conjuntos" sub="Gasto do Meta cruzado com as vendas da UTM. Colunas: Meta diz = compras que o Meta conta, UTM = vendas confirmadas." body={false}>
          {nodes.length ? <OrigemTree nodes={nodes} /> : <div className="empty">{ads ? "Nenhuma campanha com gasto no período." : "Conecte o Meta Ads para ver o gasto por campanha. As vendas com UTM aparecem aqui assim mesmo."}</div>}
        </Panel>
        <Panel title="Vendas agora" sub="Cada pedido com a origem conferida" right={<span className="row" style={{ gap: 6, fontSize: 13 }}><span className="live-dot" /> Ao vivo</span>}>
          {recent.map((o) => {
            const ch = channelOf(o);
            return (
              <div className="lrow" key={o.id} style={{ display: "block" }}>
                <div className="row" style={{ justifyContent: "space-between" }}><b>{o.name}</b><b>{brl(o.subtotal)}</b></div>
                <div className="row" style={{ gap: 8, margin: "6px 0 4px" }}>
                  <span className="chip" style={{ background: `${colorOf(ch.channel)}22`, color: colorOf(ch.channel) }}>{ch.channel}</span>
                  <span className="dim" style={{ fontSize: 12.5 }}>{o.utm?.campaign ? o.utm.campaign.slice(0, 28) : o.utm ? "" : "sem UTM"}</span>
                </div>
                <small className="dim">{fmt.format(new Date(o.createdAt))}</small>
              </div>
            );
          })}
          {!recent.length && <div className="empty">Sem vendas no período.</div>}
        </Panel>
      </div>
    </>
  );
}

// Reaproveita a árvore de campanhas mostrando gasto, Meta diz, UTM, faturado e retorno
function OrigemTree({ nodes }: { nodes: TNode[] }) {
  return <CampaignTree nodes={nodes} mode="origem" />;
}
