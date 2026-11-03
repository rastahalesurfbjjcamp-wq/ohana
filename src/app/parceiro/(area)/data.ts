// Dados comuns das telas do portal do parceiro
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { currentPartner } from "@/lib/partnerAuth";
import { balanceOf, program, syncLedger } from "@/lib/ledger";
import { refLink } from "@/lib/partners";
import { db } from "@/lib/db";
import { ambProgram, levelFor, nextLevel, type AmbProgram, type Level } from "@/lib/ambassador";

export const fmtDay = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });

export async function partnerArea() {
  const p = await currentPartner();
  if (!p) redirect("/parceiro/entrar");
  await syncLedger().catch(() => null);
  const [b, prog0, s] = await Promise.all([balanceOf(p.id), program(), getSettings()]);
  let prog = prog0;
  let pct = p.commissionPct ?? s.referral.commission;
  // embaixador: nível pelo que já acumulou (sobe sozinho, nunca desce) e saque mínimo do programa
  let amb: { prog: AmbProgram; level: Level; next: Level | null } | null = null;
  if (p.kind === "embaixador") {
    const ap = await ambProgram();
    const level = levelFor(ap, p.level, b.lifetimeCents);
    if (level.key !== p.level || p.commissionPct !== level.pct) await db.referral.update({ where: { id: p.id }, data: { level: level.key, commissionPct: level.pct } }).catch(() => null);
    pct = level.pct;
    prog = { ...prog0, minWithdrawCents: ap.minWithdrawCents };
    amb = { prog: ap, level, next: nextLevel(ap, level) };
  }
  const link = s.postsale.storeUrl ? refLink(p.code) : "";
  const shortLink = link.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
  const first = (p.name ?? "").split(" ")[0] || p.code;
  return { p, b, prog, pct, link, shortLink, first, amb };
}
