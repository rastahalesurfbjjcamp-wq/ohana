"use client";
// Gera um link com UTM para colar no anúncio, na bio ou no grupo.
import { useState } from "react";
import { Link2, X } from "lucide-react";
import { CopyButton } from "./CopyButton";

const PRESETS: Record<string, [string, string]> = { meta: ["meta", "paid"], bio: ["instagram", "bio"], grupo: ["whatsapp", "grupo"], tiktok: ["tiktok", "paid"], email: ["email", "newsletter"] };

export function UtmBuilder({ store }: { store: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(store);
  const [p, setP] = useState("meta");
  const [camp, setCamp] = useState("");
  const [src, med] = PRESETS[p];
  const link = `${url.replace(/\/$/, "")}${url.includes("?") ? "&" : "?"}utm_source=${src}&utm_medium=${med}${camp ? `&utm_campaign=${encodeURIComponent(camp.trim().toLowerCase().replace(/\s+/g, "_"))}` : p === "meta" ? "&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}" : ""}`;
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)}><Link2 size={16} /> Gerar link com UTM</button>
      {open && (
        <div className="dtf-pop" style={{ right: 0, left: "auto", width: 420 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}><b>Link com UTM</b><button type="button" className="menu-b" onClick={() => setOpen(false)}><X size={15} /></button></div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="field"><label>Página</label><input className="in" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
            <div className="seg" style={{ flexWrap: "wrap" }}>{[["meta", "Anúncio Meta"], ["bio", "Bio"], ["grupo", "Grupo"], ["tiktok", "TikTok"], ["email", "E-mail"]].map(([k, l]) => <button type="button" key={k} className={p === k ? "on" : ""} onClick={() => setP(k)}>{l}</button>)}</div>
            <div className="field"><label>Nome da campanha {p === "meta" ? "(vazio usa o id do Meta)" : ""}</label><input className="in" value={camp} onChange={(e) => setCamp(e.target.value)} placeholder="black_friday" /></div>
            <div className="code" style={{ fontSize: 12, wordBreak: "break-all" }}>{link}</div>
            <CopyButton text={link} className="btn pri" label="Copiar link" />
          </div>
        </div>
      )}
    </div>
  );
}
