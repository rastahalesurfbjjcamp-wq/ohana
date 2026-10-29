import type { Metadata } from "next";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { hasAppmax } from "@/lib/appmax";
import { SubscribeBox } from "./SubscribeBox";
import "./assinar.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Clube ${process.env.STORE_NAME ?? ""}`.trim(), description: "Assinatura mensal com desconto, lançamentos antes e pontos." };

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const Lock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
const I = { tag: <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />, clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />, cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> };
const Ic = ({ d }: { d: React.ReactNode }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141714" strokeWidth="1.8">{d}</svg>;

export default async function Assinar() {
  const { club: c, postsale } = await getSettings();
  const [prizes, ready] = await Promise.all([db.clubPrize.findMany({ where: { active: true }, orderBy: { points: "asc" }, take: 4 }), hasAppmax()]);
  const per100 = c.valuePer100;
  const examples = prizes.length ? prizes.map((p) => [p.title, p.points] as const) : [[`${money((c.minRedeem / 100) * per100)} de desconto`, c.minRedeem] as const, [`${money(per100 * 4)} de desconto`, 400] as const];
  const store = env.storeName();

  return (
    <div className="sub">
      <header className="sb-top">
        <a className="sb-logo" href={postsale.storeUrl}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lion.png" alt="" /><b>{store}</b>
        </a>
        <div className="sb-sec"><Lock /> Pagamento seguro</div>
      </header>
      <div className="sb-rule" />
      <div className="sb-mhead"><div className="sb-eyebrow">Assinatura mensal</div><h1>{c.name}</h1><p className="lede">{c.discountPct}% em toda compra, lançamentos antes e pontos que viram desconto.</p></div>
      <div className="sb-wrap">
        <section>
          <div className="sb-eyebrow">Assinatura mensal</div>
          <h1>{c.name}</h1>
          <p className="lede">Para quem treina e pega onda com a gente o ano todo. Você paga um valor pequeno por mês e ganha vantagem em tudo que compra na loja.</p>
          <div className="sb-plan">
            <div className="sb-li"><Ic d={I.tag} /><div><b>{c.discountPct}% de desconto em toda compra</b><span>Um cupom só seu, que funciona na sua conta da loja.</span></div></div>
            <div className="sb-li"><Ic d={I.clock} /><div><b>Lançamentos {c.earlyHours} horas antes</b><span>Você compra os drops antes de abrir para todo mundo.</span></div></div>
            <div className="sb-li"><Ic d={I.star} /><div><b>Pontos em cada compra</b><span>Cada R$ 1 vira {c.pointsPerReal === 1 ? "1 ponto" : `${String(c.pointsPerReal).replace(".", ",")} pontos`}. Troque por desconto{prizes.length ? " ou por peças da loja" : ""}.</span></div></div>
            <div className="sb-li"><Ic d={I.cal} /><div><b>Eventos do Club {c.eventPoints ? "com pontos" : "sem pagar entrada"}</b><span>Open Mat e encontros do {store} Club.</span></div></div>
          </div>
          <div className="sb-pts">
            <h4>O que seus pontos valem <small>{prizes.length ? "catálogo" : "exemplos"}</small></h4>
            {examples.map(([t, p]) => <div className="sb-pr" key={t}><span className="sb-t">{t}</span><em>{p.toLocaleString("pt-BR")} pontos</em></div>)}
          </div>
        </section>
        <aside className="sb-box">
          <div className="sb-sum"><div className="sb-n">{c.name}<small>Cobrança mensal · cancele quando quiser</small></div><div className="sb-v"><b>{money(c.fee)}</b><small>por mês</small></div></div>
          <div className="sb-body">
            <SubscribeBox fee={c.fee} ready={ready} storeUrl={postsale.storeUrl} clubName={c.name} />
          </div>
        </aside>
      </div>
    </div>
  );
}
