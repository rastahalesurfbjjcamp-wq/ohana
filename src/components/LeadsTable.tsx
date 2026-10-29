"use client";
// Tabela de leads com seleção e barra de disparo.
import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { useFormStatus } from "react-dom";

export type LeadRow = { id: string; name: string; phone: string; phoneFmt: string; email: string | null; origin: string; originSub: string; when: string; group: "no_grupo" | "nao_entrou" | "saiu"; spent: number; orders: number };
const G = { no_grupo: ["No grupo", "c-l"], nao_entrou: ["Não entrou", "c-s"], saiu: ["Saiu", "c-c"] } as const;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const TONES = ["#4ad781", "#f7c928", "#7cb4fb", "#b4a1fb", "#f87171"];

function Go({ n }: { n: number }) {
  const { pending } = useFormStatus();
  return <button className="btn pri" type="submit" disabled={pending}><Send size={15} /> {pending ? "Abrindo…" : `Disparar para ${n}`}</button>;
}

export function LeadsTable({ rows, action }: { rows: LeadRow[]; action: (f: FormData) => Promise<void> }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const all = rows.length > 0 && sel.size === rows.length;
  const toggle = (p: string) => setSel((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const initials = useMemo(() => (n: string) => n.split(" ").filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "?", []);
  return (
    <form action={action}>
      {[...sel].map((p) => <input key={p} type="hidden" name="sel" value={p} />)}
      <div style={{ overflowX: "auto" }}>
        <table className="tb">
          <thead>
            <tr>
              <th style={{ width: 44 }}><span className="cbx" data-on={all} onClick={() => setSel(all ? new Set() : new Set(rows.map((r) => r.phone)))} /></th>
              <th>Lead</th><th>WhatsApp</th><th>E-mail</th><th>Origem</th><th>Captado</th><th>Grupo</th><th>Compras</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={sel.has(r.phone) ? "sel" : ""} onClick={() => toggle(r.phone)} style={{ cursor: "pointer" }}>
                <td><span className="cbx" data-on={sel.has(r.phone)} /></td>
                <td>
                  <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                    <span className="av-s" style={{ color: TONES[i % 5], background: `${TONES[i % 5]}1f` }}>{initials(r.name)}</span>
                    <b style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.name}</b>
                  </div>
                </td>
                <td className="mut" style={{ whiteSpace: "nowrap" }}>{r.phoneFmt}</td>
                <td className="mut">{r.email ?? "–"}</td>
                <td><div style={{ fontSize: 13 }}>{r.origin}</div><div className="dim" style={{ fontSize: 11.5 }}>{r.originSub}</div></td>
                <td className="mut" style={{ whiteSpace: "nowrap" }}>{r.when}</td>
                <td><span className={`chip ${G[r.group][1]}`}>{G[r.group][0]}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{r.orders ? <><b>{brl(r.spent)}</b> <span className="dim">· {r.orders} pedido{r.orders > 1 ? "s" : ""}</span></> : <span className="dim">nenhuma</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty">Nenhum lead com esses filtros.</div>}
      </div>
      {sel.size > 0 && (
        <div className="fbar">
          <b>{sel.size} selecionado{sel.size > 1 ? "s" : ""}</b>
          <span className="mut">Disparar por WhatsApp</span>
          <button type="button" className="btn ghost sm" onClick={() => setSel(new Set())}>Limpar</button>
          <Go n={sel.size} />
        </div>
      )}
    </form>
  );
}
