// Páginas do painel por área, para dar acesso por pessoa da equipe. Sem banco: roda também no middleware.
export const AREAS: { group: string; items: { href: string; label: string }[] }[] = [
  { group: "Geral", items: [{ href: "/", label: "Visão geral" }, { href: "/tarefas", label: "Tarefas" }] },
  { group: "Comunidade", items: [
    { href: "/grupos", label: "Grupos" }, { href: "/entradas", label: "Entradas e saídas" }, { href: "/leads", label: "Leads" }, { href: "/disparos", label: "Disparos" },
    { href: "/agendamentos", label: "Agendamentos" }, { href: "/votacoes", label: "Votações" }, { href: "/lancamento", label: "Lançamento" }, { href: "/automacoes", label: "Automações" },
    { href: "/mensagens", label: "Mensagens" }, { href: "/campanhas-whatsapp", label: "Campanhas WhatsApp" }, { href: "/listas", label: "Listas" },
  ] },
  { group: "Vendas", items: [
    { href: "/historico", label: "Histórico de vendas" }, { href: "/financeiro", label: "Financeiro" }, { href: "/produtos", label: "Produtos e lucro" }, { href: "/precificacao", label: "Precificação" },
    { href: "/estoque", label: "Estoque" }, { href: "/pedidos", label: "Pedidos" }, { href: "/custos", label: "Custos e impostos" }, { href: "/recuperacao", label: "Recuperação" },
    { href: "/modelos", label: "Modelos prontos" }, { href: "/entregas", label: "Entregas" }, { href: "/atendimento", label: "Atendimento" }, { href: "/assistente", label: "Assistente IA" },
    { href: "/pos-venda", label: "Pós-venda" }, { href: "/atletas", label: "Atletas e influenciadores" }, { href: "/embaixadores", label: "Embaixadores" }, { href: "/clube", label: "Clube de fidelidade" }, { href: "/indique", label: "Indique e ganhe" },
  ] },
  { group: "Clientes", items: [{ href: "/clientes", label: "CRM" }, { href: "/calendario", label: "Calendário de vendas" }] },
  { group: "Inteligência", items: [
    { href: "/conversao", label: "Conversão" }, { href: "/origem", label: "Vendas por origem" }, { href: "/relatorio", label: "Relatório diário" }, { href: "/campanhas", label: "Campanhas" }, { href: "/diagnostico", label: "Diagnóstico com IA" },
  ] },
  { group: "Sistema", items: [{ href: "/integracoes", label: "Integrações" }, { href: "/configuracoes", label: "Configurações" }, { href: "/equipe", label: "Equipe e acessos" }] },
];
export const ALL_HREFS = AREAS.flatMap((a) => a.items.map((i) => i.href));
// Páginas que só o administrador abre, mesmo marcadas
export const ADMIN_ONLY = ["/equipe", "/integracoes"];
// Telas internas que acompanham uma página principal
const PARENT: Record<string, string> = { "/comecar": "/", "/modelos": "/modelos", "/em-breve": "/" };

export function canSee(path: string, role: string | undefined, areas: string[] | undefined) {
  if (role === "ADMIN") return true;
  const base = "/" + (path.split("/")[1] ?? "");
  const href = PARENT[base] ?? base;
  if (ADMIN_ONLY.includes(href)) return false;
  if (!areas || !areas.length) return true; // sem restrição marcada
  return areas.includes(href);
}
export function firstAllowed(role: string | undefined, areas: string[] | undefined) {
  return ALL_HREFS.find((h) => canSee(h, role, areas)) ?? "/";
}
