// Modelos prontos de automação. Ao usar um modelo, as mensagens vão para a biblioteca
// (pasta com o nome da automação) e o fluxo já vem montado na tela, desligado.
import type { Flow, Node, Part } from "./flowTypes";

type Msg = { key: string; name: string; kind: string; parts: Part[] };
export type FlowTemplate = {
  key: string;
  name: string;
  cat: string;
  desc: string;
  trigger: string;
  config: { delayMin?: number; stopOnPaid?: boolean };
  msgs: Msg[];
  // nós com posição; em "send" o campo msg aponta para a chave da mensagem
  nodes: Record<string, Node & { msg?: string }>;
  start: string;
};

const S = (x: number, y: number, msg: string, extra: Partial<Extract<Node, { type: "send" }>> = {}) => ({ type: "send" as const, parts: [], typing: 5, timeout: 60, x, y, msg, ...extra });

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    key: "carrinho", name: "Carrinho abandonado", cat: "Recuperação", trigger: "carrinho_abandonado",
    desc: "Três mensagens: lembrete com a foto do produto, reforço depois de 3 horas e último aviso no dia seguinte. Para se a pessoa comprar.",
    config: { delayMin: 30, stopOnPaid: true },
    msgs: [
      { key: "c1", name: "Carrinho 1: lembrete", kind: "carrinho", parts: [{ productImage: true, text: "Oi {nome}, tudo bem?\n\nVi que você separou {produtos} na Rasta e não finalizou. Guardei pra você por um tempo, é só terminar por aqui:\n{link}" }] },
      { key: "c2", name: "Carrinho 2: reforço", kind: "carrinho", parts: [{ text: "{nome}, seu carrinho ainda está salvo.\n\nSe ficou alguma dúvida de tamanho, frete ou pagamento, me responde aqui que eu te ajudo.\n\n{link}" }] },
      { key: "c3", name: "Carrinho 3: último aviso", kind: "carrinho", parts: [{ text: "Último aviso, {nome}: o estoque desse modelo está acabando e não consigo segurar por muito mais tempo.\n\nFinaliza aqui: {link}" }] },
    ],
    start: "s1",
    nodes: {
      s1: S(340, 160, "c1", { next: "u1" }),
      u1: { type: "waitUntil", event: "pagou", amount: 3, unit: "h", x: 680, y: 220, met: "x1", timeout: "s2" },
      s2: S(980, 120, "c2", { next: "u2" }),
      u2: { type: "waitUntil", event: "pagou", amount: 1, unit: "d", x: 1320, y: 180, met: "x1", timeout: "s3" },
      s3: S(1620, 120, "c3", { next: "x1" }),
      x1: { type: "exit", x: 1960, y: 360 },
    },
  },
  {
    key: "pix", name: "Pix pendente", cat: "Recuperação", trigger: "pedido_pix",
    desc: "Lembra o Pix em aberto 15 minutos depois e de novo em 6 horas se ainda não pagou.",
    config: { delayMin: 15, stopOnPaid: true },
    msgs: [
      { key: "p1", name: "Pix 1: pagamento em aberto", kind: "pedido", parts: [{ text: "Oi {nome}, seu pedido {pedido} está reservado, só falta o Pix.\n\nTotal: {valor}\nPara pagar: {pix}\n\nAssim que cair, eu já separo pra envio." }] },
      { key: "p2", name: "Pix 2: lembrete", kind: "pedido", parts: [{ text: "{nome}, o Pix do pedido {pedido} ainda não apareceu aqui.\n\nSe precisar de um novo código ou quiser pagar no cartão, é só me responder.\n{pix}" }] },
    ],
    start: "s1",
    nodes: {
      s1: S(340, 160, "p1", { next: "u1" }),
      u1: { type: "waitUntil", event: "pagou", amount: 6, unit: "h", x: 680, y: 220, met: "x1", timeout: "s2" },
      s2: S(980, 140, "p2", { next: "x1" }),
      x1: { type: "exit", x: 1320, y: 360 },
    },
  },
  {
    key: "boleto", name: "Boleto pendente", cat: "Recuperação", trigger: "pedido_boleto",
    desc: "Manda o boleto com o vencimento e lembra 2 dias depois se não pagou.",
    config: { delayMin: 30, stopOnPaid: true },
    msgs: [
      { key: "b1", name: "Boleto 1: link do boleto", kind: "pedido", parts: [{ text: "Oi {nome}, seu boleto do pedido {pedido} está aqui:\n{boleto}\n\nValor: {valor}\nVencimento: {vencimento}" }] },
      { key: "b2", name: "Boleto 2: vence logo", kind: "pedido", parts: [{ text: "{nome}, o boleto do pedido {pedido} vence em breve ({vencimento}).\n\nSe preferir pagar no Pix ou cartão, me responde aqui.\n{boleto}" }] },
    ],
    start: "s1",
    nodes: {
      s1: S(340, 160, "b1", { next: "u1" }),
      u1: { type: "waitUntil", event: "pagou", amount: 2, unit: "d", x: 680, y: 220, met: "x1", timeout: "s2" },
      s2: S(980, 140, "b2", { next: "x1" }),
      x1: { type: "exit", x: 1320, y: 360 },
    },
  },
  {
    key: "cartao", name: "Cartão recusado", cat: "Recuperação", trigger: "cartao_recusado",
    desc: "Avisa que o cartão não passou e oferece ajuda. Se responder, vai para o atendimento.",
    config: { delayMin: 0, stopOnPaid: true },
    msgs: [
      { key: "k1", name: "Cartão recusado", kind: "pedido", parts: [{ text: "Oi {nome}, o pagamento do pedido {pedido} no cartão não foi aprovado pelo banco.\n\nAcontece bastante. Dá pra tentar de novo, usar outro cartão ou pagar no Pix por aqui:\n{link}\n\nSe quiser, me responde que eu te ajudo." }] },
    ],
    start: "s1",
    nodes: {
      s1: S(340, 160, "k1", { replied: "c1", next: "x1", timeout: 240 }),
      c1: { type: "chat", action: "transfer", assignee: "", x: 700, y: 120, next: "x1" },
      x1: { type: "exit", x: 1000, y: 340 },
    },
  },
  {
    key: "pago", name: "Pedido pago", cat: "Pós-venda", trigger: "pedido_pago",
    desc: "Confirma o pagamento na hora, com o número do pedido e os produtos.",
    config: { delayMin: 0 },
    msgs: [{ key: "g1", name: "Pagamento confirmado", kind: "pedido", parts: [{ text: "Pagamento confirmado, {nome}!\n\nPedido {pedido}: {produtos_variante}\n\nAgora é com a gente: separamos e te mando o rastreio assim que sair." }] }],
    start: "s1",
    nodes: { s1: S(340, 160, "g1", { next: "x1" }), x1: { type: "exit", x: 680, y: 300 } },
  },
  {
    key: "rastreio", name: "Código de rastreio criado", cat: "Entrega", trigger: "rastreio_criado",
    desc: "Manda o código e o link de rastreio quando o pedido é postado.",
    config: { delayMin: 0 },
    msgs: [{ key: "r1", name: "Rastreio criado", kind: "rastreio", parts: [{ text: "{nome}, seu pedido {pedido} já foi postado!\n\nCódigo: {rastreio}\nAcompanhe aqui: {rastreio_link}" }] }],
    start: "s1",
    nodes: { s1: S(340, 160, "r1", { next: "x1" }), x1: { type: "exit", x: 680, y: 300 } },
  },
  {
    key: "rastreio_status", name: "Rastreio atualizado", cat: "Entrega", trigger: "rastreio_atualizado",
    desc: "Uma mensagem para cada etapa importante da entrega. Falha na entrega também avisa a equipe.",
    config: { delayMin: 0 },
    msgs: [
      { key: "t1", name: "Saiu para entrega", kind: "rastreio", parts: [{ text: "{nome}, seu pedido {pedido} saiu para entrega hoje! Fica de olho que chega já já." }] },
      { key: "t2", name: "Aguardando retirada", kind: "rastreio", parts: [{ text: "{nome}, seu pedido {pedido} está esperando retirada na agência.\n\nDetalhes: {rastreio_link}" }] },
      { key: "t3", name: "Falha na entrega", kind: "rastreio", parts: [{ text: "{nome}, a transportadora tentou entregar o pedido {pedido} e não conseguiu.\n\nMe responde aqui que eu vejo com você a melhor forma de receber." }] },
      { key: "t4", name: "Entregue", kind: "rastreio", parts: [{ text: "Chegou! O pedido {pedido} foi entregue, {nome}. Qualquer coisa com tamanho ou troca, é só me chamar aqui." }] },
    ],
    start: "m1",
    nodes: {
      m1: { type: "multi", x: 340, y: 160, branches: [{ label: "saiu", rules: [{ check: "status_entrega", value: "saiu" }] }, { label: "retirada", rules: [{ check: "status_entrega", value: "retirada" }] }, { label: "falha", rules: [{ check: "status_entrega", value: "falha" }] }, { label: "entregue", rules: [{ check: "status_entrega", value: "entregue" }] }], m0: "s1", m1: "s2", m2: "s3", m3: "s4", else: "x1" },
      s1: S(720, 20, "t1", { next: "x1" }),
      s2: S(720, 340, "t2", { next: "x1" }),
      s3: S(720, 660, "t3", { next: "n1" }),
      n1: { type: "chat", action: "transfer", assignee: "", x: 1060, y: 700, next: "x1" },
      s4: S(720, 980, "t4", { next: "x1" }),
      x1: { type: "exit", x: 1400, y: 520 },
    },
  },
  {
    key: "avaliacao", name: "Pós entrega com avaliação", cat: "Pós-venda", trigger: "pedido_entregue",
    desc: "Dois dias depois da entrega pergunta se chegou tudo certo e pede uma foto. Quem responde ganha a etiqueta avaliou.",
    config: { delayMin: 0 },
    msgs: [{ key: "a1", name: "Pedido chegou bem?", kind: "pedido", parts: [{ text: "Oi {nome}, o pedido {pedido} chegou certinho?\n\nSe puder, me manda uma foto usando. A gente adora ver e ajuda muito quem está escolhendo o tamanho." }] }],
    start: "w1",
    nodes: {
      w1: { type: "wait", amount: 2, unit: "d", x: 340, y: 200, next: "s1" },
      s1: S(640, 140, "a1", { replied: "t1", next: "x1", timeout: 1440 }),
      t1: { type: "tag", action: "add", tag: "avaliou", x: 1000, y: 120, next: "x1" },
      x1: { type: "exit", x: 1300, y: 360 },
    },
  },
  {
    key: "recompra", name: "Lembrete de recompra", cat: "Pós-venda", trigger: "pedido_entregue",
    desc: "30 dias depois da entrega mostra as novidades. Membros do club recebem uma mensagem própria.",
    config: { delayMin: 0 },
    msgs: [
      { key: "q1", name: "Recompra: novidades", kind: "nenhum", parts: [{ text: "{nome}, faz um mês que sua Rasta chegou. Já tem coisa nova na loja, dá uma olhada: {site}" }] },
      { key: "q2", name: "Recompra: club", kind: "nenhum", parts: [{ text: "{nome}, lembrete do club: seu desconto continua valendo nas peças novas. Dá uma olhada: {site}" }] },
    ],
    start: "w1",
    nodes: {
      w1: { type: "wait", amount: 30, unit: "d", x: 340, y: 200, next: "c1" },
      c1: { type: "cond", check: "club", rules: [{ check: "club" }], mode: "all", x: 640, y: 200, yes: "s2", no: "s1" },
      s1: S(980, 300, "q1", { next: "x1" }),
      s2: S(980, 0, "q2", { next: "x1" }),
      x1: { type: "exit", x: 1320, y: 300 },
    },
  },
  {
    key: "primeira", name: "Boas-vindas na primeira compra", cat: "Pós-venda", trigger: "primeira_compra",
    desc: "Agradece a primeira compra e marca o cliente com a etiqueta cliente-novo.",
    config: { delayMin: 5 },
    msgs: [{ key: "f1", name: "Primeira compra", kind: "pedido", parts: [{ text: "{nome}, obrigado pela sua primeira compra na Rasta!\n\nPedido {pedido} confirmado. Qualquer dúvida de tamanho, troca ou entrega, fala comigo por aqui mesmo." }] }],
    start: "s1",
    nodes: {
      s1: S(340, 160, "f1", { next: "t1" }),
      t1: { type: "tag", action: "add", tag: "cliente-novo", x: 680, y: 200, next: "x1" },
      x1: { type: "exit", x: 980, y: 300 },
    },
  },
  {
    key: "lead", name: "Boas-vindas ao lead", cat: "Leads", trigger: "lead_novo",
    desc: "Mensagem de boas-vindas para quem entra pelo formulário. Se responder, liga o atendimento.",
    config: { delayMin: 1 },
    msgs: [{ key: "l1", name: "Boas-vindas ao lead", kind: "nenhum", parts: [{ text: "Oi {nome}, aqui é da Rasta Hale. Recebi seu cadastro!\n\nPor aqui você fica sabendo antes dos lançamentos e das condições do grupo. Se quiser ajuda pra escolher alguma peça, me responde." }] }],
    start: "s1",
    nodes: {
      s1: S(340, 160, "l1", { replied: "c1", next: "x1", timeout: 720 }),
      c1: { type: "chat", action: "transfer", assignee: "", x: 700, y: 120, next: "x1" },
      x1: { type: "exit", x: 1000, y: 340 },
    },
  },
];

export const TEMPLATE_CATS = [...new Set(FLOW_TEMPLATES.map((t) => t.cat))];

// Monta o fluxo final trocando "msg" pelo id da mensagem criada na biblioteca
export function buildFlow(t: FlowTemplate, ids: Record<string, string>): Flow {
  const nodes: Flow["nodes"] = {};
  for (const [k, n] of Object.entries(t.nodes)) {
    const { msg, ...rest } = n as Node & { msg?: string };
    nodes[k] = (msg ? { ...rest, messageId: ids[msg] } : rest) as Node;
  }
  return { start: t.start, startPos: { x: 20, y: 200 }, nodes };
}
