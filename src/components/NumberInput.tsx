"use client";
// Campo de número com botões de menos e mais, prefixo (R$) e sufixo (%, min, dias).
import { useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

const toNum = (s: string) => Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);

export function NumberInput({
  name, defaultValue, step = 1, min = 0, max, prefix, suffix, decimals = 0, width, placeholder, required, size, label,
}: {
  name: string; defaultValue?: number | string; step?: number; min?: number; max?: number; prefix?: string; suffix?: string;
  decimals?: number; width?: number; placeholder?: string; required?: boolean; size?: "sm"; label?: string;
}) {
  const show = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false });
  const start = defaultValue === undefined || defaultValue === "" ? "" : typeof defaultValue === "number" ? show(defaultValue) : String(defaultValue);
  const [v, setV] = useState(start);
  const hold = useRef<ReturnType<typeof setInterval> | null>(null);

  const bump = (dir: 1 | -1) =>
    setV((cur) => {
      const n = cur === "" ? 0 : toNum(cur);
      let next = Math.round(((isNaN(n) ? 0 : n) + dir * step) * 1000) / 1000;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      return show(next);
    });
  const press = (dir: 1 | -1) => {
    bump(dir);
    let t = 0;
    hold.current = setInterval(() => { t++; if (t > 3) bump(dir); }, 90);
  };
  const release = () => { if (hold.current) clearInterval(hold.current); hold.current = null; };
  const n = v === "" ? NaN : toNum(v);
  // largura mínima que cabe o número inteiro, o prefixo e o sufixo
  const chars = Math.max(v.length, String(placeholder ?? "").length, 3);
  const minW = (size === "sm" ? 60 : 76) + 22 + chars * (size === "sm" ? 8.5 : 9.5) + ((prefix?.length ?? 0) + (suffix?.length ?? 0)) * 7.5 + (prefix ? 4 : 0) + (suffix ? 4 : 0);

  return (
    <div className={`num-in${size === "sm" ? " sm" : ""}`} style={width ? { width, minWidth: Math.min(width, minW) } : { minWidth: minW }}>
      <button type="button" aria-label="Diminuir" disabled={!isNaN(n) && min !== undefined && n <= min}
        onPointerDown={() => press(-1)} onPointerUp={release} onPointerLeave={release}><Minus size={14} /></button>
      <div className="mid">
        {prefix && <span className="fx">{prefix}</span>}
        <input name={name} value={v} aria-label={label ?? name} placeholder={placeholder} required={required}
          inputMode={decimals ? "decimal" : "numeric"}
          onChange={(e) => setV(e.target.value.replace(decimals ? /[^\d,.]/g : /[^\d]/g, ""))}
          onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); bump(1); } if (e.key === "ArrowDown") { e.preventDefault(); bump(-1); } }} />
        {suffix && <span className="fx">{suffix}</span>}
      </div>
      <button type="button" aria-label="Aumentar" disabled={!isNaN(n) && max !== undefined && n >= max}
        onPointerDown={() => press(1)} onPointerUp={release} onPointerLeave={release}><Plus size={14} /></button>
    </div>
  );
}
