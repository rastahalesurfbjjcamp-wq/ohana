import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { MemberArea, type Portal } from "./MemberArea";
import "../assinar.css";
import "./meu.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Área do membro", description: "Seu desconto, seus pontos e os lançamentos antecipados." };

const parse = (s: string) => (s ?? "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]);

export default async function MeuClube({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const { club: c } = await getSettings();
  const portal: Portal = {
    club: c.name,
    logo: c.portalLogo || "/brand/club-flag.png",
    discountPct: c.discountPct,
    benefits: [
      ["Camiseta exclusiva do club + patch da bandeira", "Kit de boas-vindas enviado depois da assinatura"],
      [`${c.discountPct}% de desconto ${c.usesPerMonth ? `em ${c.usesPerMonth} compras por mês` : "em toda compra"}`, "Entra sozinho no checkout quando você compra logado"],
      ["Acesso antecipado às coleções", `Você compra os drops ${c.earlyHours} horas antes de todo mundo`],
      ["Lançamentos e produtos exclusivos", "Na Loja do Club"],
      ["Pontos em cada compra", `Cada R$ 1 vira ${c.pointsPerReal === 1 ? "1 ponto" : `${String(c.pointsPerReal).replace(".", ",")} pontos`}. Troque por crédito, peças ou eventos`],
      ["Eventos e open mats", "Seminários, open mats e eventos de luta com seus pontos"],
      [`${c.birthdayPct}% no mês do seu aniversário`, "Mais sorteios de peças, vídeo análise com atletas do time e aula particular"],
      ["Indique e ganhe", `${c.affiliatePct}% da mensalidade de cada amigo que assinar pelo seu link`],
    ],
    tenure: [
      { m: 3, t: (c.t3Gift || "Brinde").replace(/\s*\(.*\)/, "") },
      { m: 6, t: `${c.t6Points} pontos por real` },
      { m: 12, t: (c.t12Gift || "Peça exclusiva").replace(/\s*\(.*\)/, "") },
    ],
    members: parse(c.portalMembers).map(([img, cat, ig]) => ({ img, cat: cat ?? "", ig: ig ?? "" })),
    shop: parse(c.portalShop).map(([title, tag, img]) => ({ title, tag: tag ?? "", img: img ?? "" })),
  };
  return (
    <div className="rcp">
      <MemberArea token={t ?? ""} portal={portal} />
    </div>
  );
}
