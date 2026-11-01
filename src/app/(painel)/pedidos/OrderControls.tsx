"use client";
// Bandeira, status próprio, responsável e arquivar de um pedido; quadro com arrastar; editor de status.
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Flag, Plus, Trash2, UserRound, X } from "lucide-react";
import { saveStatuses, setOrderMeta } from "../acoes13";
import type { OrderStatus } from "@/lib/orderMeta";

type Meta = { status: string | null; assignee: string | null; flagged: boolean; archived: boolean };

export function OrderControls({ refId, meta, statuses, users, kind = "pedido" }: { refId: string; meta: Meta; statuses: OrderStatus[]; users: string[]; kind?: string }) {
  const [m, setM] = useState<Meta>(meta);
  const [, start] = useTransition();
  const save = (d: Partial<Meta>) => { setM((c) => ({ ...c, ...d })); start(() => { void setOrderMeta(refId, { ...d, kind }); }); };
  const st = statuses.find((s) => s.id === m.status);
  return (
    <div className="oc" onClick={(e) => e.preventDefault()}>
      <button className={`oc-flag${m.flagged ? " on" : ""}`} title={m.flagged ? "Tirar bandeira" : "Marcar com bandeira"} onClick={() => save({ flagged: !m.flagged })}><Flag size={13} /></button>
      <select className="oc-st" value={m.status ?? ""} onChange={(e) => save({ status: e.target.value || null })} style={st ? { borderColor: st.color, color: st.color } : undefined} title="Status">
        <option value="">+ Status</option>
        {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <label className="oc-who" title="Responsável">
        <UserRound size={12} />
        <select value={m.assignee ?? ""} onChange={(e) => save({ assignee: e.target.value || null })}>
          <option value="">Ninguém</option>
          {users.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </label>
      <button className="oc-flag" title={m.archived ? "Desarquivar" : "Arquivar"} onClick={() => save({ archived: !m.archived })}>{m.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}</button>
    </div>
  );
}

export type Card = { id: string; status: string | null; title: string; sub: string; value: string; chip: [string, string]; flagged: boolean; body?: ReactNode };

export function Kanban({ cards, statuses }: { cards: Card[]; statuses: OrderStatus[] }) {
  const router = useRouter();
  const [items, setItems] = useState(cards);
  const [over, setOver] = useState<string | null>(null);
  const cols = [{ id: "", label: "Sem status", color: "#5d6661" }, ...statuses];
  const move = async (id: string, status: string) => {
    setItems((c) => c.map((x) => (x.id === id ? { ...x, status: status || null } : x)));
    await setOrderMeta(id, { status: status || null });
    router.refresh();
  };
  return (
    <div className="okb">
      {cols.map((c) => {
        const list = items.filter((x) => (x.status ?? "") === c.id);
        return (
          <div key={c.id} className={`okb-col${over === c.id ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(c.id); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/card"); if (id) void move(id, c.id); }}>
            <div className="okb-h"><i style={{ background: c.color }} />{c.label}<small>{list.length}</small></div>
            {list.map((x) => (
              <div key={x.id} className="okb-card" draggable onDragStart={(e) => e.dataTransfer.setData("text/card", x.id)}>
                <div className="row" style={{ justifyContent: "space-between", gap: 6 }}><b>{x.title}</b>{x.flagged && <Flag size={12} color="#ef4444" />}</div>
                <small>{x.sub}</small>
                <div className="row" style={{ justifyContent: "space-between" }}><b>{x.value}</b><span className={`chip ${x.chip[1]}`}>{x.chip[0]}</span></div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function StatusEditor({ statuses }: { statuses: OrderStatus[] }) {
  const router = useRouter();
  const [list, setList] = useState(statuses);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) return <button className="btn sm ghost" onClick={() => setOpen(true)}>Gerenciar status</button>;
  return (
    <div className="cv-modal" onPointerDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="cv-modal-in" style={{ width: 460 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}><b>Status dos pedidos</b><button className="cv-ib" onClick={() => setOpen(false)}><X size={16} /></button></div>
        <div className="stack" style={{ gap: 8 }}>
          {list.map((s, i) => (
            <div key={s.id} className="row" style={{ gap: 8 }}>
              <input type="color" value={s.color} onChange={(e) => setList((c) => c.map((x, k) => (k === i ? { ...x, color: e.target.value } : x)))} style={{ width: 36, height: 34, border: 0, background: "none" }} />
              <input className="in" value={s.label} onChange={(e) => setList((c) => c.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
              <button className="cv-ib" onClick={() => setList((c) => c.filter((_, k) => k !== i))} title="Tirar"><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setList((c) => [...c, { id: "", label: "Novo status", color: "#60a5fa" }])}><Plus size={14} /> Adicionar</button>
          <button className="btn pri sm" disabled={busy} onClick={async () => { setBusy(true); await saveStatuses(list); setBusy(false); setOpen(false); router.refresh(); }}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}
