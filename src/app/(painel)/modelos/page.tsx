import Link from "next/link";
import { ChevronRight, ExternalLink, Search } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { TEMPLATES } from "@/lib/templates";
import { Header } from "@/components/ui";
import { applyTemplate } from "../acoes4";

export const dynamic = "force-dynamic";
const CATS = ["Recuperação", "Pós-venda", "Comunidade", "Atendimento"] as const;

export default async function Modelos({ searchParams }: { searchParams: Promise<{ c?: string; q?: string; usado?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const on: Record<string, boolean> = { carrinho: s.recovery.cartEnabled, pix: s.recovery.pixEnabled, rastreio: s.recovery.trackingEnabled, avaliacao: s.postsale.reviewEnabled, recompra: s.postsale.repurchaseEnabled, boasvindas: s.leads.welcomeEnabled, volta: s.winback.enabled, ausencia: s.assistant.enabled };
  const q = (sp.q ?? "").toLowerCase();
  const list = TEMPLATES.filter((t) => (!sp.c || t.cat === sp.c) && (!q || `${t.title} ${t.desc}`.toLowerCase().includes(q)));
  return (
    <>
      <Header title="Modelos prontos" lede="Escolha, ajuste o texto e ative. Os modelos que já estão ligados aparecem marcados.">
        <form className="srch" action="/modelos"><Search size={15} className="dim" /><input name="q" defaultValue={sp.q} placeholder="Buscar modelo" /></form>
      </Header>
      {sp.usado && <div className="ok">Texto do modelo aplicado. Ajuste os detalhes e ligue na tela da automação.</div>}
      <div className="chips" style={{ alignSelf: "flex-start" }}>
        <Link href="/modelos" className={!sp.c ? "on" : ""}>Todos<b>{TEMPLATES.length}</b></Link>
        {CATS.map((c) => <Link key={c} href={`/modelos?c=${encodeURIComponent(c)}`} className={sp.c === c ? "on" : ""}>{c}<b>{TEMPLATES.filter((t) => t.cat === c).length}</b></Link>)}
      </div>
      <div className="tpl-grid">
        {list.map((t) => (
          <article key={t.k} className="tpl">
            <div className="tpl-p">
              <div className="tpl-b">{t.bubble}</div>
              {t.button && <span className="tpl-btn">{t.button === "VOLTEI10" ? s.postsale.coupon : t.button}</span>}
            </div>
            <div className="tpl-i">
              <b>{t.title}</b>
              <p>{t.desc}</p>
              <div className="row" style={{ justifyContent: "space-between", marginTop: "auto" }}>
                {on[t.k] ? <span className="chip c-l">Ligado</span> : <span className="chip c-n">{t.cat}</span>}
                <span className="row" style={{ gap: 4 }}>
                  {t.texts.length > 0 && <form action={applyTemplate}><input type="hidden" name="k" value={t.k} /><button className="btn sm ghost" type="submit">Usar texto</button></form>}
                  <Link className="btn sm ghost" href={t.href}>Abrir <ChevronRight size={14} /></Link>
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="dim" style={{ fontSize: 12 }}><ExternalLink size={11} /> Modelos aprovados na Meta aparecem aqui quando a API Oficial do WhatsApp for conectada.</p>
    </>
  );
}
