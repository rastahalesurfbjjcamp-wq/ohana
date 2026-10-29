"use client";
// Escolha dos cartões da visão geral, com aviso de "salvo"
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, SlidersHorizontal } from "lucide-react";

export function CardPicker({ cards, on, action }: { cards: [string, string][]; on: string[]; action: (f: FormData) => Promise<void> }) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  return (
    <details className="dd" ref={ref}>
      <summary className="btn"><SlidersHorizontal size={16} /> Personalizar</summary>
      <form
        className="dd-pop dd-list"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            await action(fd);
            setSaved(true);
            router.refresh();
            setTimeout(() => { setSaved(false); if (ref.current) ref.current.open = false; }, 1400);
          });
        }}
      >
        <b style={{ fontSize: 13 }}>Cartões do topo</b>
        {cards.map(([k, l]) => (
          <label key={k} className="dd-chk"><input type="checkbox" name="card" value={k} defaultChecked={on.includes(k)} /> {l}</label>
        ))}
        <button className={`btn sm ${saved ? "ok-btn" : "pri"}`} type="submit" disabled={pending}>
          {saved ? <><Check size={15} /> Salvo</> : pending ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </details>
  );
}
