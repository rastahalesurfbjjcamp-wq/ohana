// Tipos e metadados das automações (sem banco), usados no servidor e no editor de blocos.

export type Part = { text?: string; mediaUrl?: string; mediaType?: string; fileName?: string; productImage?: boolean };
export type Rule = { check: string; value?: string };
export type Branch = { label?: string; rules: Rule[]; mode?: "all" | "any" };
type Base = { x?: number; y?: number; title?: string };
export type Node = Base &
  (
    | { type: "send"; messageId?: string; parts: Part[]; typing?: number; timeout?: number; utm?: { source?: string; medium?: string; campaign?: string }; next?: string; clicked?: string; replied?: string; noReply?: string }
    | { type: "wait"; amount: number; unit: "min" | "h" | "d"; next?: string }
    | { type: "waitHour"; hour: string; days?: number[]; next?: string }
    | { type: "waitDate"; at: string; next?: string }
    | { type: "waitUntil"; event: "pagou" | "respondeu" | "clicou"; amount: number; unit: "min" | "h" | "d"; met?: string; timeout?: string }
    | { type: "cond"; check: string; value?: string; rules?: Rule[]; mode?: "all" | "any"; yes?: string; no?: string }
    | ({ type: "multi"; branches: Branch[]; else?: string } & Partial<Record<`m${number}`, string>>)
    | { type: "random"; pct: number; a?: string; b?: string }
    | { type: "tag"; action: "add" | "remove"; tag: string; next?: string }
    | { type: "list"; action: "add" | "remove"; listId: string; next?: string }
    | { type: "chat"; action: "transfer" | "archive" | "note" | "ai_on" | "ai_off"; assignee?: string; text?: string; next?: string }
    | { type: "goto"; automationId: string; next?: string }
    | { type: "notify"; to: string; text: string; next?: string }
    | { type: "webhook"; url: string; next?: string }
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
  { k: "cartao_recusado", group: "Pedido", label: "Cartão recusado", desc: "Pedido no cartão que não foi aprovado" },
  { k: "pedido_pago", group: "Pedido", label: "Pedido pago", desc: "Quando o pagamento é aprovado" },
  { k: "primeira_compra", group: "Pedido", label: "Primeira compra", desc: "Primeiro pedido pago do cliente" },
  { k: "pedido_entregue", group: "Pedido", label: "Pedido entregue", desc: "Quando a transportadora marca como entregue" },
  { k: "carrinho_abandonado", group: "Carrinho abandonado", label: "Carrinho abandonado criado", desc: "Quando alguém sai do checkout sem pagar" },
  { k: "rastreio_criado", group: "Número de rastreio", label: "Número de rastreio criado", desc: "Quando o pedido ganha rastreio" },
  { k: "rastreio_atualizado", group: "Número de rastreio", label: "Rastreio atualizado", desc: "A cada mudança de status na entrega" },
  { k: "lead_novo", group: "Lead", label: "Lead inserido", desc: "Quem preenche o formulário do Grupo VIP" },
  { k: "lista", group: "Lead", label: "Adicionado à lista", desc: "Quem entra numa lista (planilha, API ou bloco)" },
  { k: "entrou_grupo", group: "Comunidade", label: "Entrou no grupo", desc: "Entrou num grupo da comunidade" },
  { k: "saiu_grupo", group: "Comunidade", label: "Saiu do grupo", desc: "Saiu de um grupo da comunidade" },
  { k: "assinou_club", group: "Club", label: "Assinou o club", desc: "Pagamento da assinatura confirmado" },
  { k: "manual", group: "Outros", label: "Entrada manual", desc: "Só entra quem você colocar (lista, campanha ou outra automação)" },
];
export const triggerLabel = (k: string) => TRIGGERS.find((t) => t.k === k)?.label ?? k;

// Variáveis das mensagens, por grupo (o editor mostra em menu)
export const VAR_GROUPS: { group: string; vars: { k: string; label: string }[] }[] = [
  { group: "Contato", vars: [{ k: "{nome}", label: "Nome" }, { k: "{nome_completo}", label: "Nome completo" }, { k: "{sobrenome}", label: "Sobrenome" }, { k: "{email}", label: "E-mail" }, { k: "{telefone}", label: "Telefone" }] },
  { group: "Pedido", vars: [{ k: "{pedido}", label: "Nº do pedido" }, { k: "{produtos}", label: "Produtos" }, { k: "{produtos_variante}", label: "Produtos com tamanho" }, { k: "{valor}", label: "Valor total" }, { k: "{subtotal}", label: "Subtotal" }, { k: "{endereco}", label: "Endereço de entrega" }, { k: "{link}", label: "Link do pedido / checkout" }, { k: "{pix}", label: "Link para pagar o Pix" }, { k: "{boleto}", label: "Link do boleto" }, { k: "{vencimento}", label: "Vencimento do boleto" }, { k: "{cupom}", label: "Cupom usado" }] },
  { group: "Entrega", vars: [{ k: "{rastreio}", label: "Código de rastreio" }, { k: "{rastreio_link}", label: "Link de rastreio" }, { k: "{status_entrega}", label: "Status da entrega" }, { k: "{transportadora}", label: "Transportadora" }] },
  { group: "Loja", vars: [{ k: "{loja}", label: "Nome da loja" }, { k: "{site}", label: "Site" }] },
];
export const VARS = VAR_GROUPS.flatMap((g) => g.vars);
export const varLabel = (k: string) => VARS.find((v) => v.k === k)?.label ?? k.replace(/[{}]/g, "");

export const KINDS: { k: string; label: string }[] = [
  { k: "nenhum", label: "Geral" },
  { k: "pedido", label: "Pedido" },
  { k: "carrinho", label: "Carrinho abandonado" },
  { k: "rastreio", label: "Rastreio" },
  { k: "resposta", label: "Resposta rápida" },
];

export const CHECKS: { k: string; label: string; needs?: "list" | "text" | "number" }[] = [
  { k: "pagou", label: "Pagou / comprou" },
  { k: "respondeu", label: "Respondeu" },
  { k: "clicou", label: "Clicou em algum link" },
  { k: "etiqueta", label: "Tem a etiqueta", needs: "text" },
  { k: "lista", label: "Está na lista", needs: "list" },
  { k: "valor_min", label: "Valor maior ou igual a (R$)", needs: "number" },
  { k: "valor_max", label: "Valor menor que (R$)", needs: "number" },
  { k: "produto", label: "Produtos contêm o texto", needs: "text" },
  { k: "pagamento", label: "Forma de pagamento contém", needs: "text" },
  { k: "status_entrega", label: "Status da entrega contém", needs: "text" },
  { k: "club", label: "É membro do club" },
  { k: "hora_entre", label: "Hora entre (ex.: 08-20)", needs: "text" },
  { k: "dia_semana", label: "Dia da semana (ex.: 1-5, seg a sex)", needs: "text" },
];

export type BlockMeta = { type: NodeType; label: string; group: string; tone: string; desc: string };
export const BLOCKS: BlockMeta[] = [
  { type: "send", label: "Enviar WhatsApp", group: "Ação", tone: "t-l", desc: "Manda uma mensagem da biblioteca ou escrita aqui" },
  { type: "notify", label: "Avisar a equipe", group: "Ação", tone: "t-l", desc: "Manda um aviso para um número ou grupo interno" },
  { type: "webhook", label: "Webhook", group: "Ação", tone: "t-k", desc: "Envia os dados do contato para outro sistema" },
  { type: "cond", label: "Condição", group: "Lógica", tone: "t-p", desc: "Separa quem atende e quem não atende" },
  { type: "multi", label: "Condição múltipla", group: "Lógica", tone: "t-p", desc: "Vários caminhos: A, B, C…" },
  { type: "random", label: "Randomizador", group: "Lógica", tone: "t-p", desc: "Divide em dois caminhos para testar" },
  { type: "wait", label: "Aguardar", group: "Tempo", tone: "t-s", desc: "Espera um tempo" },
  { type: "waitUntil", label: "Aguardar acontecer", group: "Tempo", tone: "t-s", desc: "Espera pagar, responder ou clicar, com prazo" },
  { type: "waitHour", label: "Aguardar horário", group: "Tempo", tone: "t-s", desc: "Segue no próximo horário escolhido" },
  { type: "waitDate", label: "Aguardar data e hora", group: "Tempo", tone: "t-s", desc: "Segue numa data marcada" },
  { type: "chat", label: "Atendimento", group: "Atendimento", tone: "t-k", desc: "Transferir, arquivar, nota ou robô de IA" },
  { type: "tag", label: "Etiqueta", group: "Avançado", tone: "t-k", desc: "Coloca ou tira uma etiqueta" },
  { type: "list", label: "Lista", group: "Avançado", tone: "t-k", desc: "Coloca ou tira de uma lista" },
  { type: "goto", label: "Outra automação", group: "Avançado", tone: "t-k", desc: "Coloca a pessoa em outra automação" },
  { type: "exit", label: "Sair", group: "Avançado", tone: "t-c", desc: "Termina a automação" },
  { type: "note", label: "Nota", group: "Extra", tone: "t-n", desc: "Lembrete na tela, não envia nada" },
];
export const blockMeta = (t: string) => BLOCKS.find((b) => b.type === t) ?? BLOCKS[0];

export type Port = { k: string; label: string; tone: "n" | "l" | "c" | "s" | "k" | "p" };
const LETTERS = "ABCDEFGHIJ";
// Saídas de cada bloco (as bolinhas da direita)
export function portsOf(n: Node): Port[] {
  if (n.type === "send") return [
    { k: "clicked", label: "Se clicar em algum link", tone: "s" },
    { k: "replied", label: "Se responder", tone: "l" },
    { k: "noReply", label: "Se não responder", tone: "c" },
    { k: "next", label: "Próxima etapa", tone: "n" },
  ];
  if (n.type === "cond") return [{ k: "yes", label: "Atende à condição", tone: "l" }, { k: "no", label: "Não atende", tone: "c" }];
  if (n.type === "multi") return [...n.branches.slice(0, 10).map((b, i) => ({ k: `m${i}`, label: `${LETTERS[i]}${b.label ? ` · ${b.label}` : ""}`, tone: "p" as const })), { k: "else", label: "Não atende nenhuma", tone: "c" }];
  if (n.type === "waitUntil") return [{ k: "met", label: n.event === "pagou" ? "Pagou" : n.event === "respondeu" ? "Respondeu" : "Clicou", tone: "l" }, { k: "timeout", label: "Passou o prazo", tone: "c" }];
  if (n.type === "random") return [{ k: "a", label: `Caminho A · ${n.pct}%`, tone: "k" }, { k: "b", label: `Caminho B · ${100 - n.pct}%`, tone: "s" }];
  if (n.type === "exit" || n.type === "note") return [];
  return [{ k: "next", label: "Próxima etapa", tone: "n" }];
}
export const PORT_KEYS = ["next", "yes", "no", "clicked", "replied", "noReply", "a", "b", "met", "timeout", "else", "m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"] as const;

export function newNode(type: NodeType): Node {
  switch (type) {
    case "send": return { type, parts: [{ text: "" }], typing: 5, timeout: 60 };
    case "wait": return { type, amount: 1, unit: "h" };
    case "waitHour": return { type, hour: "10:00" };
    case "waitDate": return { type, at: "" };
    case "waitUntil": return { type, event: "pagou", amount: 1, unit: "d" };
    case "cond": return { type, check: "pagou", mode: "all", rules: [{ check: "pagou" }] };
    case "multi": return { type, branches: [{ label: "", rules: [{ check: "pagamento", value: "pix" }] }, { label: "", rules: [{ check: "pagamento", value: "boleto" }] }] };
    case "random": return { type, pct: 50 };
    case "tag": return { type, action: "add", tag: "" };
    case "list": return { type, action: "add", listId: "" };
    case "chat": return { type, action: "transfer", assignee: "" };
    case "goto": return { type, automationId: "" };
    case "notify": return { type, to: "", text: "Novo contato na automação: {nome} {telefone}" };
    case "webhook": return { type, url: "" };
    case "exit": return { type };
    case "note": return { type, text: "" };
  }
}

// Caminho principal do fluxo (para teste e resumo): segue a primeira saída ligada de cada bloco
export function mainPath(flow: Flow, max = 40): string[] {
  const out: string[] = [];
  let id = flow.start;
  const seen = new Set<string>();
  while (id && flow.nodes[id] && !seen.has(id) && out.length < max) {
    seen.add(id);
    out.push(id);
    const n = flow.nodes[id] as Record<string, unknown> & Node;
    const ports = portsOf(n).map((p) => p.k);
    const order = n.type === "send" ? ["next", "noReply", "replied", "clicked"] : ports;
    id = order.map((k) => n[k] as string | undefined).find(Boolean);
  }
  return out;
}
