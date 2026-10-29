import Link from "next/link";
import { AlertTriangle, Pencil, BadgeDollarSign, CalendarCheck, Coins, Instagram, Link2, Plus, ShoppingBag, Trophy, X } from "lucide-react";
import { db } from "@/lib/db";
import { DateRange } from "@/components/DateRange";
import { CopyButton } from "@/components/CopyButton";
import { NumberInput } from "@/components/NumberInput";
import { Bars } from "@/components/charts";
import { partnerLink, partnerStats, unlinkedCodes } from "@/lib/partners";
import { daysBetween, resolvePeriod } from "@/lib/periods";
import { getSettings } from "@/lib/settings";
import { addDays, brl, isoDayLocal } from "@/lib/time";
import { formatPhone } from "@/lib/phone";
import { ErrorNote, Header, Kpi, Panel } from "@/components/ui";
import { addPartner, changePartnerCode, fixPartnerPercent, markPayout, savePartnerRules, undoPayout } from "../acoes5";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { atleta: "Atleta", influenciador: "Influenciador" };
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default async function Atletas({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string; novo?: string; erro?: string; criado?: string; ok?: string; k?: string; mes?: string; editar?: string; trocado?: string }> }) {
  const sp = await searchParams;
  const period = resolvePeriod(sp.p, "30d", sp.de, sp.ate);
  const s = await getSettings();
  const today = isoDayLocal();
  // Mês que se paga no dia 1: o mês anterior (ou o escolhido)
  const lastMonth = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const payMonth = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : lastMonth;
  const pmFrom = `${payMonth}-01`;
  const pmTo = addDays(`${addDays(pmFrom, 32).slice(0, 7)}-01`, -1);
  let stats: Awaited<ReturnType<typeof partnerStats>> | null = null;
  let payStats: Awaited<ReturnType<typeof partnerStats>> | null = null;
  let error: unknown = null;
  try {
    [stats, payStats] = await Promise.all([partnerStats(period.from, period.to), partnerStats(pmFrom, pmTo < today ? pmTo : today)]);
  } catch (e) {
    error = e;
  }
  const [payouts, unlinked] = await Promise.all([db.payout.findMany({ where: { month: payMonth } }), sp.novo ? unlinkedCodes().catch(() => []) : Promise.resolve([])]);
  const rows = (stats?.rows ?? []).filter((r) => !sp.k || r.kind === sp.k);
  const tot = (k: "revenue" | "profit" | "commission" | "orders") => rows.reduce((a, r) => a + r[k], 0);
  const days = daysBetween(period.from, period.to);
  const bars = days.map((d) => ({ label: `${d.slice(8)}/${d.slice(5, 7)}`, value: stats?.daily.get(d) ?? 0 }));
  const payRows = (payStats?.rows ?? []).filter((r) => r.commission > 0);
  const toPay = payRows.filter((r) => !payouts.some((p) => p.referralId === r.id)).reduce((a, r) => a + r.commission, 0);
  const paid = payouts.reduce((a, p) => a + p.amount, 0);
  const isPayDay = Number(today.slice(8)) <= 5 && payMonth === lastMonth && toPay > 0;
  const store = s.postsale.storeUrl;
  const monthName = `${MONTHS[Number(payMonth.slice(5)) - 1]} de ${payMonth.slice(0, 4)}`;
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const nextPay = `${addDays(`${today.slice(0, 7)}-01`, 32).slice(0, 7)}-01`;

  return (
    <>
      <Header title="Atletas e influenciadores" lede={`Quem divulga a loja com cupom próprio. O cliente ganha ${s.referral.percent}% de desconto e o atleta recebe ${s.referral.commission}% do que vendeu, pago todo dia 1.`}>
        <DateRange current={period.key} from={period.from} to={period.to} label={period.label} presets={["hoje", "ontem", "7d", "30d", "mes", "mes-passado"]} />
        <Link className="btn pri" href={sp.novo ? "/atletas" : "/atletas?novo=1"}><Plus size={16} /> Novo atleta</Link>
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      {sp.criado && <div className="ok">Atleta cadastrado com o cupom {sp.criado}. O link de referência já está pronto na tabela.</div>}
      {sp.ok === "regras" && <div className="ok">Regras salvas.</div>}
      {sp.trocado && <div className="ok">Cupom trocado para {sp.trocado}. As vendas já contam pelo cupom novo.</div>}
      {sp.erro && sp.erro !== "nome" && <div className="err">{sp.erro}</div>}
      {isPayDay && (
        <div className="callout sun">
          <CalendarCheck size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>Dia de pagar as comissões de {monthName}: faltam <b>{brl(toPay)}</b>. Marque cada atleta como pago depois do Pix.</div>
          <a className="act" href="#pagamentos">Ver pagamentos</a>
        </div>
      )}

      {sp.novo && (
        <Panel title="Novo atleta ou influenciador" sub={`Se o cupom não existir, o Hub cria na Shopify com ${s.referral.percent}% de desconto. Se já existir, só vincula.`} right={<Link className="menu-b" href="/atletas"><X size={16} /></Link>}>
          <form action={addPartner} className="stack">
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Nome</label><input className="in" name="name" required placeholder="Bernardo Mastrangelo" autoFocus /></div>
              <div className="field" style={{ width: 190 }}><label>Instagram</label><input className="in" name="instagram" placeholder="@pitbull" /></div>
              <div className="field" style={{ width: 190 }}><label>WhatsApp</label><input className="in" name="phone" placeholder="21 99999-9999" inputMode="tel" /></div>
            </div>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ width: 200 }}><label>Cupom (vazio = nome + {s.referral.percent})</label><input className="in" name="code" placeholder={`PITBULL${s.referral.percent}`} style={{ textTransform: "uppercase" }} /></div>
              <div className="field" style={{ width: 170 }}><label>Tipo</label><select className="in" name="kind" defaultValue="atleta"><option value="atleta">Atleta</option><option value="influenciador">Influenciador</option></select></div>
              <div className="field" style={{ width: 180 }}><label>Recebe por</label><select className="in" name="payout" defaultValue="pix"><option value="pix">Pix</option><option value="credito">Crédito na loja</option></select></div>
              <label className="check" style={{ marginBottom: 10 }}><input type="checkbox" name="ajustar" defaultChecked /> Se o cupom já existir, deixar em {s.referral.percent}%</label>
              <button className="btn pri" type="submit">Cadastrar e gerar link</button>
            </div>
            {sp.erro === "nome" && <div className="err">Coloque o nome.</div>}
          </form>
          {unlinked.length > 0 && (
            <>
              <div className="ib-sec">Cupons que já existem na Shopify</div>
              <div className="ul-grid">
                {unlinked.map((c) => (
                  <form key={c.code} action={addPartner} className="ul-c">
                    <input type="hidden" name="code" value={c.code} />
                    <input type="hidden" name="ajustar" value="" />
                    <div style={{ minWidth: 0 }}><span className="trk">{c.code}</span><small className="dim" style={{ display: "block", marginTop: 4 }}>{c.uses} usos · {c.percent != null ? `${c.percent}%` : "valor fixo"}</small></div>
                    <input className="in" name="name" placeholder="Nome do atleta" required style={{ height: 34 }} />
                    <button className="btn sm" type="submit">Vincular</button>
                  </form>
                ))}
              </div>
            </>
          )}
        </Panel>
      )}

      <div className="grid g4">
        <Kpi icon={<ShoppingBag size={15} />} label="Vendas pelos cupons" value={brl(tot("revenue"), 0)} sub={`${tot("orders")} pedidos · ${period.label.toLowerCase()}`} />
        <Kpi icon={<Coins size={15} />} tone="k" label="Lucro líquido" value={<span className={tot("profit") < 0 ? "dn" : "up"}>{brl(tot("profit"), 0)}</span>} sub="já descontando custo, taxas e comissão" />
        <Kpi icon={<BadgeDollarSign size={15} />} tone="s" label={`Comissão (${s.referral.commission}%)`} value={brl(tot("commission"), 0)} sub="do período escolhido" />
        <div className="pnl kpi hl">
          <small><span className="tile sm t-l" style={{ width: 28, height: 28, borderRadius: 8 }}><CalendarCheck size={15} /></span> A pagar de {MONTHS[Number(lastMonth.slice(5)) - 1]}</small>
          <span className="num up">{brl(payMonth === lastMonth ? toPay : 0, 0)}</span>
          <div className="sub">{payMonth === lastMonth && toPay === 0 && paid > 0 ? "tudo pago" : `próximo pagamento: dia 1/${nextPay.slice(5, 7)}`}</div>
        </div>
      </div>

      <div className="cols c-3-1" style={{ alignItems: "start" }}>
        <Panel title="Ranking" sub="Quem mais vendeu no período, pelo cupom usado no pedido" body={false}
          right={<div className="chips">{[["", "Todos"], ["atleta", "Atletas"], ["influenciador", "Influenciadores"]].map(([k, l]) => <Link key={l} href={`/atletas?${new URLSearchParams({ ...(sp.p ? { p: sp.p } : {}), ...(sp.de ? { de: sp.de } : {}), ...(sp.ate ? { ate: sp.ate } : {}), ...(k ? { k } : {}) })}`} className={(sp.k ?? "") === k ? "on" : ""}>{l}</Link>)}</div>}>
          {rows.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="tb">
                <thead><tr><th>#</th><th>Atleta</th><th>Cupom</th><th className="r">Pedidos</th><th className="r">Vendeu</th><th className="r">Lucro</th><th className="r">Comissão</th><th>Link de referência</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => {
                    const off = r.discountPct != null && r.discountPct !== s.referral.percent;
                    return (
                      <tr key={r.id} style={!r.active ? { opacity: 0.5 } : undefined}>
                        <td style={{ fontWeight: 700, color: i === 0 && r.revenue ? "var(--sun)" : undefined }}>{i === 0 && r.revenue ? <Trophy size={15} /> : i + 1}</td>
                        <td>
                          <b style={{ fontWeight: 600 }}>{r.name}</b>
                          <div className="dim" style={{ fontSize: 12 }}>{KIND[r.kind] ?? r.kind}{r.instagram ? <> · <Instagram size={11} /> {r.instagram}</> : ""}{r.phone.startsWith("sem-") ? "" : ` · ${formatPhone(r.phone)}`}</div>
                        </td>
                        <td>
                          {sp.editar === r.id ? (
                            <form action={changePartnerCode} className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                              <input type="hidden" name="id" value={r.id} />
                              <input className="in" name="code" defaultValue={r.code} autoFocus style={{ width: 130, height: 32, textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }} />
                              <button className="btn pri sm" type="submit">Salvar</button>
                              <Link className="menu-b" href="/atletas" aria-label="Cancelar"><X size={14} /></Link>
                            </form>
                          ) : (
                            <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                              <span className="trk" style={i === 0 && r.revenue ? { color: "var(--sun)" } : undefined}>{r.code}</span>
                              <Link href={`/atletas?editar=${r.id}`} className="menu-b" style={{ width: 26, height: 26 }} title="Trocar o cupom"><Pencil size={13} /></Link>
                            </span>
                          )}
                          <div style={{ fontSize: 11.5, marginTop: 4 }}>{r.discountPct == null ? <span className="dim">desconto ?</span> : off ? (
                            <form action={fixPartnerPercent} className="row" style={{ gap: 4 }}><input type="hidden" name="id" value={r.id} /><span style={{ color: "var(--sun)" }}><AlertTriangle size={11} /> {r.discountPct}%</span><button className="fb-link" type="submit" style={{ color: "var(--lagoon)" }}>deixar {s.referral.percent}%</button></form>
                          ) : <span className="dim">{r.discountPct}% para o cliente</span>}</div>
                        </td>
                        <td className="r">{r.orders}<div className="dim" style={{ fontSize: 11.5 }}>{r.pieces} peças</div></td>
                        <td className="r"><b>{brl(r.revenue, 0)}</b></td>
                        <td className="r"><span className={r.profit < 0 ? "dn" : "up"} style={{ fontWeight: 650 }}>{brl(r.profit, 0)}</span></td>
                        <td className="r" style={{ color: "var(--sun)", fontWeight: 650 }}>{brl(r.commission)}</td>
                        <td><CopyButton text={partnerLink(store, r.code)} className="btn sm" label="Copiar link" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-art"><Trophy size={26} className="dim" /><div>Nenhum atleta ainda. Clique em Novo atleta: o cupom e o link saem na hora.</div></div>
          )}
        </Panel>
        <div className="stack">
          <Panel title="Vendas por dia" sub={`Pelos cupons dos atletas · ${period.label.toLowerCase()}`}>
            <Bars items={bars} format={(v) => brl(v, 0)} height={180} />
          </Panel>
          <Panel title="Regras do programa">
            <form action={savePartnerRules} className="stack" style={{ gap: 8 }}>
              <div className="cfg-row"><span>Desconto para o cliente</span><NumberInput size="sm" name="percent" defaultValue={s.referral.percent} suffix="%" min={1} max={50} /></div>
              <div className="cfg-row"><span>Comissão do atleta</span><NumberInput size="sm" name="commission" defaultValue={s.referral.commission} suffix="%" max={50} /></div>
              <div className="cfg-row"><span>Pagamento</span><b style={{ paddingRight: 8 }}>todo dia 1</b></div>
              <div><button className="btn sm" type="submit">Salvar regras</button></div>
            </form>
            <p className="dim" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>A comissão é sobre o valor líquido do pedido: já com o desconto do cupom, sem frete. Pedido cancelado ou estornado não conta.</p>
            <div className="ib-sec">Link de referência</div>
            <div className="code" style={{ fontSize: 12, wordBreak: "break-all" }}>{partnerLink(store, "CUPOM")}</div>
            <p className="dim" style={{ fontSize: 12, marginTop: 6 }}>Abre a loja já com o cupom aplicado. Para mandar direto para um produto, troque a barra final pelo endereço do produto.</p>
          </Panel>
        </div>
      </div>

      <section className="pnl" id="pagamentos">
        <div className="ph">
          <div><h3>Pagamentos de {monthName}</h3><small>Vendas de 1 a {pmTo.slice(8)}/{payMonth.slice(5)}, pagas no dia 1/{addDays(pmTo, 1).slice(5, 7)}</small></div>
          <div className="seg">
            {[addDays(`${lastMonth}-01`, -1).slice(0, 7), lastMonth, today.slice(0, 7)].map((m) => (
              <Link key={m} href={`/atletas?mes=${m}#pagamentos`} className={payMonth === m ? "on" : ""}>{MONTHS[Number(m.slice(5)) - 1].slice(0, 3)}{m === today.slice(0, 7) ? " (parcial)" : ""}</Link>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          {payRows.length ? (
            <table className="tb">
              <thead><tr><th>Atleta</th><th className="r">Vendeu no mês</th><th className="r">Comissão</th><th>Forma</th><th>Situação</th><th style={{ width: 170 }} /></tr></thead>
              <tbody>
                {payRows.map((r) => {
                  const p = payouts.find((x) => x.referralId === r.id);
                  return (
                    <tr key={r.id}>
                      <td><b style={{ fontWeight: 600 }}>{r.name}</b> <span className="trk" style={{ marginLeft: 6 }}>{r.code}</span></td>
                      <td className="r">{brl(r.revenue)}</td>
                      <td className="r"><b style={{ color: "var(--sun)" }}>{brl(r.commission)}</b></td>
                      <td className="mut">{r.payout === "credito" ? "Crédito na loja" : "Pix"}</td>
                      <td>{p ? <span className="chip c-l">Pago em {fmt.format(p.paidAt).slice(0, 5)}</span> : payMonth === today.slice(0, 7) ? <span className="chip c-n">mês em andamento</span> : <span className="chip c-s">A pagar</span>}</td>
                      <td className="r">
                        {p ? (
                          <form action={undoPayout}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="month" value={payMonth} /><button className="btn sm ghost" type="submit">Desfazer</button></form>
                        ) : payMonth !== today.slice(0, 7) && (
                          <form action={markPayout}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="month" value={payMonth} /><input type="hidden" name="amount" value={r.commission.toFixed(2)} /><input type="hidden" name="sales" value={r.revenue.toFixed(2)} /><input type="hidden" name="method" value={r.payout} /><button className="btn pri sm" type="submit">Marcar como pago</button></form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <div className="empty">Nenhuma comissão em {monthName}.</div>}
          {payRows.length > 0 && <div className="row" style={{ justifyContent: "flex-end", gap: 18, padding: "14px 22px", fontSize: 14 }}><span className="mut">Pago: <b style={{ color: "#fff" }}>{brl(paid)}</b></span><span className="mut">Falta: <b style={{ color: "var(--sun)" }}>{brl(payMonth === today.slice(0, 7) ? 0 : toPay)}</b></span></div>}
        </div>
      </section>

      {(stats?.orders.length ?? 0) > 0 && (
        <Panel title="Pedidos com cupom de atleta" sub={period.label} body={false}>
          <table className="tb">
            <tbody>
              {stats!.orders.slice(0, 30).map(({ order: o, partner }) => (
                <tr key={o.id}>
                  <td><b style={{ fontWeight: 600 }}>{o.name}</b></td>
                  <td className="mut">{o.customer}</td>
                  <td><span className="chip c-k"><Link2 size={11} /> {partner}</span></td>
                  <td className="r"><b>{brl(o.subtotal)}</b></td>
                  <td className="r dim">{fmt.format(new Date(o.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}
