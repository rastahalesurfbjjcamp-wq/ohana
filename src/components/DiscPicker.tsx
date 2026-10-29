"use client";
// Escolha do tipo de desconto do cupom, igual à Shopify: porcentagem, valor fixo ou frete grátis (+ compra mínima)
import { useState } from "react";

export function DiscPicker({ type = "percent", value, min, compact }: { type?: string; value?: number | null; min?: number | null; compact?: boolean }) {
  const [t, setT] = useState(type === "fixed" || type === "shipping" ? type : "percent");
  const [v, setV] = useState(value != null ? String(value).replace(".", ",") : t === "fixed" ? "10" : "10");
  return (
    <div className="disc-pick" style={compact ? { gap: 6 } : undefined}>
      <div className="seg sm">
        {([["percent", "%"], ["fixed", "R$"], ["shipping", "Frete grátis"]] as const).map(([k, l]) => (
          <button key={k} type="button" className={t === k ? "on" : ""} onClick={() => setT(k)}>{l}</button>
        ))}
      </div>
      <input type="hidden" name="dtype" value={t} />
      {t !== "shipping" && (
        <span className="disc-in"><span>{t === "fixed" ? "R$" : ""}</span><input name="dvalue" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" aria-label="Valor do desconto" /><span>{t === "percent" ? "%" : ""}</span></span>
      )}
      <span className="disc-in" title="Compra mínima (opcional)"><span>mín. R$</span><input name="dmin" defaultValue={min ? String(min).replace(".", ",") : ""} placeholder="0" inputMode="decimal" aria-label="Compra mínima" style={{ width: 54 }} /></span>
    </div>
  );
}
