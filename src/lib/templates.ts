// Modelos prontos de mensagem: escolhe, ajusta e usa.
export type Tpl = { k: string; cat: "Recuperação" | "Pós-venda" | "Comunidade" | "Atendimento"; title: string; desc: string; bubble: string; button?: string; target: string; href: string; texts: string[] };

export const TEMPLATES: Tpl[] = [
  { k: "carrinho", cat: "Recuperação", title: "Carrinho abandonado", desc: "3 mensagens em 30 min, 12 h e 24 h. Para quando a pessoa paga.", bubble: "Oi {nome}, seu carrinho ficou te esperando 🛒\n{produto}", button: "Finalizar compra", target: "recovery.cartSteps", href: "/recuperacao?cfg=carrinho",
    texts: ["Oi {nome}, tudo bem? Vi que você deixou {produto} no carrinho da {loja}. Ainda dá tempo de garantir: {link}", "{nome}, seu carrinho ainda está guardado. Se ficou alguma dúvida de tamanho ou frete, é só responder aqui. {link}", "Última chamada, {nome}: o {produto} pode esgotar no seu tamanho. Finalize aqui: {link}"] },
  { k: "pix", cat: "Recuperação", title: "Pix pendente", desc: "Lembra antes de expirar, com o link para pagar.", bubble: "Seu Pix de {valor} ainda não caiu. O link para pagar está aqui 👇", button: "Pagar agora", target: "recovery.pixSteps", href: "/recuperacao?cfg=pix",
    texts: ["Oi {nome}! Seu pedido {pedido} na {loja} está aguardando o pagamento de {valor}. Para pagar ou gerar um novo Pix: {link}", "{nome}, o pagamento do pedido {pedido} ainda não caiu. Se precisar de ajuda, responda aqui. {link}"] },
  { k: "rastreio", cat: "Pós-venda", title: "Pedido enviado", desc: "Manda o rastreio assim que o pedido é postado.", bubble: "Seu pedido saiu! 📦 Rastreio aqui:", button: "Acompanhar", target: "recovery.trackingText", href: "/recuperacao?cfg=rastreio",
    texts: ["Oi {nome}! Seu pedido {pedido} da {loja} já foi enviado. Acompanhe a entrega aqui: {rastreio}"] },
  { k: "avaliacao", cat: "Pós-venda", title: "Avaliação com foto", desc: "Dias depois da entrega, pede foto e dá o cupom da próxima compra.", bubble: "Chegou? Manda uma foto usando e ganha um cupom 📸", target: "postsale.reviewText", href: "/pos-venda",
    texts: ["Oi {nome}! Seu pedido {pedido} chegou? Conta pra gente o que achou e manda uma foto usando. Como agradecimento, use o cupom {cupom} na próxima compra."] },
  { k: "recompra", cat: "Pós-venda", title: "Lembrete de recompra", desc: "Para quem está um tempo sem comprar.", bubble: "Sentimos sua falta! Chegaram novidades 👀", button: "Ver novidades", target: "postsale.repurchaseText", href: "/pos-venda",
    texts: ["Oi {nome}, sentimos sua falta na {loja}! Chegaram novidades e separamos o cupom {cupom} para você: {link}"] },
  { k: "cupom", cat: "Pós-venda", title: "Cupom para próxima compra", desc: "Junto com a avaliação ou na mensagem de volta.", bubble: "Valeu pela compra! Na próxima, usa esse cupom:", button: "VOLTEI10", target: "postsale.reviewText", href: "/pos-venda",
    texts: ["Valeu pela compra, {nome}! Na próxima, usa o cupom {cupom} e ganha desconto em qualquer peça da {loja}."] },
  { k: "boasvindas", cat: "Comunidade", title: "Boas-vindas do lead", desc: "Na hora do cadastro, com o link do grupo com vaga.", bubble: "Seu acesso ao Grupo VIP tá aqui embaixo 👇", button: "Entrar no grupo", target: "leads.welcomeText", href: "/leads?cfg=1",
    texts: ["Oi {nome}, aqui é da {loja}! Seu acesso ao Grupo VIP está aqui: {link}. Lá você vê os lançamentos antes de todo mundo."] },
  { k: "volta", cat: "Comunidade", title: "Saiu do grupo", desc: "Uma mensagem só, no privado, com o link de volta.", bubble: "Vimos que você saiu da comunidade. Se quiser voltar, o link é este 👇", button: "Voltar ao grupo", target: "winback.text", href: "/entradas",
    texts: ["Oi {nome}! Vimos que você saiu do {grupo}. Se foi sem querer ou quiser voltar, o link é este: {link}"] },
  { k: "lancamento", cat: "Comunidade", title: "Aquecimento de drop", desc: "As 6 mensagens do lançamento, de 7 dias antes até as últimas peças.", bubble: "Daqui a 7 dias chega o drop. Só quem está aqui vê primeiro 🔥", target: "", href: "/lancamento?novo=1", texts: [] },
  { k: "ausencia", cat: "Atendimento", title: "Fora do horário", desc: "Regra para o assistente responder de madrugada.", bubble: "Oi! Agora a equipe está fora, mas eu te ajudo com tamanho, estoque e pedido.", target: "", href: "/assistente", texts: [] },
  { k: "troca", cat: "Atendimento", title: "Troca de tamanho", desc: "Resposta pronta com o link da página de troca.", bubble: "Faz a troca por aqui, é rapidinho 👇", button: "Trocar tamanho", target: "", href: "/atendimento", texts: [] },
  { k: "atraso", cat: "Atendimento", title: "Pedido atrasado", desc: "Para quando o rastreio parou.", bubble: "Já falei com a transportadora sobre o seu pedido e te aviso aqui assim que mexer.", target: "", href: "/entregas?f=alerta", texts: [] },
];
