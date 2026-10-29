"use client";
// Montador visual de funil: gatilho no topo, depois esperas e mensagens, cada uma com condição opcional.
import { useState } from "react";
import { ArrowDown, ArrowUp, GitBranch, ImageIcon, MessageSquare, Plus, Timer, Trash2, Zap } from "lucide-react";

export type FStep = { delayMin: number; text: string; mediaUrl?: string | null; mediaType?: string | null; cond?: string | null; _k?: number };
let seq = 1;
const UNITS: [string, number][] = [["min", 1], ["horas", 60], ["dias", 1440]];
const splitDelay = (m: number): [number, number] => (m && m % 1440 === 0 ? [m / 1440, 1440] : m && m % 60 === 0 ? [m / 60, 60] : [m, 1]);
const human = (m: number) => { const [v, u] = splitDelay(m); return m === 0 ? "Na hora" : `Esperar ${v} ${u === 1440 ? (v > 1 ? "dias" : "dia") : u === 60 ? (v > 1 ? "horas" : "hora") : "min"}`; };

export function FunnelBuilder({ id, name, trigger, active, steps: initial, triggers, conds, stats }: {
  id?: string; name: string; trigger: string; active: boolean; steps: FStep[]; triggers: Record<string, string>; conds: Record<string, string>;
  stats: { running: number; done: number; total: number };
}) {
  const [steps, setSteps] = useState<FStep[]>(() => (initial.length ? initial : [{ delayMin: 2, text: "Oi {nome}, aqui é da {loja}! Seu acesso ao Grupo VIP está aqui: {link}" }]).map((x) => ({ ...x, _k: seq++ })));
  const [trig, setTrig] = useState(trigger);
  const [sel, setSel] = useState<number | null>(null);
  const [files, setFiles] = useState<Record<number, string>>({}); // por _k
  const up = (i: number, p: Partial<FStep>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const add = (p: Partial<FStep>) => { setSteps((s) => [...s, { delayMin: 60, text: "", ...p, _k: seq++ }]); setSel(steps.length); };
  const move = (i: number, d: -1 | 1) => setSteps((s) => { const n = [...s]; const t = n[i + d]; if (!t) return s; n[i + d] = n[i]; n[i] = t; return n; });

  return (
    <div className="fb">
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="steps" value={JSON.stringify(steps.map((s) => ({ delayMin: s.delayMin, text: s.text, mediaUrl: s.mediaUrl ?? null, mediaType: s.mediaType ?? null, cond: s.cond ?? null })))} />
      <div className="fb-canvas">
        <div className="fb-node trig on">
          <div className="fb-nh"><span className="tile sm t-s"><Zap size={15} /></span> <b>Gatilho</b></div>
          <select className="fb-sel" name="trigger" value={trig} onChange={(e) => setTrig(e.target.value)}>
            {Object.entries(triggers).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="fb-foot"><span>{stats.total.toLocaleString("pt-BR")} entraram</span><span>desde o começo</span></div>
        </div>
        {steps.map((s, i) => {
          const [v, u] = splitDelay(s.delayMin);
          return (
            <div key={s._k} className="fb-step">
              <div className="fb-line" />
              <div className="fb-wait">
                <Timer size={14} />
                {s.delayMin === 0 ? "Na hora" : "Esperar"}
                <input type="number" min={0} value={v} onChange={(e) => up(i, { delayMin: Math.max(0, Number(e.target.value) || 0) * u })} />
                <select value={u} onChange={(e) => up(i, { delayMin: v * Number(e.target.value) })}>{UNITS.map(([l, m]) => <option key={m} value={m}>{l}</option>)}</select>
              </div>
              <div className="fb-line" />
              {s.cond && s.cond !== "sempre" && (
                <>
                  <div className="fb-node cond">
                    <div className="fb-nh"><span className="tile sm t-k"><GitBranch size={15} /></span> <b>Condição</b></div>
                    <select className="fb-sel" value={s.cond} onChange={(e) => up(i, { cond: e.target.value })}>{Object.entries(conds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <div className="fb-foot"><span className="up">Sim: manda</span><span className="dn">Não: pula esta</span></div>
                  </div>
                  <div className="fb-line" />
                </>
              )}
              <div className={`fb-node msg${sel === i ? " on" : ""}`} onClick={() => setSel(i)}>
                <div className="fb-nh">
                  <span className="tile sm t-l">{s.mediaUrl || files[s._k!] ? <ImageIcon size={15} /> : <MessageSquare size={15} />}</span>
                  <b>{s.mediaUrl || files[s._k!] ? "Imagem com texto" : "Mensagem no privado"}</b>
                  <span className="fb-acts">
                    <button type="button" onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0} title="Subir"><ArrowUp size={13} /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === steps.length - 1} title="Descer"><ArrowDown size={13} /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSteps((x) => x.filter((_, j) => j !== i)); }} title="Apagar"><Trash2 size={13} /></button>
                  </span>
                </div>
                <textarea value={s.text} onChange={(e) => up(i, { text: e.target.value })} placeholder="Oi {nome}, ..." rows={3} />
                <div className="fb-foot">
                  <label className="fb-file">
                    <ImageIcon size={13} /> {files[s._k!] ?? (s.mediaUrl ? "trocar imagem" : "anexar imagem")}
                    <input type="file" name={`media_${i}`} accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles((x) => ({ ...x, [s._k!]: f.name.slice(0, 18) })); }} />
                  </label>
                  {!s.cond || s.cond === "sempre" ? <button type="button" className="fb-link" onClick={() => up(i, { cond: "nao_no_grupo" })}><GitBranch size={12} /> condição</button> : <button type="button" className="fb-link" onClick={() => up(i, { cond: null })}>tirar condição</button>}
                </div>
              </div>
            </div>
          );
        })}
        <div className="fb-line" />
        <button type="button" className="fb-add" onClick={() => add({})}><Plus size={15} /> Adicionar mensagem</button>
        <div className="fb-stats">
          <div><small>Na sequência agora</small><b>{stats.running.toLocaleString("pt-BR")}</b></div>
          <div><small>Concluíram</small><b>{stats.done.toLocaleString("pt-BR")}</b></div>
          <div><small>Mensagens</small><b>{steps.length}</b></div>
        </div>
      </div>
      <aside className="fb-side">
        <div className="field"><label>Nome do funil</label><input className="in" name="name" defaultValue={name} placeholder="Pós-formulário Grupo VIP" required /></div>
        <label className="check" style={{ marginTop: 10 }}><input type="checkbox" name="active" defaultChecked={active} /> Funil ligado</label>
        <div className="ib-sec">Blocos</div>
        <div className="fb-blocks">
          <button type="button" onClick={() => add({})}><span className="tile sm t-l"><MessageSquare size={14} /></span> Texto</button>
          <button type="button" onClick={() => add({ text: "" })}><span className="tile sm t-l"><ImageIcon size={14} /></span> Imagem ou vídeo</button>
          <button type="button" onClick={() => add({ cond: "nao_no_grupo" })}><span className="tile sm t-k"><GitBranch size={14} /></span> Condição + mensagem</button>
          <button type="button" onClick={() => add({ delayMin: 1440 })}><span className="tile sm t-n"><Timer size={14} /></span> Esperar 1 dia e mandar</button>
        </div>
        <div className="ib-sec">Variáveis</div>
        <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{"{nome}"} primeiro nome · {"{link}"} grupo com vaga · {"{loja}"} nome da loja. Quem responder SAIR não recebe mais.</p>
        <div className="ib-sec">Resumo</div>
        {steps.map((s, i) => <div key={i} className="dim" style={{ fontSize: 12.5, padding: "3px 0" }}>{i + 1}. {human(s.delayMin)}{s.cond && s.cond !== "sempre" ? ` · ${conds[s.cond]?.toLowerCase()}` : ""}</div>)}
      </aside>
    </div>
  );
}
