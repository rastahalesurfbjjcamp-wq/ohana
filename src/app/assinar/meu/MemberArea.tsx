"use client";
// Área do membro do club: entrada com CPF e, depois de entrar, desconto, loja do club, pontos, eventos e indicação
import { useEffect, useState } from "react";
import type { MemberView } from "@/lib/clubMember";

export type Portal = {
  club: string;
  logo: string;
  discountPct: number;
  members: { img: string; cat: string; ig: string }[];
  shop: { title: string; tag: string; img: string }[];
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const only = (v: string) => v.replace(/\D/g, "");
const maskCpf = (v: string) => only(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const dt = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function Brand({ logo, club }: { logo: string; club: string }) {
  return (
    <div className="rc-brand">
      <div className="rc-rh">
        <small>SURF &amp; BJJ</small>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lion.png" alt="" />
        <b>RASTA HALE</b>
      </div>
      <span className="rc-x">×</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="rc-flag" src={logo} alt={club} />
    </div>
  );
}

export function MemberArea({ token, portal }: { token: string; portal: Portal }) {
  const [v, setV] = useState<MemberView | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cpf, setCpf] = useState("");
  const [fim, setFim] = useState("");
  const [novo, setNovo] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [slide, setSlide] = useState(0);

  const load = async (body: Record<string, string>) => {
    setBusy(true); setErr("");
    const r = await fetch("/api/clube/meu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => ({ error: "Sem conexão. Tente de novo." }));
    setBusy(false);
    if (r.error) setErr(r.error); else { setV(r); const u = new URL(location.href); u.searchParams.set("t", r.token); history.replaceState(null, "", u.toString()); }
  };
  useEffect(() => { if (token) load({ t: token }); }, [token]);

  const resgatar = async (body: { points?: number; prizeId?: string }) => {
    if (!v) return;
    setBusy(true); setErr(""); setNovo(null);
    const r = await fetch("/api/clube/resgatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: v.token, ...body }) }).then((x) => x.json()).catch(() => ({ error: "Sem conexão. Tente de novo." }));
    setBusy(false);
    if (r.error) setErr(r.error); else { setNovo(r.code); setV(r.view); }
  };
  const entrar = async (meetId: string, title: string, pts: number) => {
    if (!v || !confirm(pts ? `Trocar ${pts} pontos pela entrada em ${title}?` : `Confirmar sua presença em ${title}?`)) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/clube/evento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: v.token, meetId }) }).then((x) => x.json()).catch(() => ({ error: "Sem conexão. Tente de novo." }));
    setBusy(false);
    if (r.error) setErr(r.error); else setV(r.view);
  };
  const copy = (c: string) => navigator.clipboard?.writeText(c).then(() => { setCopied(c); setTimeout(() => setCopied(""), 1800); }).catch(() => null);
  const shopUrl = (c: string) => `${(v?.store ?? "").replace(/\/$/, "")}/discount/${c}`;

  /* ---------- Entrar ---------- */
  if (!v) {
    const perks = [
      [`${portal.discountPct}% em toda a loja`, "Entra sozinho no checkout"],
      ["Lançamentos antecipados e produtos exclusivos", "Na Loja do Club"],
      ["Sistema de pontos", "Compre, acumule e troque por crédito"],
      ["Eventos e open mats", "Entrada gratuita"],
    ];
    return (
      <div className="rc-card">
        <Brand logo={portal.logo} club={portal.club} />
        <p className="rc-kick">Área do membro</p>
        <h1 className="rc-h">{portal.club}</h1>
        <p className="rc-sub">Entre para ver seu desconto, seus pontos e os lançamentos antecipados.</p>
        <form className="rc-form" onSubmit={(e) => { e.preventDefault(); load({ cpf, fim }); }}>
          <label htmlFor="cpf">CPF</label>
          <input id="cpf" className="rc-in" inputMode="numeric" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" />
          <label htmlFor="fim">Final do celular</label>
          <input id="fim" className="rc-in" inputMode="numeric" value={fim} onChange={(e) => setFim(only(e.target.value).slice(0, 4))} placeholder="0000" />
          {err && <div className="rc-err">{err}</div>}
          <button className="rc-btn" type="submit" disabled={busy}>{busy ? "Procurando..." : "Ver meu clube"}</button>
          <p className="rc-hint">Use os 4 últimos números do celular da assinatura.</p>
        </form>

        <div className="rc-sep" />
        <h2 className="rc-h2">Faça parte do clube</h2>
        <ol className="rc-perks">
          {perks.map(([t, s], i) => <li key={i}><span>{i + 1}</span><div><b>{t}</b><small>{s}</small></div></li>)}
        </ol>

        {portal.members.length > 0 && (
          <>
            <h3 className="rc-h3">Integrantes:</h3>
            <div className="rc-strip" onScroll={(e) => { const el = e.currentTarget; setSlide(Math.round(el.scrollLeft / 141)); }}>
              {portal.members.map((m, i) => (
                <a key={i} className="rc-mem" href={m.ig ? `https://instagram.com/${m.ig.replace(/^@/, "")}` : undefined} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.img} alt={m.ig} loading="lazy" />
                  <small>{m.cat.toUpperCase()}</small>
                  <b>{m.ig}</b>
                </a>
              ))}
            </div>
            {portal.members.length > 2 && <div className="rc-dots">{portal.members.map((_, i) => <i key={i} className={i === Math.min(slide, portal.members.length - 1) ? "on" : ""} />)}</div>}
          </>
        )}
        <a className="rc-btn rc-ghost" href="/assinar">Ainda não sou membro</a>
      </div>
    );
  }

  /* ---------- Membro logado ---------- */
  const step = (Math.floor(v.points / 100) + 1) * 100;
  const toNext = step - v.points;
  const opts = [100, 200, 500].filter((p) => p >= v.minRedeem || p === 500);
  const nextLabel = v.nextTier ? (v.nextPerks.join(" ").toLowerCase().includes("camiseta") ? "camiseta" : "próximo nível") : "";
  return (
    <div className="rc-card">
      <Brand logo={portal.logo} club={portal.club} />
      <p className="rc-kick">Área do membro</p>
      <h1 className="rc-h">Oi, {v.first}</h1>
      <p className="rc-sub">Bem-vindo ao {v.club}.</p>

      <div className="rc-box rc-me">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portal.logo} alt="" />
        <div>
          <b>{v.name ?? v.first}</b>
          <small>{v.months ? `Membro há ${v.months} ${v.months === 1 ? "mês" : "meses"}` : "Membro novo"} · nível {v.tierName}</small>
          <span className={`rc-chip ${v.ok ? "is-ok" : "is-bad"}`}>{v.ok ? "Assinatura em dia" : v.status}</span>
        </div>
      </div>

      <div className="rc-stats">
        <div><b>{v.discountPct}%</b><span>desconto</span></div>
        <div><b>{v.points.toLocaleString("pt-BR")}</b><span>pontos</span></div>
        <div>{v.nextTier ? <><b>{v.monthsToNext}</b><span>{v.monthsToNext === 1 ? "mês" : "meses"} p/ {nextLabel}</span></> : <><b>{v.months}</b><span>meses no club</span></>}</div>
      </div>

      {v.kit && v.kit.status !== "enviado" && (
        <div className="rc-box rc-note">Seu kit de boas-vindas {v.kit.orderName ? `(pedido ${v.kit.orderName}) já está na expedição.` : "está sendo separado para envio."}</div>
      )}

      <h2 className="rc-h2">Seu desconto</h2>
      <p className="rc-s2">{v.usesPerMonth ? `${v.discountPct}% em até ${v.usesPerMonth} compras por mês. ` : ""}Entra sozinho no checkout quando você compra logado na loja.</p>
      {v.code && (
        <div className="rc-box">
          <p className="rc-p">Se não aparecer, use o seu cupom pessoal:</p>
          <div className="rc-code"><code>{v.code}</code><button type="button" onClick={() => copy(v.code!)}>{copied === v.code ? "Copiado" : "Copiar"}</button></div>
        </div>
      )}

      {v.birthday && (
        <div className="rc-box rc-bday">
          <b>Feliz aniversário!</b>
          <p className="rc-p">{v.birthday.pct}% de desconto em uma compra{v.birthday.until ? ` até ${dt(v.birthday.until)}` : ""}.</p>
          <div className="rc-code"><code>{v.birthday.code}</code><button type="button" onClick={() => copy(v.birthday!.code)}>{copied === v.birthday.code ? "Copiado" : "Copiar"}</button></div>
        </div>
      )}

      <h2 className="rc-h2">Loja do Club</h2>
      <p className="rc-s2">Lançamentos antecipados e produtos exclusivos.</p>
      {portal.shop.length > 0 && (
        <div className="rc-shop">
          {portal.shop.slice(0, 3).map((p, i) => (
            <div key={i} className="rc-prod">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.img && <img src={p.img} alt="" loading="lazy" />}
              {p.tag && <span>{p.tag}</span>}
              <b>{p.title}</b>
            </div>
          ))}
        </div>
      )}
      <a className="rc-btn" href={v.earlyLink || v.store}>Abrir a Loja do Club</a>
      {v.links.length > 0 && <div className="rc-links">{v.links.map((l) => <a key={l.tier} href={l.url}>Coleção {l.tier} meses</a>)}</div>}

      <h2 className="rc-h2">Sistema de pontos</h2>
      <p className="rc-s2">Compre, acumule e troque por crédito.</p>
      <div className="rc-box">
        <div className="rc-pts"><b>{v.points.toLocaleString("pt-BR")}</b><span>pontos · valem {money(v.value)}</span></div>
        <div className="rc-bar"><i style={{ width: `${Math.min(100, (v.points / step) * 100)}%` }} /></div>
        <p className="rc-tiny">Faltam {toNext} pontos para mais {money(v.valuePer100)}.</p>
        {novo && (
          <div className="rc-new">
            <small>Seu cupom de resgate</small>
            <div className="rc-code"><code>{novo}</code><button type="button" onClick={() => copy(novo)}>{copied === novo ? "Copiado" : "Copiar"}</button></div>
            <a href={shopUrl(novo)}>Usar na loja</a>
          </div>
        )}
        {err && <div className="rc-err">{err}</div>}
        <div className="rc-opts">
          {opts.map((p) => (
            <button key={p} type="button" disabled={busy || !v.ok || v.points < p} onClick={() => resgatar({ points: p })}>
              <b>{money((p / 100) * v.valuePer100)}</b><span>{p} pts</span>
            </button>
          ))}
        </div>
        {!v.ok && <p className="rc-tiny">Para trocar pontos, a assinatura precisa estar em dia.</p>}
        {v.prizes.length > 0 && v.prizes.map((p) => (
          <div key={p.id} className="rc-prize">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image ? <img src={p.image} alt="" /> : <i />}
            <div><b>{p.title}</b><small>{p.points.toLocaleString("pt-BR")} pts</small></div>
            <button type="button" disabled={!p.can || !v.ok || busy} onClick={() => resgatar({ prizeId: p.id })}>{p.can ? "Trocar" : `Faltam ${(p.points - v.points).toLocaleString("pt-BR")}`}</button>
          </div>
        ))}
      </div>

      {v.meets.length > 0 && (
        <>
          <h2 className="rc-h2">Eventos e open mats</h2>
          <p className="rc-s2">{v.meets.every((e) => !e.points) ? "Entrada gratuita para membros." : "Garanta sua entrada pelo portal."}</p>
          <div className="rc-evs">
            {v.meets.map((e) => (
              <div key={e.id} className="rc-ev">
                <div><b>{e.title}</b><small>{dt(e.date)}{e.place ? ` · ${e.place}` : ""}</small></div>
                {e.mine ? <span className="rc-chip is-ok">Você vai</span>
                  : <button type="button" className="rc-chip is-ok" disabled={busy || !v.ok || !e.left || v.points < e.points} onClick={() => entrar(e.id, e.title, e.points)}>{e.points ? `${e.points} pts` : "Grátis"}</button>}
              </div>
            ))}
          </div>
        </>
      )}

      {v.refLink && (
        <>
          <h2 className="rc-h2">Indique e ganhe</h2>
          <p className="rc-s2">Você ganha parte da mensalidade de quem entrar pelo seu link.</p>
          {v.refActive > 0 && <p className="rc-tiny">{v.refActive} indicado{v.refActive > 1 ? "s" : ""} ativo{v.refActive > 1 ? "s" : ""} · {money(v.refMonthly)} por mês</p>}
          <a className="rc-btn rc-ghost" href={`https://wa.me/?text=${encodeURIComponent(`Assina o ${v.club} comigo: desconto, pontos, eventos e a camiseta exclusiva do club. ${v.refLink}`)}`}>Compartilhar no WhatsApp</a>
        </>
      )}

      {v.rewards.length > 0 && (
        <>
          <h2 className="rc-h2">Seus cupons</h2>
          <div className="rc-evs">
            {v.rewards.map((r) => (
              <div key={r.code} className="rc-ev"><div><b>{r.code}</b><small>{r.value ? money(r.value) : "peça"} · {dt(r.at)}</small></div><button type="button" className="rc-chip" onClick={() => copy(r.code)}>{copied === r.code ? "Copiado" : "Copiar"}</button></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
