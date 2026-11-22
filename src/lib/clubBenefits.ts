// Benefícios do Club num lugar só: página de assinatura, entrada do portal e área do membro
type C = { discountPct: number; birthdayPct: number; t6Gift?: string };

export function clubBenefits(c: C): [string, string][] {
  return [
    [`${c.discountPct}% de desconto`, "Em toda a loja, entra sozinho no checkout"],
    ["Acesso a todos os lançamentos antecipados", "Você compra antes de abrir para todo mundo"],
    ["Acesso às coleções exclusivas do club", "Peças que só membro compra"],
    ["Acesso à camiseta do club", "Só quem é do club tem"],
    ["Kimonos e rashguards exclusivos", "Modelos feitos só para o club"],
    ["Acesso aos open mats", "Treine com a gente"],
    ["Acesso gratuito aos nossos eventos", "Entrada liberada para membro"],
    [`${c.birthdayPct}% de desconto no mês do aniversário`, "Um presente da Rasta Hale para você"],
  ];
}

export const T6_GIFT_DEFAULT = "Camiseta comemorativa Rasta Hale Club";
export function clubTenure(c: C) {
  return [{ m: 6, t: c.t6Gift || T6_GIFT_DEFAULT }];
}
