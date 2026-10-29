import { DateRange } from "@/components/DateRange";
import { channelOf } from "@/lib/attribution";
import { metaInsights } from "@/lib/meta";
import { resolvePeriod } from "@/lib/periods";
import { ordersBetween, type Order } from "@/lib/store";
import { brl, dayRange } from "@/lib/time";
import { ErrorNote, Header, Kpi, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Origem({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string }> }) {
  const { p , de: sp_de, ate: sp_ate } = await searchParams;
  const period = resolvePeriod(p, "7d", sp_de, sp_ate);
  let orders: Order[] = [];
  let error: unknown = null;
  let meta: Awaited<ReturnType<typeof metaInsights>> = null;
  let metaCampaigns: Awaited<ReturnType<typeof metaInsights>> = null;
  try {
    orders = (await ordersBetween(dayRange(period.from).start, dayRange(period.to).end)).filter((o) => !o.cancelled);
  } catch (e) {
    error = e;
  }
  try {
    meta = await metaInsights(period.from, period.to);
    metaCampaigns = await metaInsights(period.from, period.to, "campaign");
  } catch {
    meta = null;
  }
  const byChannel = new Map<string, { n: number; v: number }>();
  const byCampaign = new Map<string, { n: number; v: number }>();
  for (const o of orders) {
    const c = channelOf(o);
    const cur = byChannel.get(c.channel) ?? { n: 0, v: 0 };
    cur.n++; cur.v += o.subtotal;
    byChannel.set(c.channel, cur);
    if (c.campaign) {
      const k = byCampaign.get(c.campaign) ?? { n: 0, v: 0 };
      k.n++; k.v += o.subtotal;
      byCampaign.set(c.campaign, k);
    }
  }
  const total = orders.reduce((a, o) => a + o.subtotal, 0);
  const metaUtm = byChannel.get("Meta Ads") ?? { n: 0, v: 0 };
  const m = meta?.[0];
  const channels = [...byChannel.entries()].sort((a, b) => b[1].v - a[1].v);

  return (
    <>
      <Header title="Vendas por origem" lede="De onde veio cada venda, pelo link (UTM) que a pessoa clicou, comparado com o que o Meta diz que vendeu.">
        <DateRange current={period.key} from={period.from} to={period.to} label={period.label} />
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      <div className="grid g4">
        <Kpi label="Vendas no período" value={orders.length} sub={brl(total, 0)} />
        <Kpi label="Meta diz que vendeu" value={m ? `${m.purchases} vendas` : "–"} sub={m ? brl(m.value, 0) : "conecte o Meta Ads"} />
        <Kpi label="O link (UTM) confirma" value={`${metaUtm.n} vendas`} sub={brl(metaUtm.v, 0)} />
        <Kpi label="Custo por venda confirmada" value={m && metaUtm.n ? brl(m.spend / metaUtm.n, 0) : "–"} sub={m ? `gasto ${brl(m.spend, 0)}` : undefined} />
      </div>
      {m && m.purchases > metaUtm.n && (
        <div className="note">
          O Meta conta {m.purchases} vendas, mas só {metaUtm.n} chegaram pelo link do anúncio. A diferença costuma ser gente que viu o anúncio e comprou depois por outro caminho (Instagram, grupo, direto). Para decidir verba, olhe o número confirmado.
        </div>
      )}
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Vendas por canal" body={false}>
          {channels.length ? (
            <table className="tb">
              <thead><tr><th>Canal</th><th className="r">Vendas</th><th className="r">Valor</th><th className="r">%</th></tr></thead>
              <tbody>
                {channels.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="r">{v.n}</td>
                    <td className="r"><b>{brl(v.v, 0)}</b></td>
                    <td className="r mut">{total ? Math.round((v.v / total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !error && <div className="empty">Sem vendas no período.</div>
          )}
        </Panel>
        <Panel title="Campanhas" sub="Gasto e vendas que o Meta informa, lado a lado com as vendas confirmadas pelo link" body={false}>
          {metaCampaigns?.length || byCampaign.size ? (
            <table className="tb">
              <thead><tr><th>Campanha</th><th className="r">Gasto</th><th className="r">Meta diz</th><th className="r">Link confirma</th></tr></thead>
              <tbody>
                {[...new Set([...(metaCampaigns ?? []).map((c) => c.campaign), ...byCampaign.keys()])].map((name) => {
                  const mc = metaCampaigns?.find((c) => c.campaign === name);
                  const u = byCampaign.get(name) ?? byCampaign.get(name.toLowerCase());
                  return (
                    <tr key={name}>
                      <td style={{ maxWidth: 240 }}>{name}</td>
                      <td className="r">{mc ? brl(mc.spend, 0) : "–"}</td>
                      <td className="r">{mc ? mc.purchases : "–"}</td>
                      <td className="r"><b>{u ? `${u.n} (${brl(u.v, 0)})` : "0"}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhuma campanha com UTM no período. Use utm_source=facebook e utm_campaign com o nome da campanha nos links dos anúncios.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
