"use client";
// Botão de atualizar os dados da tela sem recarregar a página inteira
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshButton({ bar = false }: { bar?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className={`${bar ? "btn rbtn" : "refresh-fab"}${pending ? " on" : ""}`} onClick={() => start(() => router.refresh())} title="Atualizar os dados" aria-label="Atualizar os dados">
      <RefreshCw size={16} /> <span>{pending ? "Atualizando" : "Atualizar"}</span>
    </button>
  );
}
