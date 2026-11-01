"use client";
import { useActionState } from "react";
import { lookup, type TrackResult } from "./acao";

const STEPS = ["Pedido recebido", "Pagamento aprovado", "Enviado", "Entregue"];
const fmt = (s: string, time = true) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(s));

export function Rastreio({ store, site, wa, pedido }: { store: string; site: string; wa: string; pedido: string }) {
  const [r, act, pending] = useActionState<TrackResult, FormData>(lookup, null);
  const t = r && r.ok ? r : null;
  return (
    <div className="rs">
      <style>{CSS}</style>
      <header className="rs-h">
        <a href={site || "#"} className="rs-logo"><img src="/brand/lion.png" alt="" /><span>{store}</span></a>
      </header>
      <main className="rs-m">
        {!t ? (
          <form action={act} className="rs-card rs-form">
            <h1>Acompanhe seu pedido</h1>
            <p>Coloque o número do pedido e o e-mail ou WhatsApp que você usou na compra.</p>
            <label>Número do pedido<input name="pedido" inputMode="numeric" placeholder="Ex.: 1234" defaultValue={pedido} required /></label>
            <label>E-mail ou WhatsApp<input name="contato" placeholder="voce@email.com ou (21) 99999-9999" required /></label>
            {r && !r.ok && <div className="rs-err">{r.error}</div>}
            <button disabled={pending}>{pending ? "Buscando..." : "Ver meu pedido"}</button>
          </form>
        ) : (
          <>
            <section className="rs-card">
              <div className="rs-top">
                <div>
                  <small>{t.first ? `Olá, ${t.first} · ` : ""}Pedido {t.order} · {fmt(t.createdAt, false)}</small>
                  <h1>{t.status}</h1>
                </div>
                {t.image && <img src={t.image} alt="" />}
              </div>
              {!t.cancelled && (
                <ol className="rs-steps">
                  {STEPS.map((s, i) => <li key={s} className={i + 1 <= t.stage ? "on" : ""}><i>{i + 1 <= t.stage ? "✓" : i + 1}</i><span>{s}</span></li>)}
                </ol>
              )}
              {t.number && (
                <div className="rs-code">
                  <div><small>{t.company ?? "Código de rastreio"}</small><b>{t.number}</b></div>
                  {t.url && <a href={t.url} target="_blank" rel="noopener">Ver na transportadora</a>}
                </div>
              )}
            </section>
            {t.events.length > 0 && (
              <section className="rs-card">
                <h2>Histórico da entrega</h2>
                <ul className="rs-tl">
                  {t.events.map((e, i) => <li key={i} className={i === 0 ? "now" : ""}><i /><div><b>{e.label}</b>{e.message && <span>{e.message}</span>}<small>{fmt(e.at)}</small></div></li>)}
                </ul>
              </section>
            )}
            <section className="rs-card">
              <h2>Itens</h2>
              {t.items.map((x, i) => <div key={i} className="rs-it"><span>{x.qty}x {x.title}</span><small>{x.variant}</small></div>)}
            </section>
            <div className="rs-acts">
              {wa && <a className="rs-wa" href={`https://wa.me/${wa.replace(/\D/g, "")}?text=${encodeURIComponent(`Oi! Quero falar sobre o pedido ${t.order}.`)}`} target="_blank" rel="noopener">Falar no WhatsApp</a>}
              {t.statusUrl && <a className="rs-ghost" href={t.statusUrl} target="_blank" rel="noopener">Detalhes do pedido</a>}
              <a className="rs-ghost" href="/rastreio">Consultar outro</a>
            </div>
          </>
        )}
      </main>
      <footer className="rs-f">{site ? <a href={site}>Voltar para a loja</a> : store}</footer>
    </div>
  );
}

const CSS = `
html,body{background:#f4f2ee!important}
.rs{min-height:100vh;background:#f4f2ee;color:#151515;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column}
.rs-h{background:#0d0f0e;padding:14px 20px;display:flex;justify-content:center}
.rs-logo{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:14px}
.rs-logo img{height:32px;width:auto}
.rs-m{flex:1;width:100%;max-width:560px;margin:0 auto;padding:22px 16px 30px;display:flex;flex-direction:column;gap:14px}
.rs-card{background:#fff;border-radius:18px;padding:22px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 30px rgba(0,0,0,.05)}
.rs-card h1{font-size:24px;letter-spacing:-.02em;line-height:1.15}
.rs-card h2{font-size:15px;margin-bottom:12px}
.rs-form{display:flex;flex-direction:column;gap:14px}
.rs-form p{color:#666;font-size:14.5px;line-height:1.5}
.rs-form label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#444}
.rs-form input{height:48px;border-radius:12px;border:1.5px solid #e2ded5;padding:0 14px;font-size:16px;outline:none;background:#fbfaf8}
.rs-form input:focus{border-color:#151515}
.rs-form button{height:50px;border:0;border-radius:12px;background:#f7c928;color:#111;font-weight:800;font-size:15.5px;cursor:pointer}
.rs-form button[disabled]{opacity:.6}
.rs-err{background:#fdecec;color:#b42318;border-radius:10px;padding:10px 12px;font-size:13.5px}
.rs-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
.rs-top small{color:#777;font-size:12.5px}
.rs-top h1{margin-top:4px}
.rs-top img{width:64px;height:64px;border-radius:12px;object-fit:cover;flex:none}
.rs-steps{list-style:none;display:grid;grid-template-columns:repeat(4,1fr);margin:22px 0 4px;position:relative;padding:0}
.rs-steps li{display:flex;flex-direction:column;align-items:center;gap:7px;text-align:center;font-size:11.5px;color:#999;position:relative}
.rs-steps li::before{content:"";position:absolute;top:14px;left:-50%;right:50%;height:3px;background:#e7e3da;z-index:0}
.rs-steps li:first-child::before{display:none}
.rs-steps li.on::before{background:#151515}
.rs-steps i{width:30px;height:30px;border-radius:50%;background:#efece5;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:800;font-size:13px;position:relative;z-index:1;color:#999}
.rs-steps li.on{color:#151515;font-weight:600}
.rs-steps li.on i{background:#151515;color:#f7c928}
.rs-code{margin-top:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px;border-radius:14px;background:#f7f5f0;flex-wrap:wrap}
.rs-code small{display:block;color:#777;font-size:12px}
.rs-code b{font-size:16px;letter-spacing:.04em}
.rs-code a{font-size:13.5px;font-weight:700;color:#151515}
.rs-tl{list-style:none;padding:0;display:flex;flex-direction:column}
.rs-tl li{display:flex;gap:12px;position:relative;padding-bottom:16px}
.rs-tl li::before{content:"";position:absolute;left:6px;top:16px;bottom:0;width:2px;background:#ebe7df}
.rs-tl li:last-child::before{display:none}
.rs-tl i{width:14px;height:14px;border-radius:50%;background:#d8d3c8;flex:none;margin-top:3px}
.rs-tl li.now i{background:#f7c928;box-shadow:0 0 0 4px rgba(247,201,40,.25)}
.rs-tl div{display:flex;flex-direction:column;gap:2px}
.rs-tl b{font-size:14px}.rs-tl span{font-size:13px;color:#555}.rs-tl small{font-size:12px;color:#999}
.rs-it{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #f0ede6;font-size:14px}
.rs-it:first-of-type{border-top:0}.rs-it small{color:#888}
.rs-acts{display:flex;flex-direction:column;gap:8px}
.rs-acts a{height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14.5px;text-decoration:none}
.rs-wa{background:#25d366;color:#fff}
.rs-ghost{background:#fff;color:#151515;border:1.5px solid #e2ded5}
.rs-f{text-align:center;padding:18px;font-size:13px;color:#888}.rs-f a{color:#555}
`;
