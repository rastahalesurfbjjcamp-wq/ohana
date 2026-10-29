"use client";
// Select que salva sozinho ao trocar a opção
import type { ReactNode } from "react";

export function SubmitSelect({ name, value, children, className = "in", label }: { name: string; value: string; children: ReactNode; className?: string; label?: string }) {
  return (
    <select name={name} defaultValue={value} className={className} aria-label={label} style={{ height: 34, minWidth: 150 }} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {children}
    </select>
  );
}
