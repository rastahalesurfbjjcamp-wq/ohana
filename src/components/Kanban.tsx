"use client";
// Quadro de tarefas: arraste o cartão entre as colunas.
import { useOptimistic, useTransition } from "react";
import { CalendarDays, Check, Circle, Loader, ListChecks, Megaphone, Rocket, Sparkles, Trash2, User, Vote } from "lucide-react";

export type KTask = { id: string; title: string; description: string | null; status: string; priority: string; assignee: string | null; due: string | null; dueLabel: string | null; late: boolean; today: boolean };
const COLS = [
  { key: "a_fazer", label: "A fazer", icon: Circle },
  { key: "fazendo", label: "Fazendo", icon: Loader },
  { key: "feito", label: "Feito", icon: Check },
];
const PRIO: Record<string, [string, string]> = { alta: ["Alta", "c-c"], normal: ["Média", "c-s"], baixa: ["Baixa", "c-n"] };
function source(d: string | null): [string, typeof Sparkles, string] {
  if (!d) return ["Manual", User, "c-n"];
  if (d.startsWith("Do diagnóstico")) return ["Diagnóstico IA", Sparkles, "c-k"];
  if (d.startsWith("Venceu a votação")) return ["Votação", Vote, "c-s"];
  if (/lançamento/i.test(d)) return ["Lançamento", Rocket, "c-c"];
  if (/campanha|anúncio/i.test(d)) return ["Campanhas", Megaphone, "c-l"];
  return ["Manual", ListChecks, "c-n"];
}
const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export function Kanban({ tasks, move, remove }: { tasks: KTask[]; move: (f: FormData) => Promise<void>; remove: (f: FormData) => Promise<void> }) {
  const [, start] = useTransition();
  const [list, setList] = useOptimistic(tasks, (cur: KTask[], u: { id: string; status?: string; del?: boolean }) =>
    u.del ? cur.filter((t) => t.id !== u.id) : cur.map((t) => (t.id === u.id ? { ...t, status: u.status! } : t)));
  const go = (id: string, status: string) => start(async () => {
    setList({ id, status });
    const f = new FormData(); f.set("id", id); f.set("status", status);
    await move(f);
  });
  const del = (id: string) => start(async () => {
    setList({ id, del: true });
    const f = new FormData(); f.set("id", id);
    await remove(f);
  });
  return (
    <div className="kb">
      {COLS.map((c) => {
        const items = list.filter((t) => t.status === c.key);
        return (
          <section key={c.key} className="kb-col" onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("over"); }} onDragLeave={(e) => e.currentTarget.classList.remove("over")}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("over"); const id = e.dataTransfer.getData("text/plain"); if (id) go(id, c.key); }}>
            <div className="kb-h"><c.icon size={16} className={c.key === "feito" ? "up" : c.key === "fazendo" ? "" : "dim"} /> <b>{c.label}</b> <span className="chip c-n">{items.length}</span></div>
            <div className="kb-list">
              {items.map((t) => {
                const [src, SIcon, tone] = source(t.description);
                const [pl, pc] = PRIO[t.priority] ?? PRIO.normal;
                return (
                  <article key={t.id} className={`kb-card${t.status === "feito" ? " done" : ""}`} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.currentTarget.classList.add("drag"); }} onDragEnd={(e) => e.currentTarget.classList.remove("drag")}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                      <span className={`chip ${tone}`}><SIcon size={11} /> {src}</span>
                      <span className={`chip ${pc}`}>{pl}</span>
                    </div>
                    <p className="kb-t">{t.title}</p>
                    {t.description && !t.description.startsWith("Do diagnóstico") && <p className="dim" style={{ fontSize: 12, lineHeight: 1.4 }}>{t.description}</p>}
                    <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
                      <span className={`kb-due${t.late && t.status !== "feito" ? " late" : t.today ? " today" : ""}`}><CalendarDays size={13} /> {t.dueLabel ?? "sem prazo"}</span>
                      <span className="row" style={{ gap: 4 }}>
                        <span className="kb-acts">
                          {COLS.filter((x) => x.key !== t.status).map((x) => <button key={x.key} type="button" title={`Mover para ${x.label}`} onClick={() => go(t.id, x.key)}><x.icon size={13} /></button>)}
                          <button type="button" title="Apagar" onClick={() => del(t.id)}><Trash2 size={13} /></button>
                        </span>
                        {t.assignee && <span className="av-s" style={{ width: 26, height: 26, fontSize: 10 }} title={t.assignee}>{initials(t.assignee)}</span>}
                      </span>
                    </div>
                  </article>
                );
              })}
              {!items.length && <div className="kb-empty">Arraste uma tarefa para cá</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
