import Link from "next/link";
import { AlarmClock, CheckCircle2, Loader, Plus, Sparkles, X } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isoDayLocal } from "@/lib/time";
import { Header, Panel } from "@/components/ui";
import { DateField } from "@/components/fields";
import { Kanban, type KTask } from "@/components/Kanban";
import { addTask, deleteTask, moveTask } from "../acoes2";

export const dynamic = "force-dynamic";

export default async function Tarefas({ searchParams }: { searchParams: Promise<{ quem?: string; nova?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  const me = session?.name ?? "";
  const [all, users] = await Promise.all([
    db.task.findMany({ orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] }),
    db.user.findMany({ select: { name: true } }),
  ]);
  const today = isoDayLocal();
  const quem = sp.quem === "eu" || sp.quem === "equipe" ? sp.quem : "todos";
  const tasks = all.filter((t) => quem === "todos" || (quem === "eu" ? t.assignee === me : t.assignee !== me));
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const kt: KTask[] = tasks.map((t) => {
    const d = t.dueDate ? isoDayLocal(t.dueDate) : null;
    return { id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, assignee: t.assignee, due: d, dueLabel: d ? (d === today ? "hoje" : fmt.format(t.dueDate!)) : null, late: !!d && d < today, today: d === today };
  });
  const open = all.filter((t) => t.status !== "feito");
  const forToday = open.filter((t) => t.dueDate && isoDayLocal(t.dueDate) <= today);
  const late = open.filter((t) => t.dueDate && isoDayLocal(t.dueDate) < today);
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const doneWeek = all.filter((t) => t.status === "feito" && t.updatedAt >= weekAgo).length;
  const fromAI = open.filter((t) => t.description?.startsWith("Do diagnóstico")).length;
  const first = me.split(" ")[0] || "Eu";

  return (
    <>
      <Header title="Tarefas" lede="Tudo que precisa ser feito, num lugar só. As sugestões da IA e das votações já chegam aqui como tarefa.">
        <div className="seg">{[["todos", "Todos"], ["eu", first], ["equipe", "Equipe"]].map(([k, l]) => <Link key={k} href={k === "todos" ? "/tarefas" : `/tarefas?quem=${k}`} className={quem === k ? "on" : ""}>{l}</Link>)}</div>
        <Link className="btn pri" href={sp.nova ? "/tarefas" : "/tarefas?nova=1"}><Plus size={16} /> Nova tarefa</Link>
      </Header>
      <div className="grid g4">
        <div className="pnl statk"><span className="tile t-c"><AlarmClock size={18} /></span><div><b>{forToday.length}</b><small>para hoje{late.length ? `, ${late.length} atrasada${late.length > 1 ? "s" : ""}` : ""}</small></div></div>
        <div className="pnl statk"><span className="tile t-s"><Loader size={18} /></span><div><b>{all.filter((t) => t.status === "fazendo").length}</b><small>em andamento</small></div></div>
        <div className="pnl statk"><span className="tile t-l"><CheckCircle2 size={18} /></span><div><b>{doneWeek}</b><small>feitas nesta semana</small></div></div>
        <div className="pnl statk"><span className="tile t-k"><Sparkles size={18} /></span><div><b>{fromAI}</b><small>abertas vindas do diagnóstico</small></div></div>
      </div>
      {sp.nova && (
        <Panel title="Nova tarefa" right={<Link className="menu-b" href="/tarefas"><X size={16} /></Link>}>
          <form action={addTask} className="row" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ flex: 2, minWidth: 240 }}><label>O que fazer</label><input className="in" name="title" placeholder="Ex.: fotos da collab Pura" required autoFocus /></div>
            <div className="field" style={{ width: 170 }}><label>Responsável</label><select className="in" name="assignee" defaultValue={me}><option value="">Ninguém</option>{users.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}</select></div>
            <div className="field" style={{ width: 130 }}><label>Prioridade</label><select className="in" name="priority" defaultValue="normal"><option value="alta">Alta</option><option value="normal">Média</option><option value="baixa">Baixa</option></select></div>
            <div className="field" style={{ width: 190 }}><label>Prazo</label><DateField name="due" /></div>
            <button className="btn pri" type="submit">Adicionar</button>
          </form>
        </Panel>
      )}
      <Kanban tasks={kt} move={moveTask} remove={deleteTask} />
    </>
  );
}
