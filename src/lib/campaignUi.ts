// Rótulos das campanhas de WhatsApp (usado nas telas)
export const CAMP_STATE: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "c-n" }, agendada: { label: "Agendada", cls: "c-k" }, enviando: { label: "Enviando", cls: "c-s" },
  pausada: { label: "Pausada", cls: "c-n" }, enviada: { label: "Enviada", cls: "c-l" }, cancelada: { label: "Cancelada", cls: "c-c" },
};
export const fmtAt = (at?: string) => (at ? new Date(`${at}:00-03:00`).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-");
