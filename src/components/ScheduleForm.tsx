"use client";
// Formulário de nova mensagem agendada para os grupos.
import { useState } from "react";
import { CalendarClock, Send } from "lucide-react";
import { useFormStatus } from "react-dom";
import { DateTimeField, FileField, GroupPicker, ToggleCard, type GroupOpt } from "./fields";

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

export function ScheduleForm({ action, groups, defaultDate }: { action: (f: FormData) => Promise<void>; groups: GroupOpt[]; defaultDate?: string }) {
  const [count, setCount] = useState(groups.filter((g) => g.checked).length);
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <div className="field">
        <label>Mensagem</label>
        <textarea className="in" name="text" required placeholder="Ex.: Lançamento hoje às 19h, só para quem está no grupo." style={{ minHeight: 110 }} />
      </div>
      <FileField name="media" hint="O texto vira a legenda (opcional)" />
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
