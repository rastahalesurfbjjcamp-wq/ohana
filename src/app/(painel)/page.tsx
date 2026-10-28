import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Megaphone, ShoppingBag, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { computeMetrics, type Metrics } from "@/lib/report";
import { brl, dayRange, isoDayLocal, pct } from "@/lib/time";
import { Bar, Header, Kpi, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = isoDayLocal();
  const { start } = dayRange(today);
  let m: Metrics | null = null;
  let shopErr = "";
  try {
    m = await computeMetrics(today, today);
  } catch (e) {
    shopErr = String(e).includes("não configurada") ? "Conecte a Shopify nas variáveis do servidor para ver as vendas." : "Não consegui ler a Shopify agora.";
  }
  const [joins, leaves, next, groups] = await Promise.all([
    db.memberEvent.count({ where: { type: { in: ["JOIN", "RETURN"] }, createdAt: { gte: start }, group: { isCommunity: true } } }),
    db.memberEvent.count({ where: { type: "LEAVE", createdAt: { gte: start }, group: { isCommunity: true } } }),
    db.scheduledMessage.findMany({ where: { status: "SCHEDULED" }, orderBy: { sendAt: "asc" }, take: 4 }),
    db.group.findMany({ where: { isCommunity: true, archived: false }, orderBy: { size: "desc" }, take: 6 }),
  ]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Header title="Visão geral" lede="Como a loja e a comunidade estão indo hoje." />
      {shopErr && <div className="note">{shopErr}</div>}
      <div className="grid g4">
        <Kpi icon={<ShoppingBag size={15} />} label="Faturamento hoje" value={m ? brl(m.net) : "–"} sub={m ? `${m.orders} pedidos` : undefined} />
        <Kpi icon={<Megaphone size={15} />} label="Anúncios hoje" value={m?.ads != null ? brl(m.ads) : "–"} sub={m?.ads ? `ROAS ${(m.net / m.ads).toFixed(2).replace(".", ",")}` : "Meta Ads"} />
        <Kpi icon={<TrendingUp size={15} />} label="Lucro hoje" value={m ? brl(m.profitBeforeFixed) : "–"} sub="antes dos custos fixos" />
        <Kpi
          label="Comunidade hoje"
          value={
            <>
              <span className="up">+{joins}</span> <span className="dim">/</span> <span className="dn">{leaves}</span>
            </>
          }
          sub={m?.conversion ? `Conversão da loja ${pct(m.conversion.rate)}` : "entraram / saíram"}
        />
      </div>
      <div className="grid g2">
        <Panel title="Próximos agendamentos" right={<Link className="btn sm" href="/agendamentos">Ver todos</Link>} body={false}>
          {next.length ? (
            <table className="tb">
              <tbody>
                {next.map((s) => (
                  <tr key={s.id}>
                    <td style={{ width: 120 }}>
                      <span className="chip c-k">
                        <CalendarClock size={13} />
                        {fmt.format(s.sendAt)}
                      </span>
                    </td>
                    <td className="mut">{s.text.slice(0, 80)}{s.text.length > 80 ? "…" : ""}</td>
                    <td className="r dim">{s.groupJids.length} grupos</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nada agendado.</div>
          )}
        </Panel>
        <Panel title="Lotação dos grupos" right={<Link className="btn sm" href="/grupos">Grupos</Link>} body={false}>
          {groups.length ? (
            <table className="tb">
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td style={{ width: 160 }}>
                      <Bar value={g.size} max={g.capacity} />
                    </td>
                    <td className="r mut" style={{ width: 100 }}>
                      {g.size}/{g.capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Conecte o WhatsApp para ver os grupos.</div>
          )}
        </Panel>
      </div>
      {m?.champion && (
        <Panel title="Produto campeão hoje">
          <div className="row">
            <b>{m.champion.title}</b>
            <span className="mut">
              {m.champion.quantity} un. · {brl(m.champion.revenue)}
            </span>
            {m.missingCost.length > 0 && <span className="chip c-s">{m.missingCost.length} produto(s) sem custo cadastrado</span>}
          </div>
        </Panel>
      )}
      <p className="dim" style={{ fontSize: 12 }}>
        <ArrowUpRight size={12} /> entradas e <ArrowDownRight size={12} /> saídas contam só os grupos marcados como comunidade.
      </p>
    </>
  );
}
