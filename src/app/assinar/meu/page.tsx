import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { MemberArea, type Portal } from "./MemberArea";
import { clubBenefits, clubTenure } from "@/lib/clubBenefits";
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
    benefits: clubBenefits(c),
    tenure: clubTenure(c),
    members: parse(c.portalMembers).map(([img, cat, ig]) => ({ img, cat: cat ?? "", ig: ig ?? "" })),
    shop: parse(c.portalShop).map(([title, tag, img]) => ({ title, tag: tag ?? "", img: img ?? "" })),
  };
  return (
    <div className="rcp">
      <MemberArea token={t ?? ""} portal={portal} />
    </div>
  );
}
