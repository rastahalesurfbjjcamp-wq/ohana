"use client";
// Chave de liga/desliga de uma automação. Para ligar, pede confirmação (passa a mandar mensagem para clientes).
import { useState } from "react";
import { useFormStatus } from "react-dom";

function Inner({ on, label }: { on: boolean; label: string }) {
  const { pending } = useFormStatus();
  const [ask, setAsk] = useState(false);
  if (ask)
    return (
      <span className="confirm" style={{ padding: "4px 4px 4px 10px", fontSize: 12 }}>
        <span>Ligar? {label} passam a receber mensagem.</span>
        <button type="button" className="btn sm ghost" onClick={() => setAsk(false)}>Não</button>
        <button type="submit" className="btn pri sm" name="on" value="1" onClick={() => setTimeout(() => setAsk(false), 50)}>Ligar</button>
      </span>
    );
  return (
    <span className="check">
      <input type="checkbox" checked={on} disabled={pending} aria-label={on ? "Desligar" : "Ligar"}
        onChange={(e) => {
          if (e.target.checked) setAsk(true);
          else e.currentTarget.form?.requestSubmit();
        }} />
    </span>
  );
}

export function AutoToggle({ action, k, on, label = "Os clientes" }: { action: (f: FormData) => Promise<void>; k: string; on: boolean; label?: string }) {
  return (
    <form action={action} style={{ display: "inline-flex" }}>
      <input type="hidden" name="key" value={k} />
      {on && <input type="hidden" name="on" value="0" />}
      <Inner on={on} label={label} />
    </form>
  );
}
