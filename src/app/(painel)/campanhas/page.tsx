import Link from "next/link";
import { Globe, MousePointerClick, PenLine, ShoppingCart, Users, Wallet } from "lucide-react";
import { DateRange } from "@/components/DateRange";
import { CampaignTree, type TNode } from "@/components/CampaignTree";
import { CopyButton } from "@/components/CopyButton";
import { db } from "@/lib/db";
import { channelOf } from "@/lib/attribution";
import { metaAds, type AdRow } from "@/lib/meta";
import { resolvePeriod } from "@/lib/periods";
import { funnelByDay, ordersBetween, type Order } from "@/lib/store";
import { brl, dayRange } from "@/lib/time";
import { Header, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const UTM = "?utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}";

export default async function Campanhas({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string }> }) {
  const { p, de, ate } = await searchParams;
  const period = resolvePeriod(p, "30d", de, ate);
  const start = dayRange(period.from).start, end = dayRange(period.to).end;
  let ads: AdRow[] | null = null;
  let metaError = "";
  try {
    ads = await metaAds(period.from, period.to);
  } catch (e) {
    metaError = String(e).replace(/^Error: /, "");
  }
  const [orders, leads, funnel] = await Promise.all([
    ordersBetween(start, end).catch(() => [] as Order[]),
    db.lead.findMany({ where: { createdAt: { gte: start, lt: end } } }),
    funnelByDay(period.from, period.to).catch(() => null),
  ]);
  const inGroupSet = new Set((await db.contact.findMany({ where: { phone: { in: leads.map((l) => l.phone) }, memberships: { some: { leftAt: null, group: { isCommunity: true } } } }, select: { phone: true } })).map((c) => c.phone));
  const leftQuick = await db.membership.count({ where: { contact: { phone: { in: leads.map((l) => l.phone) } }, leftAt: { not: null }, group: { isCommunity: true } } });

  // Árvore campanha > conjunto > anúncio, juntando Meta e UTM (por id ou por nome)
  const mk = (key: string, label: string, sub?: string): TNode => ({ key, label, sub, spend: null, metaLeads: null, leads: 0, inGroup: 0, sales: 0, value: 0, children: [] });
  const camps = new Map<string, TNode>();
  const alias = new Map<string, string>(); // id ou nome -> chave
  for (const a of ads ?? []) {
    if (!camps.has(a.campaignId)) camps.set(a.campaignId, mk(a.campaignId, a.campaign));
    const c = camps.get(a.campaignId)!;
    alias.set(a.campaignId, a.campaignId); alias.set(a.campaign.toLowerCase(), a.campaignId);
    let s = c.children.find((x) => x.key === a.adsetId);
    if (!s) { s = mk(a.adsetId, a.adset); c.children.push(s); }
    let ad = s.children.find((x) => x.key === a.adId);
    if (!ad) { ad = mk(a.adId, a.ad); s.children.push(ad); }
    for (const n of [c, s, ad]) {
      n.spend = (n.spend ?? 0) + a.spend;
      n.metaLeads = (n.metaLeads ?? 0) + a.leads;
    }
  }
  const none = mk("_sem", "Sem campanha", "bio, grupo, direto");
  const findPath = (camp?: string | null, term?: string | null, content?: string | null): TNode[] => {
    if (!camp) return [none];
    const ck = alias.get(camp) ?? alias.get(camp.toLowerCase());
    let c = ck ? camps.get(ck) : undefined;
    if (!c) {
      const key = `utm:${camp.toLowerCase()}`;
      c = camps.get(key) ?? mk(key, camp, "só pelo link");
      camps.set(key, c);
      alias.set(camp.toLowerCase(), key);
    }
    const path = [c];
    const s = term ? c.children.find((x) => x.key === term || x.label.toLowerCase() === term.toLowerCase()) : undefined;
    if (s) {
      path.push(s);
      const ad = content ? s.children.find((x) => x.key === content || x.label.toLowerCase() === content.toLowerCase()) : undefined;
      if (ad) path.push(ad);
    }
    return path;
  };
  for (const l of leads) {
    const path = /^(fb|facebook|ig|instagram|meta)/i.test(l.utmSource ?? "") || l.utmCampaign ? findPath(l.utmCampaign, l.utmTerm, l.utmContent) : [none];
    for (const n of path) { n.leads++; if (inGroupSet.has(l.phone)) n.inGroup++; }
  }
  const paidOrders = orders.filter((o) => !o.cancelled);
  for (const o of paidOrders) {
    const ch = channelOf(o);
    const path = ch.channel === "Meta Ads" ? findPath(o.utm?.campaign, o.utm?.term, o.utm?.content) : [none];
    for (const n of path) { n.sales++; n.value += o.subtotal; }
  }
  const nodes = [...camps.values()].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0) || b.value - a.value);
  for (const c of nodes) { c.children.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0)); for (const s of c.children) s.children.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0)); }
  if (none.leads || none.sales) nodes.push(none);

  const spend = (ads ?? []).reduce((a, r) => a + r.spend, 0);
  const clicks = (ads ?? []).reduce((a, r) => a + r.clicks, 0);
  const metaLeads = (ads ?? []).reduce((a, r) => a + r.leads, 0);
  const visits = (funnel ?? []).reduce((a, d) => a + d.sessions, 0);
  const paidLeads = nodes.filter((n) => n.key !== "_sem").reduce((a, n) => a + n.leads, 0);
  const inGroup = nodes.filter((n) => n.key !== "_sem").reduce((a, n) => a + n.inGroup, 0);
  const metaSales = paidOrders.filter((o) => channelOf(o).channel === "Meta Ads");
  const metaRevenue = metaSales.reduce((a, o) => a + o.subtotal, 0);
  const pctOf = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  const steps = [
    { icon: Wallet, l: "Investido", v: ads ? brl(spend, 0) : "–", sub: ads ? "Meta Ads" : "conecte o Meta", bar: 100, color: "#60a5fa" },
    { icon: MousePointerClick, l: "Cliques no link", v: ads ? clicks.toLocaleString("pt-BR") : "–", sub: clicks ? `CPC ${brl(spend / clicks)}` : "–", bar: 100, color: "#60a5fa", conv: null },
    { icon: Globe, l: "Visitas na loja", v: visits.toLocaleString("pt-BR"), sub: "Shopify · todas as origens", bar: clicks ? Math.min(100, (visits / clicks) * 100) : 60, color: "#a78bfa", conv: clicks ? pctOf(visits, clicks) : null },
    { icon: PenLine, l: "Preencheram", v: paidLeads.toLocaleString("pt-BR"), sub: paidLeads && spend ? `CPL real ${brl(spend / paidLeads)}` : `${leads.length} leads no total`, bar: 35, color: "#f7c928", conv: null },
    { icon: Users, l: "Entraram no grupo", v: inGroup.toLocaleString("pt-BR"), sub: inGroup && spend ? `${brl(spend / inGroup)} por membro` : "dos leads de anúncio", bar: 25, color: "#34c26a", conv: pctOf(inGroup, paidLeads) },
    { icon: ShoppingCart, l: "Compraram", v: metaSales.length.toLocaleString("pt-BR"), sub: `${brl(metaRevenue, 0)}${spend ? ` · ROAS ${(metaRevenue / spend).toFixed(1).replace(".", ",")}` : ""}`, bar: 8, color: "#34c26a", conv: null },
  ];
  const bestAd = nodes.flatMap((c) => c.children.flatMap((s) => s.children)).filter((a) => a.spend && a.inGroup >= 3).sort((a, b) => a.spend! / a.inGroup - b.spend! / b.inGroup)[0];
  const barMax = Math.max(1, metaLeads, paidLeads, inGroup);

  return (
    <>
      <Header title="Campanhas" lede={ads ? "Meta Ads conectado. Cada campanha, conjunto e anúncio com o que gastou, quem preencheu de verdade, quem entrou no grupo e quem comprou." : "Leads, grupo e vendas por campanha, pelo link do anúncio. Conecte o Meta Ads para ver o investimento junto."}>
        <DateRange current={period.key} from={period.from} to={period.to} label={period.label} />
        {!ads && <Link className="btn pri" href="/integracoes">Conectar Meta Ads</Link>}
      </Header>
      {metaError && <div className="err">{metaError}</div>}
      <div className="fstrip">
        {steps.map((s, i) => (
          <div key={s.l} className="fs">
            {s.conv && i > 0 && <span className="fs-conv">{s.conv}</span>}
            <small><s.icon size={14} /> {s.l}</small>
            <b>{s.v}</b>
            <span>{s.sub}</span>
            <div className="hbar" style={{ height: 5, marginTop: 10 }}><i style={{ width: `${s.bar}%`, background: s.color }} /></div>
          </div>
        ))}
      </div>
      <div className="cols c-3-1" style={{ alignItems: "start" }}>
        <section className="pnl">
          {nodes.length ? <CampaignTree nodes={nodes} /> : <div className="empty">Nenhum lead ou venda com campanha no período.</div>}
        </section>
        <div className="stack">
          <Panel title="Meta x realidade" sub="Leads que o Meta conta x quem preencheu de fato">
            <div className="mxr">
              {[["Meta diz", ads ? metaLeads : null, "#3b5b8f", "#9cc3ff"], ["Preencheram", paidLeads, "#6b5a1c", "#f7d35a"], ["Entraram", inGroup, "#1d5a37", "#4ad781"]].map(([l, v, bg, fg]) => (
                <div key={l as string}>
                  <i style={{ height: `${v == null ? 6 : Math.max(6, ((v as number) / barMax) * 100)}%`, background: bg as string }}><b style={{ color: fg as string }}>{v == null ? "–" : (v as number).toLocaleString("pt-BR")}</b></i>
                  <small>{l as string}</small>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              {ads && metaLeads > paidLeads && <div className="kv"><span className="mut">Leads duplicados ou falsos</span><b className="dn">{metaLeads - paidLeads} ({pctOf(metaLeads - paidLeads, metaLeads)})</b></div>}
              <div className="kv"><span className="mut">Preencheu e não entrou no grupo</span><b style={{ color: "var(--sun)" }}>{Math.max(0, paidLeads - inGroup)}</b></div>
              <div className="kv"><span className="mut">Entrou e já saiu do grupo</span><b>{leftQuick}</b></div>
              {bestAd && <div className="kv"><span className="mut">Melhor anúncio por membro</span><b className="up">{bestAd.label.slice(0, 22)}</b></div>}
            </div>
            <div className="ib-sec">Rastreio no link do anúncio</div>
            <div className="code" style={{ fontSize: 12, wordBreak: "break-all" }}>{UTM}</div>
            <div style={{ marginTop: 8 }}><CopyButton text={UTM} className="btn sm" label="Copiar parâmetros" /></div>
            <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>Cole em &quot;Parâmetros de URL&quot; de cada anúncio. O Hub junta pelo id da campanha, do conjunto e do anúncio.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
