// Partes do público que rodam também no navegador (sem banco)

export const RFM_SEGMENTS: { k: string; label: string; desc: string; color: string; action: string }[] = [
  { k: "campeoes", label: "Campeões", desc: "Compram sempre, gastam bem e compraram há pouco", color: "#22a25a", action: "Lançamento antes de todo mundo, convite para o club" },
  { k: "leais", label: "Clientes leais", desc: "Compram com frequência e respondem bem", color: "#1e88e5", action: "Novidades e coleção exclusiva" },
  { k: "potenciais", label: "Potenciais leais", desc: "Compraram há pouco, 2 ou 3 vezes", color: "#7cb342", action: "Oferta para a próxima compra virar hábito" },
  { k: "novos", label: "Novos clientes", desc: "Primeira compra bem recente", color: "#00acc1", action: "Boas-vindas e convite para o grupo" },
  { k: "promissores", label: "Promissores", desc: "Uma compra recente, ainda sem repetir", color: "#5e35b1", action: "Mostrar o que combina com o que comprou" },
  { k: "atencao", label: "Precisam de atenção", desc: "Bons clientes que estão esfriando", color: "#f9a825", action: "Mensagem pessoal com novidade" },
  { k: "dormir", label: "Prestes a dormir", desc: "Pouca compra e já faz um tempo", color: "#9e9e9e", action: "Lembrete com condição por tempo limitado" },
  { k: "naoperder", label: "Não podemos perder", desc: "Gastavam muito e sumiram", color: "#e53935", action: "Contato direto, condição forte" },
  { k: "risco", label: "Em risco", desc: "Compravam bem, faz tempo que não voltam", color: "#fb8c00", action: "Campanha de volta com cupom" },
  { k: "hibernando", label: "Hibernando", desc: "Compraram pouco e faz bastante tempo", color: "#757575", action: "Só em promoção grande" },
  { k: "perdidos", label: "Perdidos", desc: "Uma compra, muito tempo atrás", color: "#616161", action: "Black Friday e queima" },
];
export const rfmLabel = (k: string) => RFM_SEGMENTS.find((s) => s.k === k)?.label ?? k;


export type ARule = { field: string; op: string; value?: string };
export const FIELDS: { k: string; label: string; type: "number" | "text" | "rfm" | "bool" | "list" }[] = [
  { k: "spent", label: "Total gasto (R$)", type: "number" },
  { k: "orders", label: "Número de pedidos", type: "number" },
  { k: "days", label: "Dias sem comprar", type: "number" },
  { k: "rfm", label: "Segmento RFM", type: "rfm" },
  { k: "state", label: "Estado (UF)", type: "text" },
  { k: "city", label: "Cidade", type: "text" },
  { k: "tags", label: "Tag na Shopify", type: "text" },
  { k: "etiquetas", label: "Etiqueta na Hub", type: "text" },
  { k: "lists", label: "Está na lista", type: "list" },
  { k: "club", label: "É membro do club", type: "bool" },
  { k: "lead", label: "É lead do Grupo VIP", type: "bool" },
  { k: "customer", label: "Já comprou", type: "bool" },
];
export const OPS: Record<string, { k: string; label: string }[]> = {
  number: [{ k: "gte", label: "maior ou igual a" }, { k: "lte", label: "menor ou igual a" }, { k: "gt", label: "maior que" }, { k: "lt", label: "menor que" }, { k: "eq", label: "igual a" }],
  text: [{ k: "eq", label: "é" }, { k: "contains", label: "contém" }, { k: "neq", label: "não é" }],
  rfm: [{ k: "eq", label: "é" }, { k: "neq", label: "não é" }],
  list: [{ k: "eq", label: "está" }, { k: "neq", label: "não está" }],
  bool: [{ k: "yes", label: "sim" }, { k: "no", label: "não" }],
};

// "Quem entra aqui" em português
export function describe(rules: ARule[], mode: string, listNames: Map<string, string> = new Map()) {
  if (!rules.length) return "Nenhuma regra ainda.";
  return rules.map((r) => {
    const f = FIELDS.find((x) => x.k === r.field);
    if (!f) return r.field;
    if (f.type === "bool") return `${r.op === "no" ? "não " : ""}${f.label.toLowerCase().replace(/^é /, "é ").replace(/^já /, "já ")}`;
    const op = OPS[f.type].find((o) => o.k === r.op)?.label ?? r.op;
    const val = f.type === "rfm" ? rfmLabel(r.value ?? "") : f.type === "list" ? listNames.get(r.value ?? "") ?? "?" : r.value ?? "";
    return `${f.label.charAt(0).toLowerCase()}${f.label.slice(1)} ${op} ${val}`;
  }).join(mode === "any" ? " ou " : " e ");
}

