"use client";
// Barra da tabela de produtos: marcar todos, aplicar um custo nos selecionados e salvar os custos digitados.
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

export function SelectAll() {
  return (
    <input type="checkbox" aria-label="Selecionar todos" onChange={(e) => {
      const form = e.currentTarget.closest("form");
      form?.querySelectorAll<HTMLInputElement>("input[name=sel]").forEach((c) => { c.checked = e.currentTarget.checked; c.closest("tr")?.classList.toggle("sel", c.checked); });
      form?.dispatchEvent(new Event("input", { bubbles: true }));
    }} />
  );
}

export function CostTableBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState(0);
  const [dirty, setDirty] = useState(0);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const count = () => {
      const boxes = form.querySelectorAll<HTMLInputElement>("input[name=sel]");
      boxes.forEach((c) => c.closest("tr")?.classList.toggle("sel", c.checked));
      setSel(Array.from(boxes).filter((c) => c.checked).length);
      setDirty(Array.from(form.querySelectorAll<HTMLInputElement>("input.cost-in")).filter((i) => i.value.trim() !== (i.dataset.orig ?? "")).length);
    };
    form.addEventListener("input", count);
    form.addEventListener("change", count);
    return () => { form.removeEventListener("input", count); form.removeEventListener("change", count); };
  }, []);
  if (!sel && !dirty) return <div ref={ref} />;
  return (
    <div ref={ref} className="bulkbar">
      {sel > 0 && (
        <>
          <b style={{ fontSize: 13.5 }}>{sel} selecionado{sel > 1 ? "s" : ""}</b>
          <span className="dim" style={{ fontSize: 13 }}>custo por peça</span>
          <span className="row" style={{ gap: 4 }}><span className="dim">R$</span><input className="cost-in" name="bulk" inputMode="decimal" placeholder="0,00" /></span>
          <button className="btn sm pri" type="submit" name="acao" value="bulk">Aplicar nos selecionados</button>
        </>
      )}
      {dirty > 0 && <button className="btn sm pri" type="submit" name="acao" value="salvar" style={{ marginLeft: "auto" }}><Check size={14} /> Salvar {dirty} custo{dirty > 1 ? "s" : ""}</button>}
    </div>
  );
}
