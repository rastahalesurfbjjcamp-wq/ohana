"use client";
// Formulário de assinatura: dados, Pix (QR Code e copia e cola) ou cartão, tudo na própria página.
import { useEffect, useRef, useState } from "react";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const only = (v: string) => v.replace(/\D/g, "");
const maskCpf = (v: string) => only(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskPhone = (v: string) => { const d = only(v).slice(0, 11); return d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3") : d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/[-(]\s*$|\(\)/g, ""); };
const maskCard = (v: string) => only(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
const maskDate = (v: string) => only(v).slice(0, 8).replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
const maskCep = (v: string) => only(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
const maskExp = (v: string) => only(v).slice(0, 4).replace(/(\d{2})(\d)/, "$1/$2");
const brandOf = (n: string) => { const d = only(n); if (/^4/.test(d)) return "VISA"; if (/^(5[1-5]|2[2-7])/.test(d)) return "MASTER"; if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(d)) return "ELO"; if (/^3[47]/.test(d)) return "AMEX"; if (/^(606282|3841)/.test(d)) return "HIPER"; return ""; };
const Lock = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;

type Pix = { emv: string; qr: string | null; expires: string };

export function SubscribeBox({ fee, ready, storeUrl, clubName }: { fee: number; ready: boolean; storeUrl: string; clubName: string }) {
  const [method, setMethod] = useState<"pix" | "cartao">("pix");
  const [f, setF] = useState({ name: "", cpf: "", phone: "", email: "", card: "", exp: "", cvv: "", holder: "" });
  const [x, setX] = useState({ birth: "", instagram: "", size: "", zip: "", street: "", number: "", extra: "", district: "", city: "", state: "" });
  const [ref, setRef] = useState("");
  const [cepBusy, setCepBusy] = useState(false);
  const setx = (k: keyof typeof x, v: string) => setX((o) => ({ ...o, [k]: v }));
  useEffect(() => { const r = new URLSearchParams(location.search).get("ref"); if (r && /^[A-Za-z0-9]{2,20}$/.test(r)) setRef(r.toUpperCase()); }, []);
  // CEP: preenche rua, bairro, cidade e UF
  const lookupCep = async (v: string) => {
    const d = only(v);
    if (d.length !== 8) return;
    setCepBusy(true);
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`).then((y) => y.json()).catch(() => null);
    setCepBusy(false);
    if (r && !r.erro) setX((o) => ({ ...o, street: r.logradouro || o.street, district: r.bairro || o.district, city: r.localidade || o.city, state: r.uf || o.state }));
  };
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<Pix | null>(null);
  const [ckId, setCkId] = useState("");
  const [done, setDone] = useState<{ code: string | null } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [left, setLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const [slow, setSlow] = useState(false);
  const [area, setArea] = useState<string | null>(null);

  // volta para a confirmação se a pessoa recarregar a página depois de pagar
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("pedido");
    if (id && /^c[a-z0-9]{20,}$/.test(id)) { setCkId(id); setDone({ code: null }); }
  }, []);
  // pagou: guarda o pedido no endereço da página
  useEffect(() => {
    if (!done || !ckId) return;
    const u = new URL(location.href);
    if (u.searchParams.get("pedido") !== ckId) { u.searchParams.set("pedido", ckId); history.replaceState(null, "", u.toString()); }
  }, [done, ckId]);
  // link da área do membro
  useEffect(() => {
    if (!done?.code || !ckId || area) return;
    fetch(`/api/clube/status?id=${ckId}`, { cache: "no-store" }).then((x) => x.json()).then((r) => r?.area && setArea(r.area)).catch(() => null);
  }, [done, ckId, area]);
  // pagou e o cupom ainda está sendo criado: pergunta a cada 3 s
  useEffect(() => {
    if (!done || done.code || !ckId) return;
    let stop = false;
    const started = Date.now();
    const check = async () => {
      if (stop) return;
      const r = await fetch(`/api/clube/status?id=${ckId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (r?.area) setArea(r.area);
      if (r?.code) { setDone({ code: r.code }); return; }
      if (Date.now() - started > 4 * 60_000) setSlow(true);
      setTimeout(check, 3000);
    };
    const t = setTimeout(check, 1500);
    return () => { stop = true; clearTimeout(t); };
  }, [done, ckId]);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  // confere o pagamento a cada 4 segundos enquanto o Pix está aberto
  useEffect(() => {
    if (!ckId || done || (!pix && !waiting)) return;
    const check = async () => {
      const r = await fetch(`/api/clube/status?id=${ckId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (r?.status === "pago") { setDone({ code: r.code ?? null }); setPix(null); setWaiting(false); }
      if (r?.status === "expirado") { setPix(null); setErr("O Pix expirou. Gere um novo."); }
      if (r?.status === "recusado") { setPix(null); setWaiting(false); setErr("O pagamento não foi aprovado. Tente de novo ou use outra forma."); }
    };
    poll.current = setInterval(check, 4000);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [ckId, pix, waiting, done]);

  useEffect(() => {
    if (!pix) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(pix.expires).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pix]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!ready) { setErr("As assinaturas abrem em breve."); return; }
    const [mm, yy] = f.exp.split("/");
    setBusy(true);
    try {
      const r = await fetch("/api/clube/assinar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.name, cpf: f.cpf, phone: f.phone, email: f.email, method, extra: { ...x, ref }, card: method === "cartao" ? { number: f.card, cvv: f.cvv, month: mm ?? "", year: yy ?? "", holder: f.holder } : undefined }),
      }).then((x) => x.json());
      if (r.id) setCkId(r.id);
      if (r.error) setErr(r.error);
      else if (r.pix) setPix(r.pix);
      else if (r.paid) setDone({ code: r.code ?? null });
      else if (r.waiting) setWaiting(true);
    } catch {
      setErr("Sem conexão. Tente de novo.");
    } finally {
      setBusy(false);
      setF((x) => ({ ...x, cvv: "" })); // o código de segurança não fica na tela
    }
  };

  if (done) {
    const first = f.name.trim().split(/\s+/)[0];
    return (
      <div className="sb-ok">
        <div className="sb-c"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 12 5 5 9-10" /></svg></div>
        <h3>Assinatura confirmada</h3>
        <p>Bem-vindo ao {clubName}{first ? `, ${first}` : ""}.{done.code ? " Este é o seu cupom de membro:" : ""}</p>
        {done.code ? (
          <>
            <div className="sb-code">{done.code}</div>
            <p style={{ fontSize: 13 }}>É um cupom único e pessoal, ligado ao seu CPF e ao seu cadastro na loja. Na hora de comprar, use o mesmo e-mail{f.email ? ` (${f.email.trim()})` : ""} que você colocou aqui.</p>
            <p style={{ fontSize: 13 }}>Daqui pra frente, comprando com a sua conta da loja, o desconto do club entra sozinho no checkout. Cada compra soma pontos que você troca por desconto. Sua camiseta do club e o patch já entraram na fila de envio.</p>
            <a className="sb-btn" style={{ marginTop: 14, textDecoration: "none" }} href={`${storeUrl.replace(/\/$/, "")}/discount/${done.code}`}>Ir para a loja com o cupom aplicado</a>
            {area && <a href={area} style={{ display: "block", marginTop: 12, fontSize: 13, color: "#1f7a3d", fontWeight: 600 }}>Ver meus pontos e resgates</a>}
          </>
        ) : (
          <div className="sb-gen" role="status" aria-live="polite">
            <div className="sb-spin" />
            <b>Gerando o seu cupom</b>
            <p>Estamos criando um cupom único só para você, ligado ao seu CPF e ao seu cadastro na loja. Pode levar até 3 minutos. Não feche esta página.</p>
            {slow && <p className="sb-note">Está demorando mais que o normal. Seu pagamento já foi confirmado e o cupom vai aparecer aqui. Se precisar sair, guarde este endereço e abra de novo depois.</p>}
          </div>
        )}
      </div>
    );
  }

  const mmss = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  const brand = brandOf(f.card);

  return (
    <>
      <form onSubmit={submit} noValidate>
        <div className="sb-st">Seus dados</div>
        <div className="sb-f"><label htmlFor="n">Nome completo</label><input id="n" className="sb-in" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} required /></div>
        <div className="sb-two">
          <div className="sb-f"><label htmlFor="cpf">CPF</label><input id="cpf" className="sb-in" inputMode="numeric" value={f.cpf} onChange={(e) => set("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" required /></div>
          <div className="sb-f"><label htmlFor="ph">WhatsApp</label><input id="ph" className="sb-in" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(21) 99999-9999" required /></div>
        </div>
        <div className="sb-f"><label htmlFor="em">E-mail (o mesmo da sua conta na loja)</label><input id="em" className="sb-in" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} required /></div>
        <div className="sb-two">
          <div className="sb-f"><label htmlFor="bd">Data de nascimento</label><input id="bd" className="sb-in" inputMode="numeric" autoComplete="bday" value={x.birth} onChange={(e) => setx("birth", maskDate(e.target.value))} placeholder="dd/mm/aaaa" required /></div>
          <div className="sb-f"><label htmlFor="ig">Seu @ do Instagram</label><input id="ig" className="sb-in" value={x.instagram} onChange={(e) => setx("instagram", e.target.value.replace(/\s/g, ""))} placeholder="@seuusuario" /></div>
        </div>

        <div className="sb-st" style={{ marginTop: 8 }}>Seu kit de boas-vindas</div>
        <div className="sb-f"><label>Tamanho da camiseta do club</label><div className="sb-sizes">{["P", "M", "G", "GG", "XG"].map((z) => <button type="button" key={z} className={x.size === z ? "sb-on" : ""} onClick={() => setx("size", z)}>{z}</button>)}</div></div>
        <div className="sb-two">
          <div className="sb-f"><label htmlFor="cep">CEP</label><input id="cep" className="sb-in" inputMode="numeric" autoComplete="postal-code" value={x.zip} onChange={(e) => { const v = maskCep(e.target.value); setx("zip", v); lookupCep(v); }} placeholder="00000-000" required /></div>
          <div className="sb-f"><label htmlFor="num">Número</label><input id="num" className="sb-in" value={x.number} onChange={(e) => setx("number", e.target.value)} required /></div>
        </div>
        <div className="sb-f"><label htmlFor="rua">Rua{cepBusy ? " (buscando...)" : ""}</label><input id="rua" className="sb-in" autoComplete="address-line1" value={x.street} onChange={(e) => setx("street", e.target.value)} required /></div>
        <div className="sb-two">
          <div className="sb-f"><label htmlFor="cpl">Complemento</label><input id="cpl" className="sb-in" autoComplete="address-line2" value={x.extra} onChange={(e) => setx("extra", e.target.value)} /></div>
          <div className="sb-f"><label htmlFor="bai">Bairro</label><input id="bai" className="sb-in" value={x.district} onChange={(e) => setx("district", e.target.value)} /></div>
        </div>
        <div className="sb-two">
          <div className="sb-f"><label htmlFor="cid">Cidade</label><input id="cid" className="sb-in" autoComplete="address-level2" value={x.city} onChange={(e) => setx("city", e.target.value)} required /></div>
          <div className="sb-f"><label htmlFor="uf">Estado (UF)</label><input id="uf" className="sb-in" autoComplete="address-level1" value={x.state} onChange={(e) => setx("state", e.target.value.toUpperCase().slice(0, 2))} placeholder="RJ" required /></div>
        </div>
        {ref && <div className="sb-note"><span>Você veio pela indicação de um membro do club.</span></div>}

        <div className="sb-st" style={{ marginTop: 8 }}>Pagamento</div>
        <div className="sb-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={method === "pix"} className={`sb-tab${method === "pix" ? " sb-on" : ""}`} onClick={() => setMethod("pix")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 4 4-4 4-4-4zM12 13l4 4-4 4-4-4zM3 12l4-4 4 4-4 4zM13 12l4-4 4 4-4 4z" /></svg>
            <div>Pix<small>todo mês</small></div>
          </button>
          <button type="button" role="tab" aria-selected={method === "cartao"} className={`sb-tab${method === "cartao" ? " sb-on" : ""}`} onClick={() => setMethod("cartao")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
            <div>Cartão<small>crédito</small></div>
          </button>
        </div>
        {method === "pix" ? (
          <div className="sb-note"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#545a56" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg><span>Você paga o primeiro mês agora com um QR Code. Nos próximos meses a cobrança chega pelo Pix.</span></div>
        ) : (
          <>
            <div className="sb-f"><label htmlFor="cn">Número do cartão</label><div className="sb-cardnum"><input id="cn" className="sb-in" inputMode="numeric" autoComplete="cc-number" value={f.card} onChange={(e) => set("card", maskCard(e.target.value))} placeholder="0000 0000 0000 0000" />{brand && <span className="sb-brand-tag">{brand}</span>}</div></div>
            <div className="sb-two">
              <div className="sb-f"><label htmlFor="ce">Validade</label><input id="ce" className="sb-in" inputMode="numeric" autoComplete="cc-exp" value={f.exp} onChange={(e) => set("exp", maskExp(e.target.value))} placeholder="MM/AA" /></div>
              <div className="sb-f"><label htmlFor="cv">CVV</label><input id="cv" className="sb-in" inputMode="numeric" autoComplete="cc-csc" value={f.cvv} onChange={(e) => set("cvv", only(e.target.value).slice(0, 4))} placeholder="123" /></div>
            </div>
            <div className="sb-f"><label htmlFor="ch">Nome impresso no cartão</label><input id="ch" className="sb-in" autoComplete="cc-name" value={f.holder} onChange={(e) => set("holder", e.target.value.toUpperCase())} /></div>
          </>
        )}
        {err && <div className="sb-err" role="alert">{err}</div>}
        <button className="sb-btn" type="submit" disabled={busy}>
          {busy ? <span className="sb-spin" /> : <Lock />}
          <span>{busy ? "Processando" : method === "pix" ? `Gerar Pix de ${money(fee)}` : waiting ? "Aguardando a aprovação" : `Assinar e pagar ${money(fee)}`}</span>
        </button>
        {waiting && <div className="sb-wait"><span className="sb-pulse" />O banco está analisando o pagamento. Esta tela atualiza sozinha.</div>}
        <div className="sb-legal">Ao assinar você aceita a cobrança mensal de {money(fee)} até cancelar.</div>
        <div className="sb-trust"><span><Lock /> Conexão criptografada</span><span>Os dados do cartão não ficam com a loja</span></div>
      </form>

      {pix && (
        <div className="sb-ov" role="dialog" aria-modal="true" aria-label="Pagamento com Pix">
          <div className="sb-modal">
            <div className="sb-mh"><div><h3>Pague {money(fee)} com Pix</h3><small>{clubName} · primeiro mês</small></div><button type="button" className="sb-x" onClick={() => setPix(null)} aria-label="Fechar">✕</button></div>
            <div className="sb-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {pix.qr ? <img src={`data:image/png;base64,${pix.qr}`} alt="QR Code do Pix" /> : null}
              <ol><li>Abra o app do seu banco</li><li>Escolha pagar com Pix e leia o código</li><li>Confirme o pagamento</li></ol>
            </div>
            <div className="sb-cc"><code>{pix.emv}</code><button type="button" onClick={() => { navigator.clipboard?.writeText(pix.emv).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => null); }}>{copied ? "Copiado" : "Copiar código"}</button></div>
            <div className="sb-wait"><span className="sb-pulse" />Esperando o pagamento. Esta tela atualiza sozinha.<span className="sb-exp">{mmss}</span></div>
          </div>
        </div>
      )}
    </>
  );
}
