// Popups de captura: tipos, modelos prontos e padrões (sem banco, roda no navegador também)

export type Prize = { label: string; code: string; weight: number };
export type PopupCfg = {
  layout: "centro" | "lateral" | "barra" | "tela";
  title: string;
  text: string;
  image?: string;
  imagePos?: "esquerda" | "topo" | "nenhuma";
  button: string;
  dismiss?: string;
  fields: { name: boolean; email: boolean; birthday: boolean };
  consent?: string;
  success: { title: string; text: string; coupon?: string; button: string; link?: string };
  game?: { type: "roleta" | "raspadinha"; prizes: Prize[] };
  countdownMin?: number;
  colors: { bg: string; text: string; accent: string; accentText: string };
  radius: number;
  dim: number;
  trigger: { when: "imediato" | "segundos" | "rolagem" | "saida" | "inatividade"; seconds: number; scrollPct: number; freqDays: number; hideConverted: boolean };
  audience: { device: "todos" | "celular" | "computador"; include: string; exclude: string; start?: string; end?: string };
  listId?: string;
  tag?: string;
};

export const PALETTES: { k: string; label: string; colors: PopupCfg["colors"] }[] = [
  { k: "rasta", label: "Rasta", colors: { bg: "#0d0f0e", text: "#f2f2f2", accent: "#f7c928", accentText: "#111111" } },
  { k: "areia", label: "Areia", colors: { bg: "#f6f1e7", text: "#1d1d1b", accent: "#1d1d1b", accentText: "#ffffff" } },
  { k: "mar", label: "Mar", colors: { bg: "#0b2a3c", text: "#eaf6ff", accent: "#2bc0e4", accentText: "#06202e" } },
  { k: "verde", label: "Verde", colors: { bg: "#0f1a14", text: "#eef7f0", accent: "#34c26a", accentText: "#04140a" } },
  { k: "branco", label: "Branco", colors: { bg: "#ffffff", text: "#151515", accent: "#e53935", accentText: "#ffffff" } },
];

const BASE: PopupCfg = {
  layout: "centro", title: "", text: "", imagePos: "esquerda", button: "Quero", dismiss: "Agora não",
  fields: { name: true, email: false, birthday: false },
  consent: "Aceito receber novidades e ofertas no WhatsApp.",
  success: { title: "Pronto!", text: "", button: "Ir para a loja" },
  colors: PALETTES[0].colors, radius: 16, dim: 55,
  trigger: { when: "segundos", seconds: 6, scrollPct: 40, freqDays: 3, hideConverted: true },
  audience: { device: "todos", include: "", exclude: "/checkout, /cart" },
};

export const POPUP_KINDS: { k: string; label: string; desc: string; make: () => PopupCfg }[] = [
  { k: "boasvindas", label: "Boas-vindas", desc: "Cupom para quem chega pela primeira vez", make: () => ({ ...BASE, title: "Sua primeira Rasta com 10% off", text: "Deixa seu WhatsApp e recebe o cupom agora, junto com os lançamentos antes de todo mundo.", button: "Quero meu cupom", success: { title: "Cupom liberado", text: "Use na finalização da compra. Também mandamos no seu WhatsApp.", coupon: "BEMVINDO10", button: "Começar a comprar" } }) },
  { k: "saida", label: "Saída", desc: "Última oferta quando a pessoa vai embora", make: () => ({ ...BASE, title: "Antes de ir: frete grátis", text: "Deixa seu WhatsApp e libera o frete grátis na compra de hoje.", button: "Liberar frete grátis", trigger: { ...BASE.trigger, when: "saida" }, success: { title: "Frete grátis liberado", text: "Cupom válido hoje.", coupon: "FRETEGRATIS", button: "Voltar para a loja" } }) },
  { k: "grupo", label: "Grupo VIP", desc: "Convite para o grupo do WhatsApp, sem cupom", make: () => ({ ...BASE, title: "Entra no grupo da Rasta", text: "Lançamentos, condições do grupo e o Construa Conosco. Só no WhatsApp.", button: "Quero entrar", fields: { name: true, email: false, birthday: false }, success: { title: "Bem-vindo!", text: "Toca no botão para entrar no grupo.", button: "Entrar no grupo", link: "https://chat.whatsapp.com/" } }) },
  { k: "contagem", label: "Contagem regressiva", desc: "Oferta relâmpago com relógio e cupom no final", make: () => ({ ...BASE, title: "Oferta relâmpago", text: "20% off em tudo enquanto o relógio corre.", button: "Pegar meu cupom", countdownMin: 15, trigger: { ...BASE.trigger, seconds: 4 }, success: { title: "É seu", text: "Corre que acaba.", coupon: "RELAMPAGO20", button: "Comprar agora" } }) },
  { k: "roleta", label: "Roleta", desc: "Gira a roleta e ganha um prêmio depois do cadastro", make: () => ({ ...BASE, title: "Gira e ganha", text: "Deixa seu WhatsApp e gira a roleta. Todo mundo ganha alguma coisa.", button: "Girar a roleta", game: { type: "roleta", prizes: [{ label: "5% off", code: "GIRO5", weight: 40 }, { label: "10% off", code: "GIRO10", weight: 30 }, { label: "Frete grátis", code: "GIROFRETE", weight: 20 }, { label: "15% off", code: "GIRO15", weight: 8 }, { label: "Boné grátis", code: "GIROBONE", weight: 2 }] }, success: { title: "Você ganhou!", text: "Use o cupom na finalização da compra.", button: "Usar agora" } }) },
  { k: "raspadinha", label: "Raspadinha", desc: "Raspa e descobre o prêmio depois do cadastro", make: () => ({ ...BASE, title: "Raspa e ganha", text: "Deixa seu WhatsApp e raspa para descobrir seu prêmio.", button: "Raspar", game: { type: "raspadinha", prizes: [{ label: "10% off", code: "RASPA10", weight: 60 }, { label: "Frete grátis", code: "RASPAFRETE", weight: 30 }, { label: "20% off", code: "RASPA20", weight: 10 }] }, success: { title: "Você ganhou!", text: "Use o cupom na finalização da compra.", button: "Usar agora" } }) },
  { k: "barra", label: "Barra no topo", desc: "Faixa fixa no topo que abre o cadastro", make: () => ({ ...BASE, layout: "barra", title: "10% off na primeira compra", text: "Cadastre seu WhatsApp", button: "Quero", trigger: { ...BASE.trigger, when: "imediato" }, success: { title: "Cupom liberado", text: "", coupon: "BANNER10", button: "Fechar" } }) },
];

export function defaultCfg(kind: string): PopupCfg {
  return (POPUP_KINDS.find((x) => x.k === kind) ?? POPUP_KINDS[0]).make();
}
