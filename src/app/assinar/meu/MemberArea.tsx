"use client";
// Área do membro: desconto, pontos, troca por cupom e histórico
import { useEffect, useState } from "react";
import type { MemberView } from "@/lib/clubMember";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const only = (v: string) => v.replace(/\D/g, "");
const maskCpf = (v: string) => only(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const dt = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export function MemberArea({ token }: { token: string }) {
  const [v, setV] = useState<MemberView | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cpf, setCpf] = useState("");
  const [fim, setFim] = useState("");
  const [novo, setNovo] = useState<string | null>(null);
  const [copied, setCopied] = useState("");

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
  const copy = (c: string) => navigator.clipboard?.writeText(c).then(() => { setCopied(c); setTimeout(() => setCopied(""), 1800); }).catch(() => null);
  const shop = (c: string) => `${(v?.store ?? "").replace(/\/$/, "")}/discount/${c}`;

  if (!v) {
    return (
      <form className="mc-card" onSubmit={(e) => { e.preventDefault(); load({ cpf, fim }); }}>
        <p className="mc-lede">Entre com o seu CPF e os 4 últimos números do celular que você cadastrou na assinatura.</p>
        <div className="sb-two">
          <div className="sb-f"><label htmlFor="cpf">CPF</label><input id="cpf" className="sb-in" inputMode="numeric" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" /></div>
          <div className="sb-f"><label htmlFor="fim">Final do celular</label><input id="fim" className="sb-in" inputMode="numeric" value={fim} onChange={(e) => setFim(only(e.target.value).slice(0, 4))} placeholder="0000" /></div>
        </div>
        {err && <div className="sb-err">{err}</div>}
        <button className="sb-btn" type="submit" disabled={busy}>{busy ? "Procurando..." : "Ver meu clube"}</button>
      </form>
    );
  }

  const steps = [100, 200, 300, 500, 1000].filter((p) => p >= v.minRedeem && p <= v.points).slice(0, 4);
  const toNext = 100 - (v.points % 100);
  return (
    <div className="mc-stack">
      <div className="mc-card">
        <div className="mc-row"><b className="mc-hi">Oi, {v.first}</b><span className={`mc-chip ${v.ok ? "mc-ok" : "mc-bad"}`}>{v.status}</span></div>
        {v.paidUntil && <p className="mc-dim">Assinatura paga até {new Date(v.paidUntil).toLocaleDateString("pt-BR")}</p>}
      </div>

      <div className="mc-card">
        <div className="mc-t">Seu desconto de {v.discountPct}%</div>
        <p className="mc-p">Entra sozinho no checkout quando você compra entrando na sua conta da loja, ou usando no checkout o mesmo e-mail da assinatura. Aparece como &quot;{v.club}&quot; no resumo do pedido.</p>
        {v.code && (
          <p className="mc-p mc-dim">Se por algum motivo não aparecer, use o seu cupom pessoal: <button type="button" className="mc-link" onClick={() => copy(v.code!)}>{v.code}{copied === v.code ? " (copiado)" : ""}</button></p>
        )}
        <a className="sb-btn" href={v.store} style={{ textDecoration: "none" }}>Ir para a loja</a>
      </div>

      <div className="mc-card">
        <div className="mc-t">Seus pontos</div>
        <div className="mc-pts"><b>{v.points.toLocaleString("pt-BR")}</b><span>pontos · valem {money(v.value)}</span></div>
        <div className="mc-bar"><i style={{ width: `${(v.points % 100)}%` }} /></div>
        <p className="mc-dim">Faltam {toNext} pontos para mais {money(v.valuePer100)}. Cada compra soma pontos. O desconto dos pontos soma com os seus {v.discountPct}% do clube.</p>
        {novo && (
          <div className="mc-new">
            <span>Seu cupom de resgate</span>
            <b>{novo}</b>
            <div className="mc-row" style={{ gap: 8 }}>
              <button type="button" className="mc-sbtn" onClick={() => copy(novo)}>{copied === novo ? "Copiado" : "Copiar"}</button>
              <a className="mc-sbtn pri" href={shop(novo)}>Usar na loja</a>
            </div>
            <small>Uso único, só na sua conta. Digite no campo de cupom do checkout.</small>
          </div>
        )}
        {err && <div className="sb-err">{err}</div>}
        {v.ok && steps.length > 0 ? (
          <>
            <div className="mc-st">Trocar por desconto</div>
            <div className="mc-opts">
              {steps.map((p) => (
                <button key={p} type="button" disabled={busy} className="mc-opt" onClick={() => resgatar({ points: p })}>
                  <b>{money((p / 100) * v.valuePer100)}</b><span>{p} pontos</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="mc-dim">{v.ok ? `Com ${v.minRedeem} pontos você já pode trocar por desconto.` : "Para trocar pontos, a assinatura precisa estar em dia."}</p>
        )}
        {v.prizes.length > 0 && (
          <>
            <div className="mc-st">Trocar por peças</div>
            {v.prizes.map((p) => (
              <div key={p.id} className="mc-prize">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image ? <img src={p.image} alt="" /> : <span className="mc-ph" />}
                <div><b>{p.title}</b><span>{p.points.toLocaleString("pt-BR")} pontos</span></div>
                <button type="button" className="mc-sbtn pri" disabled={!p.can || !v.ok || busy} onClick={() => resgatar({ prizeId: p.id })}>{p.can ? "Trocar" : `Faltam ${(p.points - v.points).toLocaleString("pt-BR")}`}</button>
              </div>
            ))}
          </>
        )}
      </div>

      {v.rewards.length > 0 && (
        <div className="mc-card">
          <div className="mc-t">Cupons de resgate para usar</div>
          {v.rewards.map((r) => (
            <div key={r.code} className="mc-line"><button type="button" className="mc-link" onClick={() => copy(r.code)}>{r.code}{copied === r.code ? " (copiado)" : ""}</button><span>{r.value ? money(r.value) : "peça"} · {dt(r.at)}</span></div>
          ))}
        </div>
      )}

      {v.history.length > 0 && (
        <div className="mc-card">
          <div className="mc-t">Últimos pontos</div>
          {v.history.map((h, i) => (
            <div key={i} className="mc-line"><span>{h.note}</span><b className={h.delta < 0 ? "neg" : "pos"}>{h.delta > 0 ? "+" : ""}{h.delta}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}
