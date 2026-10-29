"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label = "Copiar", className = "btn" }: { text: string; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); } catch {} }}>
      {ok ? <Check size={15} /> : <Copy size={15} />} {ok ? "Copiado" : label}
    </button>
  );
}
