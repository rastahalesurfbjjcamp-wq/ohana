"use client";
// Regras de uma lista que se atualiza sozinha, com prévia de quantas pessoas entram.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { FIELDS, OPS, RFM_SEGMENTS, describe, type ARule } from "@/lib/audienceTypes";
import { previewRules, saveListRules } from "../acoes12";

export function RulesBuilder({ listId, initial, mode: m0, lists }: { listId: string; initial: ARule[]; mode: string; lists: { id: string; name: string }[] }) {
  const router = useRouter();
  const [rules, setRules] = useState<ARule[]>(initial.length ? initial : [{ field: "orders", op: "gte", value: "2" }]);
  const [mode, setMode] = useState(m0 === "any" ? "any" : "all");
  const [prev, setPrev] = useState<{ total: number; sample: { name: string; spent: number; rfm: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { previewRules(rules, mode).then(setPrev).catch(() => null); }, 500);
    return () => clearTimeout(t);
  }, [rules, mode]);
  const set = (i: number, fn: (r: ARule) => void) => setRules((cur) => { const c = structuredClone(cur); fn(c[i]); return c; });
  const names = new Map(lists.map((l) => [l.id, l.name]));
  return (
    <div className="rb">
      <div className="seg" style={{ alignSelf: "flex-start" }}>
        <button className={mode === "all" ? "on" : ""} onClick={() => setMode("all")}>Todas as regras</button>
        <button className={mode === "any" ? "on" : ""} onClick={() => setMode("any")}>Qualquer regra</button>
      </div>
      {rules.map((r, i) => {
        const f = FIELDS.find((x) => x.k === r.field) ?? FIELDS[0];
        return (
          <div key={i} className="rb-row">
            <select className="in" value={r.field} onChange={(e) => set(i, (x) => { const nf = FIELDS.find((y) => y.k === e.target.value)!; x.field = nf.k; x.op = OPS[nf.type][0].k; x.value = nf.type === "rfm" ? RFM_SEGMENTS[0].k : nf.type === "list" ? lists[0]?.id : undefined; })}>{FIELDS.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}</select>
            <select className="in" value={r.op} onChange={(e) => set(i, (x) => { x.op = e.target.value; })}>{OPS[f.type].map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}</select>
            {f.type === "rfm" ? <select className="in" value={r.value ?? ""} onChange={(e) => set(i, (x) => { x.value = e.target.value; })}>{RFM_SEGMENTS.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}</select>
              : f.type === "list" ? <select className="in" value={r.value ?? ""} onChange={(e) => set(i, (x) => { x.value = e.target.value; })}>{lists.filter((l) => l.id !== listId).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              : f.type === "bool" ? <span />
              : <input className="in" value={r.value ?? ""} inputMode={f.type === "number" ? "decimal" : undefined} placeholder={f.k === "state" ? "RJ" : f.k === "days" ? "90" : f.k === "spent" ? "500" : ""} onChange={(e) => set(i, (x) => { x.value = e.target.value; })} />}
            <button className="cv-ib sm" disabled={rules.length === 1} onClick={() => setRules((c) => c.filter((_, k) => k !== i))} title="Tirar"><X size={14} /></button>
          </div>
        );
      })}
      <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setRules((c) => [...c, { field: "days", op: "gte", value: "90" }])}><Plus size={14} /> Adicionar regra</button>
      <div className="rb-prev">
        <div>Quem entra: <b>{describe(rules, mode, names)}</b></div>
        <div style={{ marginTop: 6 }}>{prev ? <><b className="n">{prev.total.toLocaleString("pt-BR")}</b> pessoas com WhatsApp hoje{prev.sample.length ? `, ex.: ${prev.sample.map((s) => s.name.split(" ")[0]).join(", ")}` : ""}</> : "Calculando…"}</div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn pri sm" disabled={busy} onClick={async () => { setBusy(true); setMsg(""); const r = await saveListRules(listId, rules, mode).catch(() => null); setBusy(false); if (r) { setMsg(`Salvo: ${r.total} na lista (${r.added} entraram, ${r.removed} saíram).`); router.refresh(); } else setMsg("Não salvou"); }}>{busy ? "Salvando…" : "Salvar e atualizar a lista"}</button>
        {msg && <small className="dim">{msg}</small>}
      </div>
      <small className="dim">A lista se atualiza sozinha a cada 6 horas e na hora de cada campanha.</small>
    </div>
  );
}
