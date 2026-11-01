"use client";
// Formulário de nova mensagem agendada para os grupos.
import { useState } from "react";
import { CalendarClock, Plus, Send, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import { DateTimeField, FileField, GroupPicker, ToggleCard, type GroupOpt } from "./fields";
import { LibraryPicker, type LibMsg } from "./LibraryPicker";

function Buttons({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button className="btn pri lg" type="submit" disabled={pending || !count} style={{ width: "100%", justifyContent: "center" }}>
        <CalendarClock size={17} /> {pending ? "Salvando…" : count ? `Agendar para ${count} grupo${count > 1 ? "s" : ""}` : "Escolha os grupos"}
      </button>
      <button className="btn ghost sm" type="submit" name="now" value="1" disabled={pending || !count} style={{ alignSelf: "center" }}>
        <Send size={14} /> Enviar agora em vez de agendar
      </button>
    </div>
  );
}

export function ScheduleForm({ action, groups, defaultDate, library = [] }: { action: (f: FormData) => Promise<void>; groups: GroupOpt[]; defaultDate?: string; library?: LibMsg[] }) {
  const [count, setCount] = useState(groups.filter((g) => g.checked).length);
  const [parts, setParts] = useState(1);
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <input type="hidden" name="parts" value={parts} />
      {Array.from({ length: parts }, (_, i) => (
        <div key={i} className={parts > 1 ? "seq-part" : "stack"} style={{ gap: 10 }}>
          <div className="field">
            <label className="row" style={{ justifyContent: "space-between" }}>
              <span>{parts > 1 ? `Mensagem ${i + 1}` : "Mensagem"}</span>
              {i > 0 && i === parts - 1 && <button type="button" className="menu-b" aria-label="Tirar esta mensagem" onClick={() => setParts(parts - 1)}><X size={14} /></button>}
            </label>
            <LibraryPicker items={library} onPick={(t) => { const el = document.getElementById(`sf-text-${i}`) as HTMLTextAreaElement | null; if (el) el.value = t; }} />
            <textarea id={`sf-text-${i}`} className="in" name={i === 0 ? "text" : `text_${i}`} placeholder={i === 0 ? "Ex.: Lançamento hoje às 19h, só para quem está no grupo." : "Texto, link ou legenda da foto"} style={{ minHeight: i === 0 ? 110 : 80 }} />
          </div>
          <FileField name={i === 0 ? "media" : `media_${i}`} hint="Foto, vídeo ou PDF. O texto vira a legenda (opcional)" />
        </div>
      ))}
      {parts < 10 && <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setParts(parts + 1)}><Plus size={14} /> Adicionar outra mensagem na sequência</button>}
      {parts > 1 && <small className="dim" style={{ marginTop: -4 }}>As {parts} mensagens saem juntas, nessa ordem, poucos segundos uma da outra. Só a primeira marca todos.</small>}
      <ToggleCard name="mentionAll" tone="s" defaultChecked title="Marcar todos os membros" sub="Cada pessoa recebe a notificação, mesmo com o grupo silenciado" />
      <GroupPicker name="groups" groups={groups} onCount={setCount} />
      <DateTimeField name="sendAt" defaultValue={defaultDate} />
      <ToggleCard name="repeatOn" title="Repetir" sub="Manda de novo no mesmo horário">
        <select className="in" name="repeat" defaultValue="daily">
          <option value="daily">Todo dia</option>
          <option value="weekly">Toda semana</option>
        </select>
      </ToggleCard>
      <Buttons count={count} />
    </form>
  );
}
