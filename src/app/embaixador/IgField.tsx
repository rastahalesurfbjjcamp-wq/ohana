"use client";
import { useState } from "react";
import { ExternalLink } from "lucide-react";

const clean = (v: string) => v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?].*$/, "").replace(/^@+/, "").toLowerCase();

// @ do Instagram: só aceita formato válido e pede para a pessoa abrir o perfil e confirmar que é o dela
export function IgField() {
  const [v, setV] = useState("");
  const ig = clean(v);
  const valid = /^[a-z0-9._]{2,30}$/.test(ig) && !ig.startsWith(".") && !ig.endsWith(".") && !ig.includes("..");
  return (
    <div className="field">
      <label htmlFor="ig">@ do Instagram</label>
      <div className="pre em-pre">@<input className="in" id="ig" name="instagram" value={v} onChange={(e) => setV(e.target.value)} placeholder="seuarroba" autoCapitalize="none" autoCorrect="off" spellCheck={false} required /></div>
      {ig && !valid && <span className="hint" style={{ color: "var(--coral)" }}>Use só letras, números, ponto e sublinhado, sem espaço.</span>}
      {valid && (
        <div className="em-igok">
          <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener"><ExternalLink size={13} /> Abrir instagram.com/{ig}</a>
          <label><input type="checkbox" name="igok" required /> Conferi, esse é o meu perfil</label>
        </div>
      )}
    </div>
  );
}
