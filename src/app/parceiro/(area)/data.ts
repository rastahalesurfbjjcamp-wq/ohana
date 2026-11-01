// Dados comuns das telas do portal do parceiro
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { currentPartner } from "@/lib/partnerAuth";
import { balanceOf, program, syncLedger } from "@/lib/ledger";
import { partnerLink } from "@/lib/partners";

export const fmtDay = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });

export async function partnerArea() {
  const p = await currentPartner();
  if (!p) redirect("/parceiro/entrar");
  await syncLedger().catch(() => null);
  const [b, prog, s] = await Promise.all([balanceOf(p.id), program(), getSettings()]);
  const pct = p.commissionPct ?? s.referral.commission;
  const link = s.postsale.storeUrl ? partnerLink(s.postsale.storeUrl, p.code) : "";
  const shortLink = link.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
  const first = (p.name ?? "").split(" ")[0] || p.code;
  return { p, b, prog, pct, link, shortLink, first };
}
