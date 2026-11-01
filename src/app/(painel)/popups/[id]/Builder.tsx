"use client";
// Editor de popup com prévia ao vivo (o mesmo script que roda na loja desenha a prévia).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ImagePlus, Monitor, Plus, Smartphone, Trash2 } from "lucide-react";
import { PALETTES, type PopupCfg, type Prize } from "@/lib/popupTypes";
import { savePopup, setPopupActive } from "../../acoes14";
import { uploadPartMedia } from "../../acoes10";

type Tab = "conteudo" | "design" | "gatilho" | "publico";

export function Builder({ id, name: name0, active: active0, cfg: cfg0, lists, appUrl, store }: { id: string; name: string; active: boolean; cfg: PopupCfg; lists: { id: string; name: string }[]; appUrl: string; store: string }) {
  const router = useRouter();
  const [name, setName] = useState(name0);
  const [cfg, setCfg] = useState<PopupCfg>(cfg0);
  const [active, setActive] = useState(active0);
  const [tab, setTab] = useState<Tab>("conteudo");
  const [device, setDevice] = useState<"computador" | "celular">("computador");
  const [step, setStep] = useState<"form" | "success">("form");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [up, setUp] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  const set = (patch: Partial<PopupCfg>) => { setCfg((c) => ({ ...c, ...patch })); setDirty(true); setSaved(false); };
  const sub = <K extends "success" | "colors" | "trigger" | "audience" | "fields">(k: K, patch: Partial<PopupCfg[K]>) => { setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } })); setDirty(true); setSaved(false); };

  const srcDoc = useMemo(() => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f2ee;color:#222}
.h{height:56px;background:#fff;border-bottom:1px solid #e6e3dc;display:flex;align-items:center;justify-content:space-between;padding:0 22px;font-weight:800;letter-spacing:.08em}
.h i{display:flex;gap:16px}.h i span{width:44px;height:8px;border-radius:4px;background:#e6e3dc}
.hero{height:260px;margin:18px 22px;border-radius:14px;background:linear-gradient(120deg,#d9d3c6,#c9c1b0)}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:0 22px}.g div{aspect-ratio:3/4;border-radius:10px;background:#e6e1d6}
@media(max-width:640px){.g{grid-template-columns:repeat(2,1fr)}.hero{height:180px}}
</style></head><body><div class="h">${store.toUpperCase().replace(/[<>&]/g, "")}<i><span></span><span></span><span></span></i></div><div class="hero"></div><div class="g"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
<script>window.RH_PREVIEW=${JSON.stringify({ cfg: cfg0, step: "form", device: "computador" }).replace(/</g, "\\u003c")};</script><script src="/api/popups/script.js?v=${Date.now()}"></script></body></html>`,
    // a prévia é montada uma vez; as mudanças vão por mensagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  useEffect(() => {
    const send = () => frame.current?.contentWindow?.postMessage({ rhPreview: { cfg, step, device } }, "*");
    send();
    const t = setTimeout(send, 400);
    return () => clearTimeout(t);
  }, [cfg, step, device]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const save = async () => { setBusy(true); await savePopup(id, name, cfg); setBusy(false); setDirty(false); setSaved(true); router.refresh(); };
  const toggle = async () => {
    const next = !active;
    if (next && !confirm("Ligar o popup no site? Ele aparece para os visitantes assim que o script estiver no tema.")) return;
    if (dirty) await savePopup(id, name, cfg);
    await setPopupActive(id, next); setActive(next); setDirty(false); router.refresh();
  };
  const upload = async (file: File) => {
    setUp(true);
    const fd = new FormData(); fd.append("file", file);
    const r = await uploadPartMedia(fd);
    setUp(false);
    if (r.ok) set({ image: r.url.replace(/^.*\/api\/media\//, `${appUrl.replace(/\/$/, "")}/api/media/`), imagePos: cfg.imagePos === "nenhuma" ? "esquerda" : cfg.imagePos });
  };
  const prizes = cfg.game?.prizes ?? [];
  const setPrize = (i: number, p: Partial<Prize>) => set({ game: { type: cfg.game!.type, prizes: prizes.map((x, k) => (k === i ? { ...x, ...p } : x)) } });
  const totalW = prizes.reduce((s, p) => s + (p.weight || 0), 0);

  return (
    <div className="pu-ed">
      <div className="pu-top">
        <Link className="btn sm ghost" href="/popups"><ArrowLeft size={15} /></Link>
        <input className="in pu-name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
        <span className={`pu-dot${active ? " on" : ""}`} /><small className="dim">{active ? "Ligado no site" : "Desligado"}</small>
        <div className="row" style={{ gap: 8, marginLeft: "auto" }}>
          <button className="btn sm" onClick={toggle}>{active ? "Desligar" : "Ligar no site"}</button>
          <button className="btn sm pri" onClick={save} disabled={busy}>{busy ? "Salvando..." : saved && !dirty ? <><Check size={14} /> Salvo</> : "Salvar"}</button>
        </div>
      </div>
      <div className="pu-body">
        <aside className="pu-side">
          <div className="seg pu-tabs">
            {([["conteudo", "Conteúdo"], ["design", "Design"], ["gatilho", "Quando"], ["publico", "Onde e quem"]] as [Tab, string][]).map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
          </div>

          {tab === "conteudo" && (
            <div className="stack" style={{ gap: 12 }}>
              <h4 className="pu-h">Antes do cadastro</h4>
              <label className="cv-field">Título<input className="in" value={cfg.title} onChange={(e) => set({ title: e.target.value })} onFocus={() => setStep("form")} /></label>
              <label className="cv-field">Texto<textarea className="in" rows={3} value={cfg.text} onChange={(e) => set({ text: e.target.value })} onFocus={() => setStep("form")} /></label>
              <div className="pu-2">
                <label className="cv-field">Botão<input className="in" value={cfg.button} onChange={(e) => set({ button: e.target.value })} /></label>
                <label className="cv-field">Link para fechar<input className="in" value={cfg.dismiss ?? ""} placeholder="Sem link" onChange={(e) => set({ dismiss: e.target.value })} /></label>
              </div>
              <div className="cv-field">Campos
                <div className="pu-checks">
                  <label><input type="checkbox" checked disabled /> WhatsApp</label>
                  <label><input type="checkbox" checked={cfg.fields.name} onChange={(e) => sub("fields", { name: e.target.checked })} /> Nome</label>
                  <label><input type="checkbox" checked={cfg.fields.email} onChange={(e) => sub("fields", { email: e.target.checked })} /> E-mail</label>
                  <label><input type="checkbox" checked={cfg.fields.birthday} onChange={(e) => sub("fields", { birthday: e.target.checked })} /> Aniversário</label>
                </div>
              </div>
              <label className="cv-field">Aviso de consentimento<input className="in" value={cfg.consent ?? ""} onChange={(e) => set({ consent: e.target.value })} /></label>
              <label className="cv-field">Contagem regressiva (minutos)<input className="in" type="number" min={0} max={240} value={cfg.countdownMin ?? 0} onChange={(e) => set({ countdownMin: Number(e.target.value) || undefined })} /><small className="dim">0 para não mostrar. O relógio continua de onde parou se a pessoa voltar.</small></label>

              <div className="cv-field">Jogo
                <div className="seg" style={{ alignSelf: "flex-start" }}>
                  {([["", "Nenhum"], ["roleta", "Roleta"], ["raspadinha", "Raspadinha"]] as const).map(([k, l]) => (
                    <button key={k} type="button" className={(cfg.game?.type ?? "") === k ? "on" : ""} onClick={() => set({ game: k ? { type: k, prizes: prizes.length ? prizes : [{ label: "10% off", code: "PREMIO10", weight: 60 }, { label: "Frete grátis", code: "FRETE", weight: 40 }] } : undefined })}>{l}</button>
                  ))}
                </div>
              </div>
              {cfg.game && (
                <div className="pu-prizes">
                  <div className="pu-pr pu-prh"><span>Prêmio</span><span>Cupom</span><span>Chance</span><span /></div>
                  {prizes.map((p, i) => (
                    <div key={i} className="pu-pr">
                      <input className="in" value={p.label} onChange={(e) => setPrize(i, { label: e.target.value })} />
                      <input className="in" value={p.code} onChange={(e) => setPrize(i, { code: e.target.value.toUpperCase().replace(/\s/g, "") })} />
                      <span className="pu-w"><input className="in" type="number" min={0} value={p.weight} onChange={(e) => setPrize(i, { weight: Number(e.target.value) || 0 })} /><small>{totalW ? Math.round((p.weight / totalW) * 100) : 0}%</small></span>
                      <button className="cv-ib" type="button" onClick={() => set({ game: { type: cfg.game!.type, prizes: prizes.filter((_, k) => k !== i) } })} disabled={prizes.length <= 2}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {prizes.length < 8 && <button className="btn sm ghost" type="button" onClick={() => set({ game: { type: cfg.game!.type, prizes: [...prizes, { label: "Novo prêmio", code: "CUPOM", weight: 10 }] } })}><Plus size={13} /> Prêmio</button>}
                  <small className="dim">Crie os cupons na Shopify com os mesmos códigos. O prêmio é sorteado no servidor, depois do cadastro.</small>
                </div>
              )}

              <h4 className="pu-h">Depois do cadastro</h4>
              <label className="cv-field">Título<input className="in" value={cfg.success.title} onChange={(e) => sub("success", { title: e.target.value })} onFocus={() => setStep("success")} /></label>
              <label className="cv-field">Texto<textarea className="in" rows={2} value={cfg.success.text} onChange={(e) => sub("success", { text: e.target.value })} onFocus={() => setStep("success")} /></label>
              {!cfg.game && <label className="cv-field">Cupom<input className="in" value={cfg.success.coupon ?? ""} placeholder="Sem cupom" onChange={(e) => sub("success", { coupon: e.target.value.toUpperCase().replace(/\s/g, "") })} onFocus={() => setStep("success")} /></label>}
              <div className="pu-2">
                <label className="cv-field">Botão<input className="in" value={cfg.success.button} onChange={(e) => sub("success", { button: e.target.value })} onFocus={() => setStep("success")} /></label>
                <label className="cv-field">Link do botão<input className="in" value={cfg.success.link ?? ""} placeholder="Só fecha" onChange={(e) => sub("success", { link: e.target.value || undefined })} /></label>
              </div>
            </div>
          )}

          {tab === "design" && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="cv-field">Formato
                <div className="pu-lays">
                  {([["centro", "Centro"], ["lateral", "Canto"], ["tela", "Tela cheia"], ["barra", "Faixa no topo"]] as const).map(([k, l]) => (
                    <button key={k} type="button" className={`pu-lay pu-lay-${k}${cfg.layout === k ? " on" : ""}`} onClick={() => set({ layout: k })}><span><i /></span>{l}</button>
                  ))}
                </div>
              </div>
              <div className="cv-field">Cores prontas
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {PALETTES.map((p) => <button key={p.k} type="button" className="pu-pal" title={p.label} onClick={() => set({ colors: p.colors })} style={{ background: p.colors.bg, borderColor: cfg.colors.bg === p.colors.bg && cfg.colors.accent === p.colors.accent ? "#fff" : undefined }}><i style={{ background: p.colors.accent }} /></button>)}
                </div>
              </div>
              <div className="pu-colors">
                {([["bg", "Fundo"], ["text", "Texto"], ["accent", "Botão"], ["accentText", "Texto do botão"]] as const).map(([k, l]) => (
                  <label key={k}><input type="color" value={cfg.colors[k]} onChange={(e) => sub("colors", { [k]: e.target.value })} />{l}</label>
                ))}
              </div>
              <label className="cv-field">Cantos arredondados: {cfg.radius}px<input type="range" min={0} max={28} value={cfg.radius} onChange={(e) => set({ radius: Number(e.target.value) })} /></label>
              <label className="cv-field">Escurecer o fundo: {cfg.dim}%<input type="range" min={0} max={85} value={cfg.dim} onChange={(e) => set({ dim: Number(e.target.value) })} /></label>
              <div className="cv-field">Imagem
                {cfg.image ? (
                  <div className="row" style={{ gap: 10 }}>
                    <img src={cfg.image} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10 }} />
                    <select className="in" value={cfg.imagePos ?? "esquerda"} onChange={(e) => set({ imagePos: e.target.value as PopupCfg["imagePos"] })}><option value="esquerda">Ao lado</option><option value="topo">Em cima</option><option value="nenhuma">Esconder</option></select>
                    <button className="cv-ib" type="button" onClick={() => set({ image: undefined })}><Trash2 size={14} /></button>
                  </div>
                ) : (
                  <label className="btn sm" style={{ alignSelf: "flex-start", cursor: "pointer" }}><ImagePlus size={14} /> {up ? "Enviando..." : "Escolher imagem"}<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} /></label>
                )}
              </div>
            </div>
          )}

          {tab === "gatilho" && (
            <div className="stack" style={{ gap: 12 }}>
              {cfg.layout === "barra" ? <div className="note">A faixa aparece assim que a página abre. Quem clica no botão vê o cadastro.</div> : (
                <div className="pu-when">
                  {([["imediato", "Assim que abre a página"], ["segundos", "Depois de alguns segundos"], ["rolagem", "Quando rola a página"], ["saida", "Quando vai sair do site"], ["inatividade", "Quando fica parado"]] as const).map(([k, l]) => (
                    <label key={k} className={cfg.trigger.when === k ? "on" : ""}>
                      <input type="radio" name="when" checked={cfg.trigger.when === k} onChange={() => sub("trigger", { when: k })} />
                      <span>{l}
                        {cfg.trigger.when === k && (k === "segundos" || k === "inatividade") && <span className="row" style={{ gap: 6, marginTop: 6 }}><input className="in" type="number" min={1} max={300} style={{ width: 80 }} value={cfg.trigger.seconds} onChange={(e) => sub("trigger", { seconds: Number(e.target.value) || 1 })} /> segundos</span>}
                        {cfg.trigger.when === k && k === "rolagem" && <span className="row" style={{ gap: 6, marginTop: 6 }}><input className="in" type="number" min={5} max={100} style={{ width: 80 }} value={cfg.trigger.scrollPct} onChange={(e) => sub("trigger", { scrollPct: Number(e.target.value) || 40 })} /> % da página</span>}
                        {cfg.trigger.when === k && k === "saida" && <small className="dim" style={{ display: "block", marginTop: 4 }}>No computador, quando o mouse vai para fechar a aba. No celular, quando rola rápido para cima.</small>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <label className="cv-field">Mostrar de novo depois de (dias)<input className="in" type="number" min={0} max={90} value={cfg.trigger.freqDays} onChange={(e) => sub("trigger", { freqDays: Number(e.target.value) || 0 })} /><small className="dim">Se a pessoa fechar sem se cadastrar.</small></label>
              <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={cfg.trigger.hideConverted} onChange={(e) => sub("trigger", { hideConverted: e.target.checked })} /> Não mostrar para quem já se cadastrou</label>
            </div>
          )}

          {tab === "publico" && (
            <div className="stack" style={{ gap: 12 }}>
              <div className="cv-field">Aparelho
                <div className="seg" style={{ alignSelf: "flex-start" }}>
                  {([["todos", "Todos"], ["celular", "Celular"], ["computador", "Computador"]] as const).map(([k, l]) => <button key={k} type="button" className={cfg.audience.device === k ? "on" : ""} onClick={() => sub("audience", { device: k })}>{l}</button>)}
                </div>
              </div>
              <label className="cv-field">Só nestas páginas<input className="in" value={cfg.audience.include} placeholder="Todas. Ex.: /collections/*, /products/*" onChange={(e) => sub("audience", { include: e.target.value })} /></label>
              <label className="cv-field">Nunca nestas páginas<input className="in" value={cfg.audience.exclude} onChange={(e) => sub("audience", { exclude: e.target.value })} /><small className="dim">Separe por vírgula. Use * para qualquer coisa.</small></label>
              <div className="pu-2">
                <label className="cv-field">Começa em<input className="in" type="datetime-local" value={cfg.audience.start ?? ""} onChange={(e) => sub("audience", { start: e.target.value || undefined })} /></label>
                <label className="cv-field">Termina em<input className="in" type="datetime-local" value={cfg.audience.end ?? ""} onChange={(e) => sub("audience", { end: e.target.value || undefined })} /></label>
              </div>
              <h4 className="pu-h">Quem se cadastra</h4>
              <label className="cv-field">Entra na lista<select className="in" value={cfg.listId ?? ""} onChange={(e) => set({ listId: e.target.value || undefined })}><option value="">Nenhuma</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
              <label className="cv-field">Recebe a etiqueta<input className="in" value={cfg.tag ?? ""} placeholder="Ex.: popup-roleta" onChange={(e) => set({ tag: e.target.value || undefined })} /></label>
              <div className="note" style={{ fontSize: 12.5 }}>Todo cadastro vira lead e dispara as automações com o gatilho <b>Lead inserido</b> (só as que estiverem ligadas). Ali você monta a mensagem de boas-vindas com o cupom.</div>
            </div>
          )}
        </aside>

        <section className="pu-prev">
          <div className="pu-prevbar">
            <div className="seg">
              <button className={step === "form" ? "on" : ""} onClick={() => setStep("form")}>Cadastro</button>
              <button className={step === "success" ? "on" : ""} onClick={() => setStep("success")}>Depois do cadastro</button>
            </div>
            <div className="seg">
              <button className={device === "computador" ? "on" : ""} onClick={() => setDevice("computador")} title="Computador"><Monitor size={15} /></button>
              <button className={device === "celular" ? "on" : ""} onClick={() => setDevice("celular")} title="Celular"><Smartphone size={15} /></button>
            </div>
          </div>
          <div className={`pu-stage ${device}`}>
            <iframe ref={frame} srcDoc={srcDoc} title="Prévia" onLoad={() => frame.current?.contentWindow?.postMessage({ rhPreview: { cfg, step, device } }, "*")} />
          </div>
          <small className="dim" style={{ textAlign: "center" }}>Prévia de verdade: dá para preencher, girar a roleta e raspar. Nada é gravado aqui.</small>
        </section>
      </div>
    </div>
  );
}
