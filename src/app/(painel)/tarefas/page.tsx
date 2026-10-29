import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { Header } from "@/components/ui";
import { addTask, deleteTask, moveTask } from "../acoes2";

export const dynamic = "force-dynamic";

const COLS = [
  { key: "a_fazer", label: "A fazer" },
  { key: "fazendo", label: "Fazendo" },
  { key: "feito", label: "Feito" },
];
const PRIO = { alta: ["alta", "c-c"], normal: ["normal", "c-n"], baixa: ["baixa", "c-k"] } as const;

export default async function Tarefas() {
  const [tasks, users] = await Promise.all([
    db.task.findMany({ orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] }),
    db.user.findMany({ select: { name: true } }),
  ]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const now = Date.now();

  return (
    <>
      <Header title="Tarefas" lede="O que a equipe precisa fazer, quem está fazendo e o que já foi feito." />
      <form action={addTask} className="pnl" style={{ padding: 16 }}>
        <div className="row">
          <input className="in" name="title" placeholder="Nova tarefa, ex.: fotos da collab Pura" required style={{ flex: 2, minWidth: 220 }} />
          <select className="in" name="assignee" style={{ width: 150 }} defaultValue="">
            <option value="">Sem responsável</option>
            {users.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
          </select>
          <select className="in" name="priority" style={{ width: 120 }} defaultValue="normal">
            <option value="alta">Alta</option>
            <option value="normal">Normal</option>
            <option value="baixa">Baixa</option>
          </select>
          <input className="in" type="date" name="due" style={{ width: 160 }} />
          <button className="btn pri" type="submit">Adicionar</button>
        </div>
        <input className="in" name="description" placeholder="Detalhes (opcional)" style={{ marginTop: 10 }} />
      </form>
      <div className="kanban">
        {COLS.map((col, ci) => {
          const list = tasks.filter((t) => t.status === col.key);
          return (
            <div className="kcol" key={col.key}>
              <h4>{col.label} <span className="chip c-n">{list.length}</span></h4>
              {list.map((t) => {
                const late = t.dueDate && t.status !== "feito" && t.dueDate.getTime() < now;
                const p = PRIO[(t.priority as keyof typeof PRIO) ?? "normal"] ?? PRIO.normal;
                return (
                  <div className="card" key={t.id}>
                    <div className="t">{t.title}</div>
                    {t.description && <div className="mut" style={{ fontSize: 13 }}>{t.description}</div>}
                    <div className="row" style={{ gap: 6 }}>
                      <span className={`chip ${p[1]}`}>{p[0]}</span>
                      {t.assignee && <span className="chip c-k">{t.assignee}</span>}
                      {t.dueDate && <span className={`chip ${late ? "c-c" : "c-n"}`}>{late ? "atrasada " : ""}{fmt.format(t.dueDate)}</span>}
                    </div>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      {ci > 0 && (
                        <form action={moveTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={COLS[ci - 1].key} />
                          <button className="btn sm" title={`Voltar para ${COLS[ci - 1].label}`}><ArrowLeft size={14} /></button></form>
                      )}
                      {ci < COLS.length - 1 && (
                        <form action={moveTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={COLS[ci + 1].key} />
                          <button className="btn sm" title={`Mover para ${COLS[ci + 1].label}`}>{COLS[ci + 1].label} <ArrowRight size={14} /></button></form>
                      )}
                      <form action={deleteTask}><input type="hidden" name="id" value={t.id} />
                        <button className="btn sm danger" title="Apagar"><Trash2 size={14} /></button></form>
                    </div>
                  </div>
                );
              })}
              {!list.length && <div className="dim" style={{ fontSize: 13, padding: 8 }}>Nada aqui.</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
