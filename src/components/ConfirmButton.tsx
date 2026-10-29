"use client";
// Botão de envio que pede confirmação antes (ações que mandam mensagem para clientes).
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function ConfirmButton({ children, message, className = "btn", disabled }: { children: ReactNode; message: string; className?: string; disabled?: boolean }) {
  const [ask, setAsk] = useState(false);
  const { pending } = useFormStatus();
  if (!ask)
    return (
      <button type="button" className={className} disabled={disabled || pending} onClick={() => setAsk(true)}>
        {pending ? "Enviando…" : children}
      </button>
    );
  return (
    <span className="confirm">
      <span>{message}</span>
      <button type="button" className="btn sm ghost" onClick={() => setAsk(false)}>Cancelar</button>
      <button type="submit" className="btn pri sm" onClick={() => setTimeout(() => setAsk(false), 50)}>Confirmar</button>
    </span>
  );
}
