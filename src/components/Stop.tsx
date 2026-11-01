"use client";
// Evita que clicar em botões dentro de uma linha que abre (details/summary) abra ou feche a linha
import type { ReactNode } from "react";

export function Stop({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className} onClick={(e) => { if ((e.target as HTMLElement).closest("button,select")) e.preventDefault(); }}>{children}</div>;
}
