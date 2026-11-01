"use client";
// Campo de arquivo que envia o formulário assim que a pessoa escolhe o arquivo
import type { ReactNode } from "react";

export function AutoSubmitFile({ name, accept, children, className = "btn" }: { name: string; accept?: string; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      {children}
      <input type="file" name={name} accept={accept} hidden onChange={(e) => e.currentTarget.form?.requestSubmit()} />
    </label>
  );
}
