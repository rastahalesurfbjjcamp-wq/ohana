"use client";
// Personalizar a visão geral: quais cartões aparecem e quais blocos, em que ordem
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, SlidersHorizontal } from "lucide-react";

export function CardPicker({ cards, on, blocks, blocksOn, action }: { cards: [string, string][]; on: string[]; blocks?: [string, string][]; blocksOn?: string[]; action: (f: FormData) => Promise<void> }) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const initial = blocks ? [...(blocksOn ?? []).filter((k) => blocks.some(([b]) => b === k)), ...blocks.map(([k]) => k).filter((k) => !(blocksOn ?? []).includes(k))] : [];
  const [order, setOrder] = useState<string[]>(initial);
  const [vis, setVis] = useState<Set<string>>(new Set(blocksOn ?? []));
  const label = (k: string) => blocks?.find(([b]) => b === k)?.[1] ?? k;
  const move = (i: number, d: number) => setOrder((o) => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  return (
    <details className="dd" ref={ref}>
      <summary className="btn"><SlidersHorizontal size={16} /> Personalizar</summary>
      <form
        className="dd-pop dd-list"
        style={{ minWidth: blocks ? 520 : undefined }}
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
        <div style={{ display: "grid", gridTemplateColumns: blocks ? "1fr 1.25fr" : "1fr", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <b style={{ fontSize: 13, marginBottom: 4 }}>Cartões de números</b>
            {cards.map(([k, l]) => (
              <label key={k} className="dd-chk"><input type="checkbox" name="card" value={k} defaultChecked={on.includes(k)} /> {l}</label>
            ))}
          </div>
          {blocks && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <input type="hidden" name="_blocks" value="1" />
              <b style={{ fontSize: 13, marginBottom: 4 }}>Blocos da tela, de cima para baixo</b>
              {order.map((k, i) => (
                <div key={k} className="dd-chk" style={{ justifyContent: "space-between" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: "pointer" }}>
                    <input type="checkbox" checked={vis.has(k)} onChange={(e) => setVis((v) => { const n = new Set(v); if (e.target.checked) n.add(k); else n.delete(k); return n; })} /> {label(k)}
                  </label>
                  {vis.has(k) && <input type="hidden" name="block" value={k} />}
                  <span style={{ display: "flex", gap: 4 }}>
                    <button type="button" className="btn sm" style={{ padding: "0 7px" }} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={13} /></button>
                    <button type="button" className="btn sm" style={{ padding: "0 7px" }} disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown size={13} /></button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className={`btn sm ${saved ? "ok-btn" : "pri"}`} type="submit" disabled={pending} style={{ marginTop: 10 }}>
          {saved ? <><Check size={15} /> Salvo</> : pending ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </details>
  );
}
