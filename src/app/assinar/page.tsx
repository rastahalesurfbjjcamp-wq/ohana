import type { Metadata } from "next";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { hasAppmax } from "@/lib/appmax";
import { SubscribeBox } from "./SubscribeBox";
import "./assinar.css";
import { clubBenefits, clubTenure } from "@/lib/clubBenefits";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `${process.env.STORE_NAME ?? ""} Club`.trim(), description: "Assinatura mensal com desconto, camiseta exclusiva, pontos, eventos e lançamentos antes." };

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const Lock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
const I = { gift: <><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>, trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>, cake: <><path d="M4 21h16v-8H4zM4 16s1.5-1 4-1 4 2 4 2 1.5-2 4-2 4 1 4 1M12 13V9M12 6v.01" /></>, users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>, tag: <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />, clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />, cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> };
const Ic = ({ d }: { d: React.ReactNode }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141714" strokeWidth="1.8">{d}</svg>;

// Dentro da página da loja (rastahale.com.br/pages/clube): sem o topo próprio, links abrem na janela da loja e a altura acompanha o conteúdo
const EMBED_JS = `document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(a&&a.href)a.target="_top"});(function(){var last=0;function send(){var h=document.documentElement.scrollHeight;if(h!==last){last=h;parent.postMessage({rhClubHeight:h},"*")}}new ResizeObserver(send).observe(document.body);setInterval(send,800);send()})();`;

export default async function Assinar({ searchParams }: { searchParams: Promise<{ embed?: string }> }) {
  const embed = (await searchParams).embed === "1";
  const { club: c, postsale } = await getSettings();
  const [prizes, ready] = await Promise.all([db.clubPrize.findMany({ where: { active: true }, orderBy: { points: "asc" }, take: 4 }), hasAppmax()]);
  const per100 = c.valuePer100;
  const examples = prizes.length ? prizes.map((p) => [p.title, p.points] as const) : [[`${money((c.minRedeem / 100) * per100)} de desconto`, c.minRedeem] as const, [`${money(per100 * 4)} de desconto`, 400] as const];
  const store = env.storeName();

  return (
    <div className={`sub${embed ? " embed" : ""}`}>
      {embed && <script dangerouslySetInnerHTML={{ __html: EMBED_JS }} />}
      <header className="sb-top">
        <a className="sb-logo" href={postsale.storeUrl}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lion.png" alt="" /><b>{store}</b>
        </a>
        <div className="sb-sec"><Lock /> Pagamento seguro</div>
      </header>
      <div className="sb-rule" />
      <div className="sb-mhead"><div className="sb-eyebrow">Assinatura mensal</div><h1>{c.name}</h1><p className="lede">{c.discountPct}% de desconto, lançamentos antes, coleções exclusivas, open mats e eventos.</p></div>
      <div className="sb-wrap">
        <section>
          <div className="sb-eyebrow">Assinatura mensal</div>
          <h1>{c.name}</h1>
          <p className="lede">Para quem treina e pega onda com a gente o ano todo. Você paga um valor pequeno por mês e ganha vantagem em tudo que compra na loja.</p>
          <div className="sb-plan">
            {clubBenefits(c).map(([t, d], i) => <div className="sb-li" key={i}><Ic d={[I.tag, I.clock, I.star, I.gift, I.trophy, I.users, I.cal, I.cake][i] ?? I.star} /><div><b>{t}</b><span>{d}</span></div></div>)}
            {clubTenure(c).map((x) => <div className="sb-li" key={x.m}><Ic d={I.trophy} /><div><b>Com {x.m} meses de club</b><span>{x.t}</span></div></div>)}
          </div>
          <div className="sb-pts">
            <h4>O que seus pontos valem <small>{prizes.length ? "catálogo" : "exemplos"}</small></h4>
            {examples.map(([t, p]) => <div className="sb-pr" key={t}><span className="sb-t">{t}</span><em>{p.toLocaleString("pt-BR")} pontos</em></div>)}
          </div>
        </section>
        <aside className="sb-box">
          <div className="sb-sum"><div className="sb-n">{c.name}<small>Cobrança mensal · cancele quando quiser</small></div><div className="sb-v"><b>{money(c.fee)}</b><small>por mês</small></div></div>
          <div className="sb-body">
            <SubscribeBox fee={c.fee} ready={ready} storeUrl={postsale.storeUrl} clubName={c.name} acceptPix={!!c.acceptPix} />
          </div>
        </aside>
      </div>
    </div>
  );
}
