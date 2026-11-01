// Mensagens e automações copiadas do Reportana (as da conta e os modelos prontos de lá),
// já com as variáveis do Hub. Entram na biblioteca uma vez e ficam prontas para usar.
import type { Node, Part } from "./flowTypes";
import type { FlowTemplate } from "./flowTemplates";

type M = { key: string; folder: string; name: string; kind: string; parts: Part[] };

const LINK_HELP: Part = { text: "_Caso não esteja conseguindo acessar o link, adicione o nosso número a seus contatos e tente novamente._" };
const IMG: Part = { productImage: true };
const RAST = "\n\nVocê pode acompanhar o rastreio através do seguinte link: {rastreio_link}";

const F_RAST = "Reportana: Rastreio por status";
const F_CARR = "Reportana: Carrinho abandonado";
const F_FUNIL = "Reportana: Funil de recuperação";
const F_CART = "Reportana: Cartão recusado";
const F_PIX = "Reportana: Pix";
const F_MOD = "Reportana: Modelos prontos";
const F_AUTO = "Reportana: Automações prontas";
const F_RESP = "Reportana: Respostas de atendimento";

const PIX_1 = "Olá {nome}, tudo bem? 😁\n\nParabéns, você escolheu um produto incrível! 🤩\n\n📦 O seu pedido já está sendo reservado, só estamos esperando a confirmação do pagamento para prepararmos o envio.\n\n📌 Detalhes do pedido: *{pedido}*\n{produtos_variante}\n\n🚚 Endereço: *{endereco}*\n\n🏷 Pagamento: *PIX*\n💵 Valor: *{valor}*\n\n⚠️ Caso seu código PIX tenha expirado é só gerar um novo.\n\nSe preferir pode usar outras formas de pagamento como *Boleto* ou *Cartão.*\n\n*Obs:* _Caso já tenha realizado o pagamento, enviaremos uma mensagem confirmando a compra :)_";

export const REPORTANA_MSGS: M[] = [
  // Automação "Atualização de rastreio por status"
  { key: "rs_postado", folder: F_RAST, name: "Status: Postado", kind: "rastreio", parts: [{ text: `Olá {nome} 👋\n\nVim para te informar que o seu pedido, *{pedido}*, foi *POSTADO* 📦${RAST}` }] },
  { key: "rs_transito", folder: F_RAST, name: "Status: Em trânsito", kind: "rastreio", parts: [{ text: `Olá {nome} 👋\n\nSua encomenda, *{pedido}*, está *EM TRÂNSITO* 🚛 Imagino que esteja ansioso para receber o seu pacote, e ele já está quase chegando! 😜${RAST}` }] },
  { key: "rs_saiu", folder: F_RAST, name: "Status: Saiu para a entrega", kind: "rastreio", parts: [{ text: `Olá {nome} 👋\n\nSua encomenda *SAIU PARA A ENTREGA* 🎉 Aguarde no endereço informado no cadastro para receber o seu pedido *{pedido}* 🏠${RAST}` }] },
  { key: "rs_retirada", folder: F_RAST, name: "Status: Aguardando retirada", kind: "rastreio", parts: [{ text: `Olá {nome} 👋\n\nO seu pedido, *{pedido}*, está *AGUARDANDO RETIRADA* na agência 🏫 Para conferir o endereço acesse o link de rastreio.${RAST}` }] },
  { key: "rs_falha", folder: F_RAST, name: "Status: Falha na tentativa de entrega", kind: "rastreio", parts: [{ text: `Olá {nome} 👋\n\nVim para te informar que o seu pedido, *{pedido}*, teve *FALHA NA TENTATIVA DE ENTREGA* ❌ Aguarde que informaremos os próximos passos.${RAST}` }] },
  { key: "rs_entregue", folder: F_RAST, name: "Status: Entregue", kind: "rastreio", parts: [{ text: `Olá {nome} 👋\n\nO seu pedido, *{pedido}*, foi *ENTREGUE* 🤩 Esperamos que goste!\n\nAproveite e avalie o produto 😉${RAST}` }] },
  { key: "rs_devolvido", folder: F_RAST, name: "Status: Devolvido ao remetente", kind: "rastreio", parts: [{ text: `Olá {nome} 👋\n\nVim para te informar que o seu pedido, *{pedido}*, foi *DEVOLVIDO AO REMETENTE* 😕${RAST}` }] },

  // Automação "Recuperação de carrinhos abandonados (Básico)"
  { key: "ca_1", folder: F_CARR, name: "Carrinho 1: reservamos o seu pedido", kind: "carrinho", parts: [IMG, { text: "Olá {nome}, tudo bem? 😁\n\nReservamos o seu pedido, porém não conseguiremos segurar por muito tempo devido à alta demanda de pedidos! 😱\n\nCorra antes que acabe. 🏃‍♂️ Basta acessar o link abaixo 👇" }, { text: "{link}" }, LINK_HELP] },
  { key: "ca_2", folder: F_CARR, name: "Carrinho 2: frete grátis", kind: "carrinho", parts: [{ text: "Olá, {nome}, tudo bem?\n\nFinalize a sua compra agora mesmo e garanta o *Frete Grátis!* 📦\n\nClique no link abaixo: 👇\n\n{link}" }] },
  { key: "ca_3", folder: F_CARR, name: "Carrinho 3: últimas unidades", kind: "carrinho", parts: [{ text: "E aí {nome}\n\nVi que ainda não finalizou a sua compra. 😕\n\nVim te avisar que estamos com as *últimas unidades no estoque.* Ainda estamos com a sua reservada, finalize a compra AINDA HOJE e garanta a sua. 😉\n\nClique no link abaixo para finalizar a compra: 👇\n\n{link}" }, IMG] },

  // Automação "funil de recuperação" (a que está ligada no Reportana)
  { key: "fu_1", folder: F_FUNIL, name: "Funil 1: reservamos o seu pedido", kind: "carrinho", parts: [IMG, { text: "Olá {nome}, tudo bem? 😁\n\nReservamos o seu pedido, porém não conseguiremos segurar por muito tempo devido à alta demanda de pedidos! 😱\n\nCorra antes que acabe. 🏃‍♂️ Basta acessar o link abaixo 👇\n{link}" }] },
  { key: "fu_2", folder: F_FUNIL, name: "Funil 2: finalize a compra", kind: "carrinho", parts: [{ text: "Olá, {nome}, tudo bem?\n\nFinalize a sua compra agora mesmo e garanta o seu 📦\n\nClique no link abaixo: 👇\n{link}" }] },
  { key: "fu_3", folder: F_FUNIL, name: "Funil 3: últimas unidades", kind: "carrinho", parts: [{ text: "E aí {nome}\n\nVi que ainda não finalizou a sua compra. 😕\n\nVim te avisar que estamos com as *últimas unidades no estoque.* Ainda estamos com a sua reservada, finalize a compra AINDA HOJE e garanta a sua. 😉\n\nClique no link abaixo para finalizar a compra: 👇\n{link}" }] },

  // Automação "Recuperação de cartão recusado"
  { key: "cr_1", folder: F_CART, name: "Cartão recusado 1: outra forma de pagamento", kind: "carrinho", parts: [{ text: "Olá {nome}, tudo bem? 😃\n\nVerificamos que seu pedido teve o cartão recusado 💳, mas não se preocupe. Reservamos para você, ele está a sua espera 🛍️\n\nVocê pode clicar no link abaixo para continuar seu pedido e escolher outra forma de pagamento como *PIX*." }, { text: "{link}" }, LINK_HELP] },
  { key: "cr_2", folder: F_CART, name: "Cartão recusado 2: produto em oferta", kind: "carrinho", parts: [{ text: "Olá {nome}, tudo bem?\n\nO seu produto está em oferta! 🔥\n\nClique no link abaixo e aproveite o valor promocional do produto que gostou. Esse valor irá subir nos próximos dias! Então corra e garanta o seu 🫶" }, { text: "{link}" }, LINK_HELP, IMG] },
  { key: "cr_3", folder: F_CART, name: "Cartão recusado 3: estoque baixo", kind: "carrinho", parts: [{ text: "Olá {nome}, tudo bem?\n\nVim aqui hoje para avisar que o produto que você gostou está com o estoque baixo 🥲\n\nCorra e garanta o seu, são as *ÚLTIMAS UNIDADES*. Basta clicar no link abaixo e finalizar a compra e ainda garanta o seu *FRETE GRÁTIS* 😲" }, { text: "{link}" }, LINK_HELP, IMG] },

  // Automação "Recuperação de Pix"
  { key: "px_1", folder: F_PIX, name: "Pix 1: detalhes do pedido", kind: "pedido", parts: [{ text: PIX_1 }, { text: "{pix}" }] },
  { key: "px_2", folder: F_PIX, name: "Pix 2: Pix expirando", kind: "pedido", parts: [{ text: "Olá {nome}\n\nO seu pedido Pix está expirando!\n\nJá reservamos o seu pacote. 📦 Só estamos aguardando a confirmação de pagamento para realizar o envio 🌟" }, { text: "Pague pelo link abaixo 👇" }, { text: "{pix}" }] },
  { key: "px_3", folder: F_PIX, name: "Pix 3: prazo expirou", kind: "pedido", parts: [{ text: "Infelizmente o prazo para pagamento do seu pedido expirou. Mas não se preocupe, corra pro nosso site e realize o pedido novamente, mas vá logo, estamos com poucas unidades 🏃‍♂️" }] },

  // Modelos prontos de mensagem do Reportana
  { key: "mo_boleto", folder: F_MOD, name: "Recuperação de boleto", kind: "pedido", parts: [IMG, { text: "Olá {nome}, tudo bem? 😁\n\nParabéns, você escolheu um produto incrível! 🤩\n\n📦 O seu pedido já está sendo reservado, só estamos esperando a confirmação do pagamento para prepararmos o envio.\n\n📌 Detalhes do pedido: *{pedido}*\n{produtos_variante}\n\n🚚 Endereço: *{endereco}*\n\n🏷 Pagamento: *Boleto Bancário*\n🗓️ Vencimento: *{vencimento}*\n💵 Valor: *{valor}*\n\n⚠️ Caso ainda não tenha realizado o pagamento, segue o link para emissão do boleto: {boleto}\n\n*Obs:* _Caso já tenha realizado o pagamento, enviaremos uma mensagem confirmando a compra :)_" }] },
  { key: "mo_confirmado", folder: F_MOD, name: "Pedido confirmado", kind: "pedido", parts: [{ text: "Olá {nome}, tudo bem? 😁\n\nVocê fez uma ótima escolha na {loja} 🛍️. O seu pedido *{pedido}* foi confirmado e já está sendo preparado para o envio 🚚\n\nPode ficar tranquilo que venho te avisar sobre as próximas movimentações do seu pedido 😉" }] },
  { key: "mo_rastreio", folder: F_MOD, name: "Número de rastreio criado", kind: "rastreio", parts: [{ text: "Olá {nome} 👋\n\nSeu pedido *{pedido}* já está com a transportadora responsável pela entrega 🚚\n\n📦 Esse é o seu número de rastreio: *{rastreio}*\n\nVocê pode acompanhar através do seguinte link: {rastreio_link}\n\nQualquer dúvida basta nos comunicar!" }] },
  { key: "mo_rastreio_at", folder: F_MOD, name: "Número de rastreio atualizado", kind: "rastreio", parts: [{ text: "Olá {nome} 👋\n\nInformamos que o rastreio do seu pedido *{pedido}* foi atualizado 🙌\n\n📦 Esse é o seu número de rastreio: *{rastreio}*\n\nVocê pode acompanhar através do seguinte link: {rastreio_link}\n\nQualquer dúvida basta nos comunicar!" }] },
  { key: "mo_cartao", folder: F_MOD, name: "Carrinho com cartão recusado", kind: "carrinho", parts: [IMG, { text: "Olá {nome}, tudo bem? 😃\n\nVerificamos que seu pedido teve o cartão recusado 💳, mas não se preocupe. Reservamos para você, ele está a sua espera 🛍️\n\nVocê pode clicar no link abaixo para continuar seu pedido e escolher outra forma de pagamento como *Boleto* ou *PIX*." }, { text: "{link}" }] },

  // Mensagens das automações prontas do Reportana
  { key: "au_lead1", folder: F_AUTO, name: "Captura de lead 1: boas-vindas", kind: "nenhum", parts: [{ text: "Olá, tudo bem?" }, { text: "Muito obrigado por entrar em contato conosco ✌️😉" }, { text: "Gostaríamos de sempre te manter informado sobre nossas *Novidades e Promoções*. 🛍️ Para isso, pedimos que passe algumas informações." }, { text: "Qual é o seu nome completo?" }] },
  { key: "au_lead2", folder: F_AUTO, name: "Captura de lead 2: e-mail", kind: "nenhum", parts: [{ text: "Qual é o seu endereço de e-mail?" }] },
  { key: "au_cupom", folder: F_AUTO, name: "Cupom para a próxima compra", kind: "pedido", parts: [{ text: "Olá, tudo bem?" }, { text: "Muito obrigado por comprar conosco! 😊" }, { text: "Temos um *presente* para você. 🎁 Ganhe um desconto na sua próxima compra conosco. Adicione o cupom de desconto: SEUCUPOM" }] },
  { key: "au_recompra1", folder: F_AUTO, name: "Lembrete de recompra 1", kind: "pedido", parts: [{ text: "Olá, {nome}! 😊 Como está indo com seu {produtos}?\n\nNotamos que já faz um tempinho desde sua última compra, que tal repor o seu estoque antes que acabe? 🛍️\n\nAproveite para conferir nossas novidades que combinam com o que você já tem. 😍\n\nÉ só me chamar que deixo tudo pronto rapidinho pra você! 📦" }] },
  { key: "au_recompra2", folder: F_AUTO, name: "Lembrete de recompra 2", kind: "pedido", parts: [{ text: "Oi, {nome}! 👋\n\nSeparei algumas ofertas especiais da {loja} pra você repor seu {produtos} hoje mesmo. ✨\n\nMe chama aqui e já deixo seu pedido separado! 🚀" }] },
  { key: "au_carr_cupom", folder: F_AUTO, name: "Carrinho abandonado com cupom", kind: "carrinho", parts: [{ text: "💬 Olá, {nome}!\n\nPercebemos que você deixou seu produto no carrinho. Para te ajudar a concluir sua compra, preparamos um cupom especial para você: SEUCUPOM 🎉\n\n🔖 Garanta agora seu desconto exclusivo e não perca essa oportunidade!\n\n👉 Finalize sua compra aqui: {link}" }] },
  { key: "au_taxado", folder: F_AUTO, name: "Aviso de produto taxado (para a equipe)", kind: "rastreio", parts: [{ text: "❌ *PRODUTO TAXADO*\n\nPedido: *{pedido}*\n{produtos_variante}\nValor: {valor}\nLink de rastreio: {rastreio_link}" }] },

  // Respostas de atendimento (chatbot, consulta de pedido e avaliação)
  { key: "re_ajuda", folder: F_RESP, name: "Como podemos ajudar?", kind: "resposta", parts: [{ text: "Como podemos ajudar?" }] },
  { key: "re_aguarde", folder: F_RESP, name: "Aguarde um atendente", kind: "resposta", parts: [{ text: "Aguarde, em breve um de nossos atendentes irá entrar em contato 😀" }] },
  { key: "re_aguarde_hor", folder: F_RESP, name: "Aguarde um atendente (fora do horário)", kind: "resposta", parts: [{ text: "Aguarde, em breve um de nossos atendentes irá entrar em contato *dentro do nosso horário de atendimento* 😀" }] },
  { key: "re_email_pedido", folder: F_RESP, name: "Pedir o e-mail do pedido", kind: "resposta", parts: [{ text: "Por gentileza, informe o e-mail usado no pedido" }] },
  { key: "re_cpf", folder: F_RESP, name: "Pedir CPF ou CNPJ", kind: "resposta", parts: [{ text: "Digite o seu *CPF ou CNPJ.* Apenas os números. 🪪" }] },
  { key: "re_email", folder: F_RESP, name: "Pedir e-mail", kind: "resposta", parts: [{ text: "Digite o seu *e-mail* 📧" }] },
  { key: "re_tel", folder: F_RESP, name: "Pedir telefone", kind: "resposta", parts: [{ text: "Digite o seu *telefone com o DDD.* Utilize apenas números. 📞\n\n*Exemplo:* 1112341234" }] },
  { key: "re_site", folder: F_RESP, name: "Link para comprar no site", kind: "resposta", parts: [{ text: "Acesse o link para comprar em nosso site:\n\n{site}\n\nSe tiver qualquer dúvida entre em contato conosco 😉" }] },
  { key: "re_troca", folder: F_RESP, name: "Troca ou devolução: dados", kind: "resposta", parts: [{ text: "Certo, para abrir um pedido de troca ou devolução precisamos das seguintes informações:\n\n• Nome completo\n• CPF\n• E-mail\n• Produto que deseja devolver ou trocar\n• Motivo da troca ou devolução" }] },
  { key: "re_troca_ok", folder: F_RESP, name: "Troca ou devolução: recebida", kind: "resposta", parts: [{ text: "Nossa equipe vai analisar a sua solicitação e retornar o mais breve possível com as próximas instruções" }] },
  { key: "re_encerrar", folder: F_RESP, name: "Encerrar atendimento", kind: "resposta", parts: [{ text: "Obrigado por entrar em contato conosco. Qualquer dúvida basta entrar em contato novamente 😉" }] },
  { key: "re_obrigado", folder: F_RESP, name: "Obrigado pelo contato", kind: "resposta", parts: [{ text: "Muito obrigado por entrar em contato conosco. Qualquer dúvida estamos à disposição! 😉" }] },
  { key: "re_em_que", folder: F_RESP, name: "Em que posso ajudar?", kind: "resposta", parts: [{ text: "Em que posso ajudar?" }] },
  { key: "re_nao_entendi", folder: F_RESP, name: "Não entendi", kind: "resposta", parts: [{ text: "Desculpe, não entendi. Pode repetir a sua pergunta?" }] },
  { key: "re_midia", folder: F_RESP, name: "Não consegui abrir o arquivo", kind: "resposta", parts: [{ text: "Acabei de ver sua mensagem, mas por aqui não consegui abrir o arquivo/mídia que você enviou.\nVocê pode me contar em texto o que tem nele? Assim consigo te responder mais rápido." }] },
  { key: "re_aval_sim", folder: F_RESP, name: "Avaliação: resolvido", kind: "resposta", parts: [{ text: "Que bom saber disso! 😊\nDe 1 a 5, como você avalia o meu atendimento?\n(Sendo: 1 = Insatisfeito e 5 = Muito satisfeito)" }] },
  { key: "re_aval_nao", folder: F_RESP, name: "Avaliação: não resolvido", kind: "resposta", parts: [{ text: "Poxa, sinto muito por isso. 😕\nDe 1 a 5, como você avalia o meu atendimento?\n(Sendo: 1 = Insatisfeito e 5 = Muito satisfeito)" }] },
  { key: "re_aval_fim", folder: F_RESP, name: "Avaliação: obrigado", kind: "resposta", parts: [{ text: "Obrigado pela resposta, fique à vontade caso deseje fazer algum comentário!" }] },
];

/* ---------- Automações do Reportana, montadas no Hub ---------- */

const msg = (key: string) => {
  const m = REPORTANA_MSGS.find((x) => x.key === key)!;
  return { key: m.key, name: m.name, kind: m.kind, parts: m.parts };
};
const S = (x: number, y: number, m: string, extra: Partial<Extract<Node, { type: "send" }>> = {}) => ({ type: "send" as const, parts: [], typing: 5, timeout: 60, x, y, msg: m, ...extra });

export const REPORTANA_FLOWS: FlowTemplate[] = [
  {
    key: "rp_funil", name: "Funil de recuperação (Reportana)", cat: "Do Reportana", trigger: "carrinho_abandonado",
    desc: "A mesma do Reportana: espera 5 minutos, confere se a pessoa não comprou e manda 3 mensagens com 1 dia entre cada uma.",
    config: { delayMin: 5, stopOnPaid: true },
    msgs: [msg("fu_1"), msg("fu_2"), msg("fu_3")],
    start: "c1",
    nodes: {
      c1: { type: "cond", check: "nao_pagou", mode: "all", rules: [{ check: "nao_pagou" }], x: 320, y: 170, yes: "s1" },
      s1: S(660, 120, "fu_1", { typing: 15, timeout: 300, next: "w1" }),
      w1: { type: "wait", amount: 1, unit: "d", x: 1000, y: 420, next: "c2" },
      c2: { type: "cond", check: "nao_pagou", mode: "all", rules: [{ check: "nao_pagou" }], x: 1240, y: 420, yes: "s2" },
      s2: S(1580, 360, "fu_2", { timeout: 300, next: "w2" }),
      w2: { type: "wait", amount: 1, unit: "d", x: 1920, y: 660, next: "c3" },
      c3: { type: "cond", check: "nao_pagou", mode: "all", rules: [{ check: "nao_pagou" }], x: 2160, y: 660, yes: "s3" },
      s3: S(2500, 600, "fu_3", { timeout: 300, next: "x1" }),
      x1: { type: "exit", x: 2860, y: 900 },
    },
  },
  {
    key: "rp_carrinho", name: "Carrinho abandonado básico (Reportana)", cat: "Do Reportana", trigger: "carrinho_abandonado",
    desc: "Três mensagens do Reportana: reserva com foto do produto, frete grátis e últimas unidades. Para se a pessoa pagar.",
    config: { delayMin: 30, stopOnPaid: true },
    msgs: [msg("ca_1"), msg("ca_2"), msg("ca_3")],
    start: "s1",
    nodes: {
      s1: S(340, 140, "ca_1", { next: "u1" }),
      u1: { type: "waitUntil", event: "pagou", amount: 1, unit: "d", x: 700, y: 220, met: "x1", timeout: "s2" },
      s2: S(1000, 140, "ca_2", { next: "u2" }),
      u2: { type: "waitUntil", event: "pagou", amount: 1, unit: "d", x: 1360, y: 220, met: "x1", timeout: "s3" },
      s3: S(1660, 140, "ca_3", { next: "x1" }),
      x1: { type: "exit", x: 2000, y: 420 },
    },
  },
  {
    key: "rp_cartao", name: "Cartão recusado (Reportana)", cat: "Do Reportana", trigger: "cartao_recusado",
    desc: "Oferece outra forma de pagamento, depois avisa da oferta e do estoque baixo.",
    config: { delayMin: 10, stopOnPaid: true },
    msgs: [msg("cr_1"), msg("cr_2"), msg("cr_3")],
    start: "s1",
    nodes: {
      s1: S(340, 140, "cr_1", { next: "u1" }),
      u1: { type: "waitUntil", event: "pagou", amount: 1, unit: "d", x: 700, y: 220, met: "x1", timeout: "s2" },
      s2: S(1000, 140, "cr_2", { next: "u2" }),
      u2: { type: "waitUntil", event: "pagou", amount: 1, unit: "d", x: 1360, y: 220, met: "x1", timeout: "s3" },
      s3: S(1660, 140, "cr_3", { next: "x1" }),
      x1: { type: "exit", x: 2000, y: 420 },
    },
  },
  {
    key: "rp_pix", name: "Recuperação de Pix (Reportana)", cat: "Do Reportana", trigger: "pedido_pix",
    desc: "Detalhes do pedido com o link do Pix, aviso de Pix expirando e aviso de prazo encerrado.",
    config: { delayMin: 5, stopOnPaid: true },
    msgs: [msg("px_1"), msg("px_2"), msg("px_3")],
    start: "s1",
    nodes: {
      s1: S(340, 140, "px_1", { next: "u1" }),
      u1: { type: "waitUntil", event: "pagou", amount: 1, unit: "h", x: 700, y: 220, met: "x1", timeout: "s2" },
      s2: S(1000, 140, "px_2", { next: "u2" }),
      u2: { type: "waitUntil", event: "pagou", amount: 23, unit: "h", x: 1360, y: 220, met: "x1", timeout: "s3" },
      s3: S(1660, 140, "px_3", { next: "x1" }),
      x1: { type: "exit", x: 2000, y: 420 },
    },
  },
  {
    key: "rp_rastreio", name: "Rastreio por status (Reportana)", cat: "Do Reportana", trigger: "rastreio_atualizado",
    desc: "Uma mensagem para cada status da entrega: postado, em trânsito, saiu, retirada, tentativa, entregue e falha.",
    config: { delayMin: 0 },
    msgs: [msg("rs_postado"), msg("rs_transito"), msg("rs_saiu"), msg("rs_retirada"), msg("rs_falha"), msg("rs_entregue"), msg("rs_devolvido")],
    start: "m1",
    nodes: {
      m1: {
        type: "multi", x: 320, y: 700,
        branches: [
          { label: "Postado", rules: [{ check: "status_entrega", value: "postado" }] },
          { label: "Em trânsito", rules: [{ check: "status_entrega", value: "trânsito" }] },
          { label: "Saiu para entrega", rules: [{ check: "status_entrega", value: "saiu" }] },
          { label: "Retirada", rules: [{ check: "status_entrega", value: "retirada" }] },
          { label: "Tentativa", rules: [{ check: "status_entrega", value: "tentativa" }] },
          { label: "Entregue", rules: [{ check: "status_entrega", value: "entregue" }] },
          { label: "Falha", rules: [{ check: "status_entrega", value: "falha" }] },
        ],
        m0: "s1", m1: "s2", m2: "s3", m3: "s4", m4: "s5", m5: "s6", m6: "s7", else: "x1",
      },
      s1: S(760, 0, "rs_postado", { next: "x1" }),
      s2: S(760, 330, "rs_transito", { next: "x1" }),
      s3: S(760, 660, "rs_saiu", { next: "x1" }),
      s4: S(760, 990, "rs_retirada", { next: "x1" }),
      s5: S(760, 1320, "rs_falha", { next: "x1" }),
      s6: S(760, 1650, "rs_entregue", { next: "x1" }),
      s7: S(760, 1980, "rs_devolvido", { next: "x1" }),
      x1: { type: "exit", x: 1160, y: 1000 },
    },
  },
  {
    key: "rp_recompra", name: "Lembrete de recompra (Reportana)", cat: "Do Reportana", trigger: "pedido_pago",
    desc: "30 dias depois da compra lembra de repor. Se não comprar em 1 dia, manda as ofertas.",
    config: { delayMin: 0 },
    msgs: [msg("au_recompra1"), msg("au_recompra2")],
    start: "w1",
    nodes: {
      w1: { type: "wait", amount: 30, unit: "d", x: 320, y: 200, next: "s1" },
      s1: S(600, 140, "au_recompra1", { next: "u1" }),
      u1: { type: "waitUntil", event: "pagou", amount: 1, unit: "d", x: 960, y: 220, met: "x1", timeout: "s2" },
      s2: S(1260, 140, "au_recompra2", { next: "x1" }),
      x1: { type: "exit", x: 1600, y: 420 },
    },
  },
  {
    key: "rp_cupom", name: "Cupom para a próxima compra (Reportana)", cat: "Do Reportana", trigger: "pedido_pago",
    desc: "Agradece a compra e manda um cupom para a próxima. Troque SEUCUPOM pelo cupom da loja.",
    config: { delayMin: 60 },
    msgs: [msg("au_cupom")],
    start: "s1",
    nodes: {
      s1: S(340, 140, "au_cupom", { next: "x1" }),
      x1: { type: "exit", x: 700, y: 360 },
    },
  },
];
