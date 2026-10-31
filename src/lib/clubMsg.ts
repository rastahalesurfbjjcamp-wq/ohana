// Mensagens do clube no WhatsApp: boas-vindas, pontos de cada compra, resposta ao RESGATAR e aviso de lançamento.
import { db } from "./db";
import { getSettings } from "./settings";
import { memberLink } from "./clubMember";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ptsTxt = (n: number) => `${n.toLocaleString("pt-BR")} ponto${n === 1 ? "" : "s"}`;

export const LAUNCH_DEFAULT = "Oi, {nome}! Vem lançamento aí e, como membro do {clube}, você compra {horas} horas antes de todo mundo.\n\nVocê tem {pontos} pontos, que valem {valor} de desconto e somam com os seus {pct}% do clube.\n\nSeus pontos e resgates: {link}";

export async function clubText(memberId: string, kind: string, extra: { pts?: number; order?: string; text?: string; tier?: number; code?: string } = {}) {
  const [m, s] = await Promise.all([db.clubMember.findUnique({ where: { id: memberId } }), getSettings()]);
  if (!m || !m.phone) return null;
  const c = s.club;
  const first = m.name.split(" ")[0];
  const value = Math.floor(m.points / 100) * c.valuePer100;
  const link = memberLink(m.id);
  if (kind === "boasvindas") {
    return [
      `Oi, ${first}! Sua assinatura do ${c.name} está confirmada.`,
      "",
      "Como funciona:",
      `• ${c.discountPct}% de desconto ${c.usesPerMonth ? `em ${c.usesPerMonth} compras por mês (renova todo dia 1)` : "em toda compra"}. Entra sozinho no checkout quando você compra com a sua conta da loja${m.email ? ` (${m.email})` : ""}.${m.code ? ` Se não aparecer, use o seu cupom ${m.code}.` : ""}`,
      `• Você vai receber em casa a camiseta exclusiva do club e o patch da bandeira.`,
      `• Lançamentos ${c.earlyHours} horas antes de todo mundo. A gente te avisa por aqui.`,
      `• Com 3 meses de club você ganha um brinde, com 6 meses passa a ganhar ${c.t6Points} pontos por real e com 12 meses ganha uma peça exclusiva.`,
      c.birthdayPct ? `• No mês do seu aniversário você ganha um cupom de ${c.birthdayPct}%.` : "",
      `• Cada R$ 1 em compras vira ${c.pointsPerReal === 1 ? "1 ponto" : `${String(c.pointsPerReal).replace(".", ",")} pontos`}. Cada 100 pontos valem ${money(c.valuePer100)} de desconto, que soma com os ${c.discountPct}%.`,
      m.points ? `• Você já começou com ${ptsTxt(m.points)}.` : "",
      "",
      `Seus pontos e resgates: ${link}`,
      "",
      "Se não quiser receber mensagens do clube, responda SAIR.",
    ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
  }
  if (kind === "pontos") {
    return [
      `Oi, ${first}! Sua compra${extra.order ? ` ${extra.order}` : ""} somou ${ptsTxt(extra.pts ?? 0)} no ${c.name}.`,
      `Saldo: ${ptsTxt(m.points)}${value ? ` (valem ${money(value)})` : ""}.`,
      "",
      m.points >= c.minRedeem ? `Quer trocar por desconto? Responda RESGATAR ou acesse ${link}` : `Com ${c.minRedeem} pontos você já troca por desconto. Acompanhe aqui: ${link}`,
      "Se preferir juntar mais, não precisa fazer nada.",
    ].join("\n");
  }
  if (kind === "resgatar") {
    return m.points >= c.minRedeem
      ? `${first}, você tem ${ptsTxt(m.points)}, que valem ${money(value)}. Escolha o valor ou a peça e o cupom sai na hora: ${link}`
      : `${first}, você tem ${ptsTxt(m.points)}. A partir de ${c.minRedeem} pontos já dá para trocar por desconto. Acompanhe aqui: ${link}`;
  }
  if (kind === "aniversario") {
    return [`Feliz aniversário, ${first}! 🎉`, "", `Como membro do ${c.name}, você ganhou ${c.birthdayPct}% de desconto em uma compra este mês.`, `Seu cupom: ${extra.code ?? ""}`, `Vale até o fim do mês: ${s.postsale.storeUrl.replace(/\/$/, "")}/discount/${extra.code ?? ""}`].join("\n");
  }
  if (kind === "nivel") {
    const t = extra.tier ?? 0;
    const lk = t === 12 ? c.t12Link : t === 6 ? c.t6Link : c.t3Link;
    const gift = t === 3 ? c.t3Gift : t === 12 ? c.t12Gift : "";
    return [`${first}, você completou ${t} meses de ${c.name}! Obrigado por estar com a gente.`, "", gift ? `Seu brinde (${gift.replace(/\s*\(.*\)$/, "")}) já está separado e vai para o seu endereço.` : "", t === 6 ? `A partir de agora cada R$ 1 em compras vale ${c.t6Points} pontos.` : "", lk ? `Você liberou a coleção exclusiva de ${t} meses: ${lk}` : "", "", `Seus pontos e benefícios: ${link}`].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
  }
  if (kind === "lancamento") {
    return (extra.text || LAUNCH_DEFAULT)
      .replaceAll("{nome}", first).replaceAll("{clube}", c.name).replaceAll("{horas}", String(c.earlyHours))
      .replaceAll("{pontos}", m.points.toLocaleString("pt-BR")).replaceAll("{valor}", money(value)).replaceAll("{pct}", String(c.discountPct)).replaceAll("{link}", link);
  }
  return null;
}
