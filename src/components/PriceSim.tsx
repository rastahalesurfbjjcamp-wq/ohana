"use client";
// Simulador de preço: custo, impostos, taxas, cupom, comissão, frete e tráfego (opcional) até o lucro do mês.
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Megaphone, Package, Target, TrendingUp } from "lucide-react";

export type SimProduct = { title: string; image: string | null; price: number; cost: number | null; months: number[]; soldPrice: number | null; stock: number };
type Defaults = { tax: number; fee: number; packaging: number; commission: number; fixed: number; piecesPerOrder: number };

const brl = (v: number, d = 2) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: d, maximumFractionDigits: d });
const pc = (v: number, d = 1) => `${(Number.isFinite(v) ? v * 100 : 0).toFixed(d).replace(".", ",")}%`;
const num = (s: string) => { const n = Number(String(s).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const show = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

function F({ label, value, set, prefix, suffix, hint, w }: { label: string; value: string; set: (v: string) => void; prefix?: string; suffix?: string; hint?: string; w?: number }) {
  return (
    <label className="field" style={{ flex: w ? undefined : 1, width: w, minWidth: 120 }}>
      <span style={{ fontSize: 12.5, color: "var(--ink2)" }}>{label}</span>
      <span className="row" style={{ gap: 0, flexWrap: "nowrap", position: "relative" }}>
        {prefix && <span className="dim" style={{ position: "absolute", left: 11, fontSize: 13 }}>{prefix}</span>}
        <input className="in" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} style={{ paddingLeft: prefix ? 34 : undefined, paddingRight: suffix ? 44 : undefined, fontWeight: 600 }} />
        {suffix && <span className="dim" style={{ position: "absolute", right: 11, fontSize: 12.5 }}>{suffix}</span>}
      </span>
      {hint && <span className="dim" style={{ fontSize: 11.5 }}>{hint}</span>}
    </label>
  );
}
function Toggle({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) {
  return <label className="check" style={{ fontWeight: 600, fontSize: 13.5 }}><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /> {children}</label>;
}

export function PriceSim({ products, initial, defaults }: { products: SimProduct[]; initial?: string; defaults: Defaults }) {
  const first = products.find((p) => p.title === initial) ?? null;
  const avgOf = (p: SimProduct | null) => (p ? Math.round(p.months.reduce((a, b) => a + b, 0) / 3) : 0);
  const [sel, setSel] = useState(first?.title ?? "");
  const [cost, setCost] = useState(first?.cost != null ? show(first.cost) : "60");
  const [price, setPrice] = useState(first ? show(first.price) : "229,90");
  const [disc, setDisc] = useState("0");
  const [tax, setTax] = useState(show(Math.round(defaults.tax * 100) / 100));
  const [fee, setFee] = useState(show(Math.round(defaults.fee * 100) / 100));
  const [pack, setPack] = useState(show(defaults.packaging));
  const [ppo, setPpo] = useState(show(defaults.piecesPerOrder || 1));
  const [vol, setVol] = useState(String(avgOf(first) || 100));
  const [shipOn, setShipOn] = useState(false);
  const [ship, setShip] = useState("25");
  const [comOn, setComOn] = useState(false);
  const [com, setCom] = useState(show(defaults.commission));
  const [comShare, setComShare] = useState("20");
  const [adsOn, setAdsOn] = useState(false);
  const [adsMode, setAdsMode] = useState<"cpa" | "roas">("cpa");
  const [cpa, setCpa] = useState("30");
  const [roas, setRoas] = useState("4");
  const [fixOn, setFixOn] = useState(defaults.fixed > 0);
  const [fixed, setFixed] = useState(show(Math.round(defaults.fixed)));
  const [target, setTarget] = useState("30");

  const pick = (t: string) => {
    setSel(t);
    const p = products.find((x) => x.title === t);
    if (!p) return;
    if (p.cost != null) setCost(show(Math.round(p.cost * 100) / 100));
    setPrice(show(p.price));
    const a = avgOf(p);
    if (a) setVol(String(a));
  };
  const prod = products.find((x) => x.title === sel) ?? null;

  const r = useMemo(() => {
    const P = num(price), C = num(cost), d = num(disc) / 100, t = num(tax) / 100, f = num(fee) / 100, pk = num(pack);
    const per = Math.max(1, num(ppo));
    const recv = P * (1 - d);
    const cRate = comOn ? (num(com) / 100) * (num(comShare) / 100) : 0;
    const shipP = shipOn ? num(ship) / per : 0;
    const adsFixed = adsOn && adsMode === "cpa" ? num(cpa) / per : 0;
    const adsRate = adsOn && adsMode === "roas" && num(roas) > 0 ? 1 / num(roas) : 0;
    const taxV = recv * t, feeV = recv * f, comV = recv * cRate, adsV = adsFixed + recv * adsRate;
    const unit = recv - C - pk - taxV - feeV - comV - shipP - adsV;
    const margin = recv ? unit / recv : 0;
    const beforeAds = unit + adsV;
    const maxCpa = beforeAds * per;
    const varRate = t + f + cRate + adsRate;
    const priceFor = (m: number) => { const den = (1 - d) * (1 - varRate - m); return den > 0 ? (C + pk + shipP + adsFixed) / den : NaN; };
    const q = Math.max(0, Math.round(num(vol)));
    const hist = prod && prod.months.some((x) => x > 0) ? prod.months : null;
    const avg = hist ? hist.reduce((a, b) => a + b, 0) / 3 : 0;
    const lowR = hist && avg ? Math.min(0.9, Math.max(0.3, Math.min(...hist) / avg)) : 0.5;
    const highR = hist && avg ? Math.max(1.1, Math.min(2.5, Math.max(...hist) / avg)) : 1.5;
    const fx = fixOn ? num(fixed) : 0;
    const scen = [
      { k: "Fraco", qty: Math.round(q * lowR), tone: "c" },
      { k: "Esperado", qty: q, tone: "l" },
      { k: "Bom", qty: Math.round(q * highR), tone: "k" },
    ].map((s) => ({ ...s, revenue: recv * s.qty, gross: unit * s.qty, final: unit * s.qty - fx, ads: adsV * s.qty }));
    const toPayFixed = unit > 0 && fx > 0 ? Math.ceil(fx / unit) : null;
    return { P, C, recv, taxV, feeV, comV, shipP, adsV, pk, unit, margin, maxCpa, beforeAds, priceFor, scen, toPayFixed, per, hist, markup: C ? P / C : 0, fx };
  }, [price, cost, disc, tax, fee, pack, ppo, comOn, com, comShare, shipOn, ship, adsOn, adsMode, cpa, roas, vol, fixOn, fixed, prod]);

  const health = r.margin >= 0.3 ? { t: "Margem boa", c: "var(--lagoon)", I: CheckCircle2 } : r.margin >= 0.15 ? { t: "Margem apertada", c: "var(--sun)", I: AlertTriangle } : { t: r.unit < 0 ? "Prejuízo em cada peça" : "Margem baixa", c: "var(--coral)", I: AlertTriangle };
  const steps = [
    { l: "Preço de venda", v: r.P, k: "t" },
    ...(r.P !== r.recv ? [{ l: `Cupom ou desconto (${disc}%)`, v: -(r.P - r.recv), k: "n" }] : []),
    { l: "Custo da peça", v: -r.C, k: "n" },
    { l: "Imposto", v: -r.taxV, k: "n" },
    { l: "Taxa de pagamento", v: -r.feeV, k: "n" },
    { l: "Embalagem", v: -r.pk, k: "n" },
    ...(shipOn ? [{ l: "Frete pago pela loja", v: -r.shipP, k: "n" }] : []),
    ...(comOn ? [{ l: "Comissão de atleta", v: -r.comV, k: "n" }] : []),
    ...(adsOn ? [{ l: adsMode === "cpa" ? `Tráfego (CPA ${brl(num(cpa), 0)} por pedido)` : `Tráfego (ROAS ${roas})`, v: -r.adsV, k: "n" }] : []),
  ];
  const tm = num(target) / 100;
  const sug = r.priceFor(tm);

  return (
    <div className="cols c-1-1 psim" style={{ alignItems: "start" }}>
      <div className="stack">
        <section className="pnl" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Produto</h3>
          <select className="in" value={sel} onChange={(e) => pick(e.target.value)}>
            <option value="">Produto novo (digitar os valores)</option>
            {products.map((p) => <option key={p.title} value={p.title}>{p.title}{p.months.some((x) => x) ? ` · ${p.months.reduce((a, b) => a + b, 0)} vendidos em 90 dias` : ""}</option>)}
          </select>
          {prod && (
            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "nowrap" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {prod.image ? <img className="thumb" src={prod.image} alt="" /> : <div className="thumb" />}
              <div className="dim" style={{ fontSize: 12.5 }}>
                Preço na loja {brl(prod.price)}{prod.soldPrice ? ` · vendido em média por ${brl(prod.soldPrice)}` : ""} · estoque {prod.stock}
                {prod.cost == null && <div style={{ color: "var(--sun)" }}>Sem custo cadastrado: digite o custo abaixo.</div>}
              </div>
            </div>
          )}
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <F label="Custo por peça" value={cost} set={setCost} prefix="R$" />
            <F label="Preço de venda" value={price} set={setPrice} prefix="R$" />
            <F label="Cupom médio" value={disc} set={setDisc} suffix="%" w={110} />
          </div>
        </section>

        <section className="pnl" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Custos por venda</h3>
          <div className="row" style={{ gap: 10 }}>
            <F label="Imposto" value={tax} set={setTax} suffix="%" />
            <F label="Taxa de pagamento" value={fee} set={setFee} suffix="%" />
            <F label="Embalagem" value={pack} set={setPack} prefix="R$" />
            <F label="Peças por pedido" value={ppo} set={setPpo} hint="média da loja" />
          </div>
          <div className="stack" style={{ gap: 10, marginTop: 14 }}>
            <Toggle on={shipOn} set={setShipOn}>A loja paga o frete</Toggle>
            {shipOn && <div className="row"><F label="Frete por pedido" value={ship} set={setShip} prefix="R$" w={160} /></div>}
            <Toggle on={comOn} set={setComOn}>Parte das vendas vem de cupom de atleta</Toggle>
            {comOn && <div className="row" style={{ gap: 10 }}><F label="Comissão" value={com} set={setCom} suffix="%" w={130} /><F label="Vendas com cupom de atleta" value={comShare} set={setComShare} suffix="%" w={200} /></div>}
          </div>
        </section>

        <section className="pnl" style={{ padding: 20, borderColor: adsOn ? "rgba(96,165,250,.4)" : undefined }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <Toggle on={adsOn} set={setAdsOn}><Megaphone size={14} /> Tráfego pago (opcional)</Toggle>
            {adsOn && <div className="seg"><button type="button" className={adsMode === "cpa" ? "on" : ""} onClick={() => setAdsMode("cpa")}>CPA</button><button type="button" className={adsMode === "roas" ? "on" : ""} onClick={() => setAdsMode("roas")}>ROAS</button></div>}
          </div>
          {adsOn && (
            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              {adsMode === "cpa" ? <F label="Custo por venda (CPA)" value={cpa} set={setCpa} prefix="R$" hint="quanto o anúncio gasta para sair 1 pedido" /> : <F label="ROAS" value={roas} set={setRoas} hint="faturamento dividido pelo gasto" />}
            </div>
          )}
          <p className="dim" style={{ fontSize: 12.5, marginTop: 10 }}>Você aguenta pagar até <b style={{ color: "var(--ink)" }}>{brl(Math.max(0, r.maxCpa))}</b> por pedido no anúncio sem ter prejuízo.</p>
        </section>

        <section className="pnl" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Volume e custo fixo</h3>
          <div className="row" style={{ gap: 10 }}>
            <F label="Peças vendidas por mês (esperado)" value={vol} set={setVol} hint={r.hist ? `últimos 3 meses: ${r.hist.join(", ")} peças` : "sem histórico: use sua estimativa"} />
          </div>
          <div className="stack" style={{ gap: 10, marginTop: 14 }}>
            <Toggle on={fixOn} set={setFixOn}>Descontar o custo fixo do mês inteiro</Toggle>
            {fixOn && <div className="row"><F label="Custo fixo do mês" value={fixed} set={setFixed} prefix="R$" w={200} hint="puxado de Custos e impostos" /></div>}
          </div>
        </section>
      </div>

      <div className="stack psim-out">
        <div className="kstrip" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div className={`ks ${r.unit > 0 ? "hl" : "warn"}`}><small><TrendingUp size={14} /> Lucro por peça</small><b className={r.unit < 0 ? "dn" : ""}>{brl(r.unit)}</b><span>margem {pc(r.margin)}</span></div>
          <div className="ks"><small><Package size={14} /> Markup</small><b>{r.markup ? `${r.markup.toFixed(2).replace(".", ",")}x` : "–"}</b><span>preço dividido pelo custo</span></div>
          <div className="ks"><small><Target size={14} /> Preço mínimo</small><b>{Number.isFinite(r.priceFor(0)) ? brl(r.priceFor(0)) : "–"}</b><span>abaixo disso dá prejuízo</span></div>
        </div>

        <section className="pnl" style={{ padding: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Para onde vai o dinheiro de cada peça</h3>
            <span className="row" style={{ gap: 6, color: health.c, fontWeight: 650, fontSize: 13 }}><health.I size={15} /> {health.t}</span>
          </div>
          {steps.map((s) => (
            <div key={s.l} className="row" style={{ justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid var(--line2)", fontSize: 13.5 }}>
              <span className={s.k === "t" ? "" : "mut"}>{s.l}</span>
              <span style={{ fontWeight: s.k === "t" ? 650 : 500 }} className={s.v < 0 ? "dn" : ""}>{s.v < 0 ? `− ${brl(-s.v)}` : brl(s.v)}</span>
            </div>
          ))}
          <div className="row" style={{ justifyContent: "space-between", padding: "10px 0 0", borderTop: "1px solid var(--line)", fontSize: 15 }}>
            <b>Sobra por peça</b><b className={r.unit < 0 ? "dn" : "up"}>{brl(r.unit)}</b>
          </div>
          <div className="hbar" style={{ marginTop: 10, display: "flex", height: 10 }}>
            {[{ v: r.C + r.pk, c: "#7d8782" }, { v: r.taxV + r.feeV, c: "#b4a1fb" }, { v: r.comV + r.shipP, c: "#f7c928" }, { v: r.adsV, c: "#7cb4fb" }, { v: Math.max(0, r.unit), c: "#34c26a" }].map((x, i) => (
              <i key={i} style={{ width: `${r.recv > 0 ? Math.max(0, (x.v / r.recv) * 100) : 0}%`, background: x.c, borderRadius: 0 }} />
            ))}
          </div>
          <div className="row dim" style={{ gap: 12, fontSize: 11.5, marginTop: 6 }}><span>■ custo</span><span style={{ color: "#b4a1fb" }}>■ imposto e taxa</span><span style={{ color: "#f7c928" }}>■ comissão e frete</span><span style={{ color: "#7cb4fb" }}>■ tráfego</span><span style={{ color: "#34c26a" }}>■ lucro</span></div>
        </section>

        <section className="pnl" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Quanto você lucra no mês</h3>
          <p className="dim" style={{ fontSize: 12.5, marginBottom: 10 }}>{r.hist ? "Fraco e bom seguem o pior e o melhor mês dos últimos 90 dias desse produto." : "Fraco é metade do esperado, bom é 50% a mais."}{r.fx ? ` Já tirando ${brl(r.fx, 0)} de custo fixo.` : ""}</p>
          <div className="psim-sc">
            {r.scen.map((s) => (
              <div key={s.k} className="pnl" style={{ padding: 14, borderColor: s.k === "Esperado" ? "rgba(52,194,106,.45)" : undefined }}>
                <div className="dim" style={{ fontSize: 12.5 }}>{s.k}</div>
                <div style={{ fontSize: 12.5, marginTop: 2 }}>{s.qty} peças · {brl(s.revenue, 0)}</div>
                <b className={s.final < 0 ? "dn" : "up"} style={{ fontSize: 22, display: "block", marginTop: 8, fontFamily: "Geist, system-ui" }}>{brl(s.final, 0)}</b>
                <div className="dim" style={{ fontSize: 11.5 }}>lucro final{adsOn ? ` · anúncio ${brl(s.ads, 0)}` : ""}</div>
              </div>
            ))}
          </div>
          {r.toPayFixed != null && <p className="dim" style={{ fontSize: 12.5, marginTop: 10 }}>Precisa vender <b style={{ color: "var(--ink)" }}>{r.toPayFixed} peças</b> no mês só para pagar o custo fixo.</p>}
        </section>

        <section className="pnl" style={{ padding: 20 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Preço sugerido</h3>
            <span className="row" style={{ gap: 6 }}><span className="dim" style={{ fontSize: 13 }}>margem desejada</span><input className="cost-in" value={target} onChange={(e) => setTarget(e.target.value)} style={{ width: 60 }} /><span className="dim">%</span></span>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            {[0.2, 0.3, 0.4].map((m) => <div key={m} className="pnl" style={{ flex: 1, padding: 12 }}><div className="dim" style={{ fontSize: 12 }}>margem {pc(m, 0)}</div><b style={{ fontSize: 17 }}>{Number.isFinite(r.priceFor(m)) ? brl(r.priceFor(m)) : "–"}</b></div>)}
          </div>
          <p style={{ fontSize: 13.5, marginTop: 12 }}>
            {Number.isFinite(sug) ? <>Para sobrar {pc(tm, 0)} do que entra, venda por <b style={{ color: "var(--lagoon)" }}>{brl(sug)}</b>{sug > r.P ? `, ${brl(sug - r.P)} acima do preço atual.` : sug < r.P ? `. O preço atual já passa disso.` : "."} Arredondando para ,90: {brl(Math.ceil(sug / 10) * 10 - 0.1)}.</> : "Com esses custos não dá para chegar nessa margem. Baixe o custo, o cupom ou o tráfego."}
          </p>
        </section>
      </div>
    </div>
  );
}
