import Link from "next/link";
import { Globe, MousePointerClick, PenLine, ShoppingCart, Users, Wallet } from "lucide-react";
import { DateRange } from "@/components/DateRange";
import { CampaignTree, type TNode } from "@/components/CampaignTree";
import { CopyButton } from "@/components/CopyButton";
import { db } from "@/lib/db";
import { channelOf } from "@/lib/attribution";
import { activeAccounts, byGroup, campStats, metaAccounts, metaAds, type AdRow, type CampStat, type MetaAccount } from "@/lib/meta";
import { getSettings } from "@/lib/settings";
import { saveAdAccounts, saveCampGroup } from "../acoes7";
import { SubmitSelect } from "@/components/SubmitSelect";
import { couponSales, type CouponSales } from "@/lib/history";
import { metaLabel } from "@/lib/metaLabels";
import { saveFollowMetric, savePerfilCoupons } from "../acoes7";
import { resolvePeriod } from "@/lib/periods";
import { funnelByDay, ordersBetween, type Order } from "@/lib/store";
import { brl, dayRange } from "@/lib/time";
import { Header, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { vendas: "venda", leads: "lead", perfil: "perfil", fora: "não mostrar" };

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
  let cstats: CampStat[] | null = null;
  let accounts: MetaAccount[] = [];
  try { cstats = await campStats(period.from, period.to); } catch (e) { metaError ||= String(e).replace(/^Error: /, ""); }
  try { accounts = await metaAccounts(); } catch { accounts = []; }
  const settings = await getSettings();
  const actives = await activeAccounts();
  const cfgOf = (id: string) => settings.ads.accounts.find((a) => a.id === id) ?? (settings.ads.accounts.length ? null : actives.find((a) => a.id === id) ?? null);
  const grp = cstats ? byGroup(cstats) : null;
  // tráfego do perfil: métricas que o Meta mandou e vendas pelo cupom do ManyChat
  const perfilCamps = (cstats ?? []).filter((c) => c.group === "perfil");
  const perfilActs = new Map<string, number>();
  for (const c of perfilCamps) for (const [k, v] of Object.entries(c.acts)) perfilActs.set(k, (perfilActs.get(k) ?? 0) + v);
  const actOpts = [...perfilActs.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  let cs: CouponSales | null = null;
  try { cs = settings.ads.perfilCoupons.length ? await couponSales(settings.ads.perfilCoupons, period.from, period.to) : null; } catch { cs = null; }
  const feeRate = settings.costs.taxRate + settings.costs.paymentFeeRate;
  const perfilSpend = grp?.perfil.spend ?? 0;
  const perfilProfit = cs ? cs.net - cs.cogs - cs.net * feeRate - perfilSpend : null;
  const fm = settings.ads.followMetric;
  const fCount = grp ? grp.perfil.follows || (fm ? 0 : grp.perfil.visits) : 0;
  const fLabel = fm ? metaLabel(fm) : grp && !grp.perfil.follows && grp.perfil.visits ? "Visitas ao perfil" : "Seguidores";
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
      {(cstats || accounts.length > 0) && (
        <div className="cols c-2-1" style={{ alignItems: "start", marginBottom: 16 }}>
          <section className="pnl">
            <div className="ph"><div><h3>Campanhas por tipo</h3><small>O tipo decide onde o gasto aparece na visão geral. Automático segue o objetivo da campanha.</small></div></div>
            {grp && (
              <div className="kstrip" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", padding: "0 18px 14px" }}>
                <div className="ks"><small>Venda</small><b>{brl(grp.vendas.spend, 0)}</b><span>{grp.vendas.purchases} compra(s) pelo Meta{grp.vendas.spend && grp.vendas.value ? ` · ROAS ${(grp.vendas.value / grp.vendas.spend).toFixed(2).replace(".", ",")}` : ""}</span></div>
                <div className="ks"><small>Lead</small><b>{grp.leads.leads.toLocaleString("pt-BR")}</b><span>{grp.leads.leads ? `${brl(grp.leads.spend / grp.leads.leads)} por lead` : "sem leads"} · {brl(grp.leads.spend, 0)}</span></div>
                <div className="ks"><small>Perfil</small><b>{(grp.perfil.follows || grp.perfil.visits).toLocaleString("pt-BR")}</b><span>{grp.perfil.follows ? "seguidores" : "visitas no perfil"}{(grp.perfil.follows || grp.perfil.visits) ? ` · ${brl(grp.perfil.spend / (grp.perfil.follows || grp.perfil.visits))} cada` : ""} · {brl(grp.perfil.spend, 0)}</span></div>
              </div>
            )}
            {cstats && cstats.length ? (
              <table className="tb">
                <thead><tr><th>Campanha</th><th>Tipo</th><th>Gasto</th><th>Resultado</th><th>Custo</th></tr></thead>
                <tbody>
                  {cstats.map((c) => {
                    const res = c.group === "leads" ? [c.leads, "leads"] : c.group === "perfil" ? (c.follows ? [c.follows, "seguidores"] : [c.visits, "visitas no perfil"]) : [c.purchases, "compras"];
                    const n = res[0] as number;
                    return (
                      <tr key={c.account + c.id}>
                        <td><b style={{ fontWeight: 550 }}>{c.name}</b><div className="dim" style={{ fontSize: 11.5 }}>{c.accountName}{c.objective ? ` · ${c.objective.replace("OUTCOME_", "").toLowerCase()}` : ""}</div></td>
                        <td>
                          <form action={saveCampGroup}>
                            <input type="hidden" name="id" value={c.id} />
                            <SubmitSelect name="group" value={c.manual ? c.group : "auto"} label="Tipo da campanha">
                              <option value="auto">Automático ({LABEL[c.auto]})</option>
                              <option value="vendas">Venda</option>
                              <option value="leads">Lead</option>
                              <option value="perfil">Perfil</option>
                              <option value="fora">Não mostrar</option>
                            </SubmitSelect>
                          </form>
                        </td>
                        <td>{brl(c.spend, 2)}</td>
                        <td>{c.group === "fora" ? "–" : `${n.toLocaleString("pt-BR")} ${res[1]}`}</td>
                        <td>{c.group !== "fora" && n ? brl(c.spend / n) : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <div className="empty">Nenhuma campanha com gasto no período.</div>}
          </section>
          <section className="pnl">
            <div className="ph"><div><h3>Contas de anúncio</h3><small>Escolha quais contas entram no Hub e o que cada uma roda.</small></div></div>
            {accounts.length ? (
              <form action={saveAdAccounts} style={{ padding: "0 18px 18px" }}>
                {accounts.map((a) => {
                  const cfg = cfgOf(a.id);
                  return (
                    <div className="lrow" key={a.id} style={{ alignItems: "center", gap: 10 }}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name={`name_${a.id}`} value={a.name} />
                      <label className="dd-chk" style={{ flex: 1, padding: 0 }}>
                        <input type="checkbox" name={`on_${a.id}`} value="1" defaultChecked={!!cfg?.on} />
                        <span><b style={{ fontWeight: 550, color: "var(--ink)" }}>{a.name}</b><br /><small className="dim">{a.id}{a.status !== 1 ? " · inativa" : ""}</small></span>
                      </label>
                      <select name={`kind_${a.id}`} defaultValue={cfg?.kind ?? "auto"} className="in" style={{ height: 34, width: 130 }} aria-label="O que essa conta roda">
                        <option value="auto">Pelo objetivo</option>
                        <option value="vendas">Só venda</option>
                        <option value="leads">Só lead</option>
                        <option value="perfil">Só perfil</option>
                      </select>
                    </div>
                  );
                })}
                <button className="btn pri sm" type="submit" style={{ marginTop: 12 }}>Salvar contas</button>
                <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>&quot;Só perfil&quot; conta tudo dessa conta como tráfego para o perfil, com seguidores e custo por seguidor.</p>
              </form>
            ) : <div className="empty">Nenhuma conta encontrada no token do Meta.</div>}
          </section>
        </div>
      )}
      {(perfilCamps.length > 0 || settings.ads.perfilCoupons.length > 0) && (
        <section className="pnl" style={{ marginBottom: 16 }}>
          <div className="ph"><div><h3>Tráfego do perfil</h3><small>Seguidores que a campanha trouxe e o que vendeu pelo cupom que o ManyChat entrega</small></div></div>
          <div className="kstrip" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", padding: "0 18px 14px" }}>
            <div className="ks"><small>Gasto no perfil</small><b>{brl(perfilSpend, 0)}</b><span>{perfilCamps.length} campanha(s)</span></div>
            <div className="ks"><small>{fLabel}</small><b>{fCount.toLocaleString("pt-BR")}</b><span>{fCount ? `${brl(perfilSpend / fCount)} cada` : "escolha a métrica abaixo"}</span></div>
            <div className="ks"><small>Vendas pelo cupom</small><b>{cs ? brl(cs.net, 0) : "–"}</b><span>{cs ? `${cs.orders} pedido(s) · ${cs.codes.join(", ") || "sem cupom"}` : "sem cupom definido"}</span></div>
            <div className="ks"><small>ROAS do perfil</small><b>{cs && perfilSpend ? (cs.net / perfilSpend).toFixed(2).replace(".", ",") : "–"}</b><span>vendas do cupom ÷ gasto</span></div>
            <div className="ks"><small>Lucro do perfil</small><b className={perfilProfit != null && perfilProfit < 0 ? "dn" : "up"}>{perfilProfit != null ? brl(perfilProfit, 0) : "–"}</b><span>{cs ? `peças ${brl(cs.cogs, 0)} · taxas ${brl(cs.net * feeRate, 0)}${cs.missingCost ? ` · ${cs.missingCost} peça(s) sem custo` : ""}` : "–"}</span></div>
          </div>
          <div className="row" style={{ gap: 16, padding: "0 18px 18px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <form action={saveFollowMetric} style={{ minWidth: 280 }}>
              <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>O que contar no lugar de seguidor (o Meta não manda seguidores pela API)</div>
              <SubmitSelect name="metric" value={settings.ads.followMetric} label="Métrica de seguidor">
                <option value="">Automático</option>
                {actOpts.map(([k, v]) => <option key={k} value={k}>{metaLabel(k)} · {v.toLocaleString("pt-BR")}</option>)}
                {settings.ads.followMetric && !perfilActs.has(settings.ads.followMetric) && <option value={settings.ads.followMetric}>{metaLabel(settings.ads.followMetric)}</option>}
              </SubmitSelect>
            </form>
            <form action={savePerfilCoupons} className="row" style={{ gap: 8, alignItems: "flex-end" }}>
              <div>
                <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>Cupom do ManyChat (separe por vírgula)</div>
                <input className="in" name="coupons" defaultValue={settings.ads.perfilCoupons.join(", ")} style={{ height: 34, width: 240 }} />
              </div>
              <button className="btn sm" type="submit">Salvar cupom</button>
            </form>
          </div>
          {perfilCamps.length > 0 && !actOpts.length && <p className="dim" style={{ fontSize: 12, padding: "0 18px 16px" }}>O Meta ainda não mandou métricas para as campanhas de perfil nesse período.</p>}
        </section>
      )}
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
