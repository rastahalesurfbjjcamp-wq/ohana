import Link from "next/link";
import { Bars } from "@/components/charts";
import { ErrorNote, Header, Panel } from "@/components/ui";
import { couponSeries, salesSeries, storeStart, sumRows, todayIso, type HistRow } from "@/lib/history";
import { brl } from "@/lib/time";

export const dynamic = "force-dynamic";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const pctOf = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "–");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export default async function Historico({ searchParams }: { searchParams: Promise<{ ano?: string; mes?: string }> }) {
  const sp = await searchParams;
  const today = todayIso();
  const start = await storeStart();
  const firstYear = Number(start.slice(0, 4));
  const thisYear = Number(today.slice(0, 4));
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i);
  const ano = sp.ano && years.includes(Number(sp.ano)) ? Number(sp.ano) : null;
  const mes = ano && sp.mes && /^(0?[1-9]|1[0-2])$/.test(sp.mes) ? Number(sp.mes) : null;

  // período e agrupamento
  let from = start, to = today, by: "month" | "day" = "month", title = "Desde a abertura da loja";
  if (ano && mes) {
    const mm = String(mes).padStart(2, "0");
    from = `${ano}-${mm}-01`;
    to = `${ano}-${mm}-${String(lastDay(ano, mes)).padStart(2, "0")}`;
    by = "day"; title = `${MESES[mes - 1]} de ${ano}`;
  } else if (ano) {
    from = `${ano}-01-01`; to = `${ano}-12-31`; title = String(ano);
  }
  if (to > today) to = today;
  if (from < start && !ano) from = start;

  let rows: HistRow[] = [];
  let cupons: HistRow[] = [];
  let erro = "";
  try {
    rows = await salesSeries(from, to, by);
    cupons = await couponSeries(from, to);
  } catch (e) {
    erro = String(e).replace(/^Error: /, "");
  }
  // tira os meses antes da primeira venda
  const firstSale = rows.findIndex((r) => r.orders || r.gross);
  if (!ano && firstSale > 0) rows = rows.slice(firstSale);
  const t = sumRows(rows);
  const afterDisc = t.gross - t.discounts;

  // visão "tudo": resumo por ano
  const byYear = !ano ? years.map((y) => sumRows(rows.filter((r) => r.key.startsWith(String(y))), String(y))).filter((r) => r.orders || r.gross) : [];
  const label = (k: string) => (by === "day" ? `${k.slice(8)}/${k.slice(5, 7)}` : `${MESES[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`);
  const link = (k: string) => (by === "month" ? `/historico?ano=${k.slice(0, 4)}&mes=${Number(k.slice(5, 7))}` : null);
  const semCupom = cupons.find((c) => !c.key);
  const comCupom = cupons.filter((c) => c.key).sort((a, b) => b.discounts - a.discounts);
  const cupomTot = sumRows(comCupom);

  return (
    <>
      <Header title="Histórico de vendas" lede="Toda a história da loja com os números do relatório de vendas da própria Shopify: bruto, cupons, devoluções e líquido.">
        <div className="chips">
          <Link href="/historico" className={!ano ? "on" : ""}>Tudo</Link>
          {years.map((y) => <Link key={y} href={`/historico?ano=${y}`} className={ano === y ? "on" : ""}>{y}</Link>)}
        </div>
      </Header>
      {ano && (
        <div className="chips" style={{ marginBottom: 16, alignSelf: "flex-start" }}>
          <Link href={`/historico?ano=${ano}`} className={!mes ? "on" : ""}>Ano todo</Link>
          {MESES.map((m, i) => (ano < thisYear || i + 1 <= Number(today.slice(5, 7))) && <Link key={m} href={`/historico?ano=${ano}&mes=${i + 1}`} className={mes === i + 1 ? "on" : ""}>{m}</Link>)}
        </div>
      )}
      {erro && <ErrorNote error={erro} />}

      <div className="kstrip hist-k" style={{ marginBottom: 16 }}>
        <div className="ks"><small>Faturamento bruto</small><b>{brl(t.gross, 0)}</b><span>{t.orders.toLocaleString("pt-BR")} pedidos · {title}</span></div>
        <div className="ks"><small>Cupons e descontos</small><b className="dn">-{brl(t.discounts, 0)}</b><span>{pctOf(t.discounts, t.gross)} do bruto</span></div>
        <div className="ks"><small>Depois dos descontos</small><b>{brl(afterDisc, 0)}</b><span>bruto menos descontos</span></div>
        <div className="ks"><small>Devoluções</small><b className="dn">-{brl(t.returns, 0)}</b><span>reembolsos e trocas · {pctOf(t.returns, t.gross)}</span></div>
        <div className="ks hl"><small>Faturamento líquido</small><b>{brl(t.net, 0)}</b><span>ticket {t.orders ? brl(t.net / t.orders, 0) : "–"} · sem frete</span></div>
        <div className="ks"><small>Total cobrado</small><b>{brl(t.total, 0)}</b><span>com {brl(t.shipping, 0)} de frete</span></div>
      </div>

      <section className="pnl" style={{ padding: 22, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Faturamento líquido {by === "day" ? "por dia" : "por mês"}</h3>
          <span className="dim" style={{ fontSize: 12.5 }}>{title}</span>
        </div>
        {rows.some((r) => r.net) ? <Bars items={rows.map((r) => ({ label: label(r.key), value: r.net }))} format={(v) => brl(v, 0)} height={220} /> : <div className="empty">Nenhuma venda no período.</div>}
      </section>

      <div className="cols c-2-1 hst" style={{ alignItems: "start", marginBottom: 16 }}>
        {byYear.length > 0 ? (
          <Panel title="Por ano" sub="Clique no ano para abrir os meses">
            <div className="tbw"><HistTable rows={byYear} label={(k) => k} link={(k) => `/historico?ano=${k}`} total={t} short /></div>
          </Panel>
        ) : (
          <Panel title="Resumo" sub={title}>
            <div className="kv"><span className="mut">Faturamento bruto</span><b>{brl(t.gross, 2)}</b></div>
            <div className="kv"><span className="mut">Cupons e descontos</span><b className="dn">-{brl(t.discounts, 2)}</b></div>
            <div className="kv"><span className="mut">Depois dos descontos</span><b>{brl(afterDisc, 2)}</b></div>
            <div className="kv"><span className="mut">Devoluções</span><b className="dn">-{brl(t.returns, 2)}</b></div>
            <div className="kv"><span className="mut">Faturamento líquido</span><b className="up">{brl(t.net, 2)}</b></div>
            <div className="kv"><span className="mut">Frete cobrado</span><b>{brl(t.shipping, 2)}</b></div>
            <div className="kv"><span className="mut">Total cobrado</span><b>{brl(t.total, 2)}</b></div>
          </Panel>
        )}
        <Panel title="Cupons usados" sub={`${comCupom.length} cupons · ${brl(cupomTot.discounts, 0)} de desconto`}>
          {comCupom.length ? (
            <div className="tbw">
              <table className="tb">
                <thead><tr><th>Cupom</th><th>Pedidos</th><th>Desconto</th></tr></thead>
                <tbody>
                  {comCupom.map((c) => (
                    <tr key={c.key}>
                      <td><b style={{ fontWeight: 600 }}>{c.key}</b><div className="dim" style={{ fontSize: 11.5 }}>líquido {brl(c.net, 0)} · {pctOf(c.discounts, c.gross)} off</div></td>
                      <td>{c.orders}</td>
                      <td className="dn">-{brl(c.discounts, 0)}</td>
                    </tr>
                  ))}
                  {semCupom && (
                    <tr>
                      <td><span className="mut">Sem cupom</span><div className="dim" style={{ fontSize: 11.5 }}>líquido {brl(semCupom.net, 0)}{semCupom.discounts > 0 ? " · desconto automático" : ""}</div></td>
                      <td>{semCupom.orders}</td>
                      <td className={semCupom.discounts ? "dn" : ""}>{semCupom.discounts ? `-${brl(semCupom.discounts, 0)}` : "–"}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">Nenhum cupom usado no período.</div>}
        </Panel>
      </div>
      <div className="hst">
        <Panel title={by === "day" ? "Dia a dia" : "Mês a mês"} sub={by === "month" ? "Clique no mês para ver dia a dia" : undefined}>
          <div className="tbw"><HistTable rows={[...rows].reverse().filter((r) => r.orders || r.gross || r.returns)} label={label} link={link} total={t} /></div>
        </Panel>
      </div>
      <p className="dim" style={{ fontSize: 12, marginTop: 14 }}>Mesmos números de Análises → Relatórios → Vendas na Shopify. Líquido = bruto − descontos − devoluções, sem frete e sem impostos. Pedidos com mais de um cupom aparecem em cada cupom.</p>
    </>
  );
}

function HistTable({ rows, label, link, total, short }: { rows: HistRow[]; label: (k: string) => string; link: (k: string) => string | null; total: HistRow; short?: boolean }) {
  if (short)
    return (
      <table className="tb">
        <thead><tr><th>Ano</th><th>Pedidos</th><th>Bruto</th><th>Descontos</th><th>Devoluções</th><th>Líquido</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td><Link href={link(r.key) ?? "#"} style={{ fontWeight: 600 }}>{label(r.key)}</Link></td>
              <td>{r.orders}</td>
              <td>{brl(r.gross, 0)}</td>
              <td className="dn">-{brl(r.discounts, 0)}</td>
              <td className="dn">-{brl(r.returns, 0)}</td>
              <td><b>{brl(r.net, 0)}</b></td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td><b>Total</b></td><td><b>{total.orders}</b></td><td><b>{brl(total.gross, 0)}</b></td><td className="dn"><b>-{brl(total.discounts, 0)}</b></td><td className="dn"><b>-{brl(total.returns, 0)}</b></td><td><b>{brl(total.net, 0)}</b></td></tr></tfoot>
      </table>
    );
  return (
    <table className="tb">
      <thead><tr><th>Período</th><th>Pedidos</th><th>Bruto</th><th>Descontos</th><th>Depois dos descontos</th><th>Devoluções</th><th>Líquido</th><th>Frete</th><th>Total cobrado</th></tr></thead>
      <tbody>
        {rows.map((r) => {
          const href = link(r.key);
          return (
            <tr key={r.key}>
              <td>{href ? <Link href={href} style={{ fontWeight: 600 }}>{label(r.key)}</Link> : <b style={{ fontWeight: 600 }}>{label(r.key)}</b>}</td>
              <td>{r.orders}</td>
              <td>{brl(r.gross, 2)}</td>
              <td className={r.discounts ? "dn" : ""}>{r.discounts ? `-${brl(r.discounts, 2)}` : "–"}</td>
              <td>{brl(r.gross - r.discounts, 2)}</td>
              <td className={r.returns ? "dn" : ""}>{r.returns ? `-${brl(r.returns, 2)}` : "–"}</td>
              <td><b>{brl(r.net, 2)}</b></td>
              <td>{brl(r.shipping, 2)}</td>
              <td>{brl(r.total, 2)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot><tr><td><b>Total</b></td><td><b>{total.orders}</b></td><td><b>{brl(total.gross, 2)}</b></td><td className="dn"><b>-{brl(total.discounts, 2)}</b></td><td><b>{brl(total.gross - total.discounts, 2)}</b></td><td className="dn"><b>-{brl(total.returns, 2)}</b></td><td><b>{brl(total.net, 2)}</b></td><td><b>{brl(total.shipping, 2)}</b></td><td><b>{brl(total.total, 2)}</b></td></tr></tfoot>
    </table>
  );
}
