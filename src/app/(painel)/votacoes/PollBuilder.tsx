"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";

// Pergunta e uma caixa para cada opção, com a prévia de como a enquete aparece no WhatsApp
export function PollBuilder() {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const set = (i: number, v: string) => setOpts((o) => o.map((x, k) => (k === i ? v : x)));
  const filled = opts.map((o) => o.trim()).filter(Boolean);
  const dup = new Set(filled.map((o) => o.toLowerCase())).size !== filled.length;
  return (
    <div className="pbl">
      <div className="stack" style={{ gap: 12 }}>
        <div className="field"><label>Pergunta</label><input className="in" name="question" required maxLength={255} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qual estampa entra no próximo drop?" /></div>
        <div className="field">
          <label>Opções</label>
          <div className="pb-opts">
            {opts.map((o, i) => (
              <div className="pb-opt" key={i}>
                <span className="pb-n">{i + 1}</span>
                <input className="in" name="opt" value={o} maxLength={100} onChange={(e) => set(i, e.target.value)} placeholder={`Opção ${i + 1}`} required={i < 2} />
                {opts.length > 2 && <button type="button" className="pb-x" onClick={() => setOpts((x) => x.filter((_, k) => k !== i))} aria-label={`Tirar opção ${i + 1}`}><X size={14} /></button>}
              </div>
            ))}
          </div>
          {opts.length < 12 && <button type="button" className="btn sm ghost" style={{ alignSelf: "flex-start" }} onClick={() => setOpts((x) => [...x, ""])}><Plus size={14} /> Adicionar opção</button>}
          {dup && <span className="hint" style={{ color: "var(--coral)" }}>Tem duas opções iguais. No WhatsApp elas precisam ser diferentes.</span>}
          <span className="hint">De 2 a 12 opções. Cada caixa vira um botão da enquete.</span>
        </div>
      </div>
      <div className="pb-prev">
        <small className="dim" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>Como aparece no grupo</small>
        <div className="pb-wa">
          <b>{q.trim() || "Sua pergunta aparece aqui"}</b>
          <small>Selecione uma opção</small>
          {(filled.length ? filled : ["Opção 1", "Opção 2"]).map((o, i) => (
            <div className="pb-wo" key={i}><i />{o}<span>0</span></div>
          ))}
          <div className="pb-ver">Ver votos</div>
        </div>
      </div>
    </div>
  );
}
