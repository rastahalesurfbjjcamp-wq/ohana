// Mensagens do clube no WhatsApp: boas-vindas, pontos de cada compra, resposta ao RESGATAR e aviso de lançamento.
import { db } from "./db";
import { getSettings } from "./settings";
import { memberLink } from "./clubMember";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ptsTxt = (n: number) => `${n.toLocaleString("pt-BR")} ponto${n === 1 ? "" : "s"}`;

export const LAUNCH_DEFAULT = "Oi, {nome}! Vem lançamento aí e, como membro do {clube}, você compra {horas} horas antes de todo mundo.\n\nVocê tem {pontos} pontos, que valem {valor} de desconto e somam com os seus {pct}% do clube.\n\nSeus pontos e resgates: {link}";

export async function clubText(memberId: string, kind: string, extra: { pts?: number; order?: string; text?: string } = {}) {
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
      `• ${c.discountPct}% de desconto em toda compra. Entra sozinho no checkout quando você compra com a sua conta da loja${m.email ? ` (${m.email})` : ""}.${m.code ? ` Se não aparecer, use o seu cupom ${m.code}.` : ""}`,
      `• Lançamentos ${c.earlyHours} horas antes de todo mundo. A gente te avisa por aqui.`,
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
  if (kind === "lancamento") {
    return (extra.text || LAUNCH_DEFAULT)
      .replaceAll("{nome}", first).replaceAll("{clube}", c.name).replaceAll("{horas}", String(c.earlyHours))
      .replaceAll("{pontos}", m.points.toLocaleString("pt-BR")).replaceAll("{valor}", money(value)).replaceAll("{pct}", String(c.discountPct)).replaceAll("{link}", link);
  }
  return null;
}
