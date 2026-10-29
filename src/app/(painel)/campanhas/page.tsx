import Link from "next/link";
import { channelOf } from "@/lib/attribution";
import { metaCampaigns, type CampaignRow } from "@/lib/meta";
import { resolvePeriod } from "@/lib/periods";
import { ordersBetween } from "@/lib/store";
import { brl, dayRange, pct } from "@/lib/time";
import { Header, Kpi, Panel, PeriodTabs } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Campanhas({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const period = resolvePeriod(p, "7d");
  let rows: CampaignRow[] | null = null;
  let error = "";
  try {
    rows = await metaCampaigns(period.from, period.to);
  } catch (e) {
    error = String(e).replace(/^Error: /, "");
  }
  const confirmed = new Map<string, { n: number; v: number }>();
  try {
    for (const o of await ordersBetween(dayRange(period.from).start, dayRange(period.to).end)) {
      const c = channelOf(o);
      if (!c.campaign || o.cancelled) continue;
      const k = c.campaign.toLowerCase();
      const cur = confirmed.get(k) ?? { n: 0, v: 0 };
      cur.n++; cur.v += o.subtotal;
      confirmed.set(k, cur);
    }
  } catch {
    /* sem Shopify */
  }
  const list = (rows ?? []).filter((r) => r.spend > 0).sort((a, b) => b.spend - a.spend);
  const spend = list.reduce((a, r) => a + r.spend, 0);
  const metaValue = list.reduce((a, r) => a + r.value, 0);
  const conf = (r: CampaignRow) => confirmed.get(r.name.toLowerCase()) ?? confirmed.get(r.id) ?? null;
  const confValue = list.reduce((a, r) => a + (conf(r)?.v ?? 0), 0);

  return (
    <>
      <Header title="Campanhas" lede="Cada campanha do Meta com o que ela gastou, o que o Meta diz que vendeu e o que o link (UTM) confirma.">
        <PeriodTabs base="/campanhas" current={period.key} keys={["ontem", "7d", "30d", "mes", "mes-passado"]} />
      </Header>
      {rows === null && !error && (
        <div className="note">Conecte o Meta Ads em <Link href="/integracoes" style={{ textDecoration: "underline" }}>Integrações</Link> para ver as campanhas.</div>
      )}
      {error && <div className="err">{error}</div>}
      <div className="grid g4">
        <Kpi label="Gasto" value={brl(spend, 0)} />
        <Kpi label="ROAS que o Meta diz" value={spend ? (metaValue / spend).toFixed(2).replace(".", ",") : "–"} sub={brl(metaValue, 0)} />
        <Kpi label="ROAS confirmado pelo link" value={spend ? (confValue / spend).toFixed(2).replace(".", ",") : "–"} sub={brl(confValue, 0)} />
        <Kpi label="Campanhas com gasto" value={list.length} />
      </div>
      <Panel title="Campanhas" sub="Para o link confirmar, use utm_campaign igual ao nome da campanha (ou {{campaign.name}} no Meta)." body={false}>
        {list.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="tb">
              <thead><tr><th>Campanha</th><th className="r">Gasto</th><th className="r">CTR</th><th className="r">CPC</th><th className="r">Meta diz</th><th className="r">ROAS Meta</th><th className="r">Link confirma</th><th className="r">ROAS real</th></tr></thead>
              <tbody>
                {list.map((r) => {
                  const c = conf(r);
                  const roasReal = r.spend ? (c?.v ?? 0) / r.spend : 0;
                  return (
                    <tr key={r.id}>
                      <td style={{ maxWidth: 260 }}>{r.name}</td>
                      <td className="r"><b>{brl(r.spend, 0)}</b></td>
                      <td className="r">{pct(r.ctr)}</td>
                      <td className="r">{brl(r.cpc)}</td>
                      <td className="r">{r.purchases} ({brl(r.value, 0)})</td>
                      <td className="r">{r.spend ? (r.value / r.spend).toFixed(2).replace(".", ",") : "–"}</td>
                      <td className="r">{c ? `${c.n} (${brl(c.v, 0)})` : "0"}</td>
                      <td className="r"><b className={roasReal >= 2 ? "up" : roasReal < 1 ? "dn" : ""}>{roasReal.toFixed(2).replace(".", ",")}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Nenhuma campanha com gasto no período.</div>
        )}
      </Panel>
    </>
  );
}
