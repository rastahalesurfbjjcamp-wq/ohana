// Tipos e metadados das automações (sem banco), usados no servidor e no editor de blocos.

export type Part = { text?: string; mediaUrl?: string; mediaType?: string; productImage?: boolean };
export type Rule = { check: string; value?: string };
type Base = { x?: number; y?: number; title?: string };
export type Node = Base &
  (
    | { type: "send"; parts: Part[]; typing?: number; timeout?: number; utm?: { source?: string; medium?: string; campaign?: string }; next?: string; clicked?: string; replied?: string; noReply?: string }
    | { type: "wait"; amount: number; unit: "min" | "h" | "d"; next?: string }
    | { type: "waitHour"; hour: string; days?: number[]; next?: string }
    | { type: "cond"; check: string; value?: string; rules?: Rule[]; mode?: "all" | "any"; yes?: string; no?: string }
    | { type: "random"; pct: number; a?: string; b?: string }
    | { type: "tag"; action: "add" | "remove"; tag: string; next?: string }
    | { type: "list"; action: "add" | "remove"; listId: string; next?: string }
    | { type: "exit" }
    | { type: "note"; text: string; color?: string }
  );
export type NodeType = Node["type"];
export type Flow = { start?: string; startPos?: { x: number; y: number }; nodes: Record<string, Node> };
export type Ctx = Record<string, string>;

export const TRIGGERS: { k: string; group: string; label: string; desc: string }[] = [
  { k: "pedido_criado", group: "Pedido", label: "Pedido criado", desc: "Quando entra um pedido novo" },
  { k: "pedido_pix", group: "Pedido", label: "Pedido criado (Pix)", desc: "Pedido com Pix gerado e ainda não pago" },
  { k: "pedido_boleto", group: "Pedido", label: "Pedido criado (Boleto)", desc: "Pedido com boleto gerado e ainda não pago" },
  { k: "pedido_pago", group: "Pedido", label: "Pedido pago", desc: "Quando o pagamento é aprovado" },
  { k: "primeira_compra", group: "Pedido", label: "Primeira compra", desc: "Primeiro pedido pago do cliente" },
  { k: "pedido_entregue", group: "Pedido", label: "Pedido entregue", desc: "Quando a transportadora marca como entregue" },
  { k: "carrinho_abandonado", group: "Carrinho abandonado", label: "Carrinho abandonado criado", desc: "Quando alguém sai do checkout sem pagar" },
  { k: "rastreio_criado", group: "Número de rastreio", label: "Número de rastreio criado", desc: "Quando o pedido ganha rastreio" },
  { k: "lead_novo", group: "Lead", label: "Lead inserido", desc: "Quem preenche o formulário do Grupo VIP" },
  { k: "lista", group: "Lead", label: "Adicionado à lista", desc: "Quem entra numa lista (planilha, API ou bloco)" },
  { k: "entrou_grupo", group: "Comunidade", label: "Entrou no grupo", desc: "Entrou num grupo da comunidade" },
  { k: "saiu_grupo", group: "Comunidade", label: "Saiu do grupo", desc: "Saiu de um grupo da comunidade" },
  { k: "assinou_club", group: "Club", label: "Assinou o club", desc: "Pagamento da assinatura confirmado" },
];
export const triggerLabel = (k: string) => TRIGGERS.find((t) => t.k === k)?.label ?? k;

export const VARS: { k: string; label: string }[] = [
  { k: "{nome}", label: "Nome" },
  { k: "{produtos}", label: "Produtos" },
  { k: "{valor}", label: "Valor" },
  { k: "{link}", label: "Link" },
  { k: "{pedido}", label: "Nº do pedido" },
  { k: "{rastreio}", label: "Rastreio" },
  { k: "{loja}", label: "Loja" },
];

export const CHECKS: { k: string; label: string; needs?: "list" | "text" | "number" }[] = [
  { k: "pagou", label: "Pagou / comprou" },
  { k: "respondeu", label: "Respondeu" },
  { k: "clicou", label: "Clicou em algum link" },
  { k: "etiqueta", label: "Tem a etiqueta", needs: "text" },
  { k: "lista", label: "Está na lista", needs: "list" },
  { k: "valor_min", label: "Valor maior ou igual a (R$)", needs: "number" },
  { k: "produto", label: "Produtos contêm o texto", needs: "text" },
];

export type BlockMeta = { type: NodeType; label: string; group: string; tone: string };
export const BLOCKS: BlockMeta[] = [
  { type: "send", label: "Enviar WhatsApp", group: "Ação", tone: "t-l" },
  { type: "cond", label: "Condição", group: "Lógica", tone: "t-p" },
  { type: "random", label: "Randomizador", group: "Lógica", tone: "t-p" },
  { type: "wait", label: "Aguardar", group: "Tempo", tone: "t-s" },
  { type: "waitHour", label: "Aguardar horário", group: "Tempo", tone: "t-s" },
  { type: "tag", label: "Etiqueta", group: "Avançado", tone: "t-k" },
  { type: "list", label: "Lista", group: "Avançado", tone: "t-k" },
  { type: "exit", label: "Sair", group: "Avançado", tone: "t-c" },
  { type: "note", label: "Nota", group: "Extra", tone: "t-n" },
];
export const blockMeta = (t: string) => BLOCKS.find((b) => b.type === t) ?? BLOCKS[0];

export type Port = { k: string; label: string; tone: "n" | "l" | "c" | "s" | "k" };
// Saídas de cada bloco (as bolinhas da direita)
export function portsOf(n: Node): Port[] {
  if (n.type === "send") return [
    { k: "clicked", label: "Se clicar em algum link", tone: "s" },
    { k: "replied", label: "Se responder", tone: "l" },
    { k: "noReply", label: "Se não responder", tone: "c" },
    { k: "next", label: "Próxima etapa", tone: "n" },
  ];
  if (n.type === "cond") return [{ k: "yes", label: "Atende à condição", tone: "l" }, { k: "no", label: "Não atende", tone: "c" }];
  if (n.type === "random") return [{ k: "a", label: `Caminho A · ${n.pct}%`, tone: "k" }, { k: "b", label: `Caminho B · ${100 - n.pct}%`, tone: "s" }];
  if (n.type === "exit" || n.type === "note") return [];
  return [{ k: "next", label: "Próxima etapa", tone: "n" }];
}
export const PORT_KEYS = ["next", "yes", "no", "clicked", "replied", "noReply", "a", "b"] as const;

export function newNode(type: NodeType): Node {
  switch (type) {
    case "send": return { type, parts: [{ text: "" }], typing: 5, timeout: 60 };
    case "wait": return { type, amount: 1, unit: "h" };
    case "waitHour": return { type, hour: "10:00" };
    case "cond": return { type, check: "pagou", mode: "all", rules: [{ check: "pagou" }] };
    case "random": return { type, pct: 50 };
    case "tag": return { type, action: "add", tag: "" };
    case "list": return { type, action: "add", listId: "" };
    case "exit": return { type };
    case "note": return { type, text: "" };
  }
}
