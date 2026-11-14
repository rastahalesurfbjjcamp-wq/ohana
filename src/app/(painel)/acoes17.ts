"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ambProgram, saveAmbProgram, type AmbProgram } from "@/lib/ambassador";
import { createPartnerCode, findShopifyCode, discFields } from "@/lib/partners";

async function requireAdmin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "ADMIN") redirect("/embaixadores?erro=admin");
  return s;
}

// Aprova o embaixador: libera o painel, cria o cupom (R$ de desconto para o cliente) e fixa a comissão do nível
export async function aprovarEmbaixador(f: FormData) {
  await requireAdmin();
  const id = String(f.get("id") ?? "");
  const r = await db.referral.findUnique({ where: { id } });
  if (!r || r.kind !== "embaixador") return;
  const p = await ambProgram();
  const lv = p.levels.find((l) => l.key === String(f.get("level") ?? "")) ?? p.levels.find((l) => l.key === r.level) ?? p.levels[0];
  const disc = { type: "fixed" as const, value: lv.clientOff || p.clientOff, min: null };
  let discountId = r.discountId;
  try {
    discountId = discountId ?? (await findShopifyCode(r.code))?.id ?? (await createPartnerCode(r.code, disc, `Embaixador ${r.name ?? r.code}`));
  } catch (e) {
    console.error("[embaixador] cupom", r.code, String(e).slice(0, 200));
  }
  const now = new Date();
  await db.referral.update({ where: { id }, data: { active: true, pendingAt: null, portalAt: now, level: lv.key, commissionPct: lv.pct, discountId, ...discFields(disc) } });
  revalidatePath("/embaixadores");
  redirect(`/embaixadores?aprovado=${id}`);
}

export async function recusarEmbaixador(f: FormData) {
  await requireAdmin();
  const id = String(f.get("id") ?? "");
  const r = await db.referral.findUnique({ where: { id } });
  if (r?.kind === "embaixador" && r.pendingAt) await db.referral.delete({ where: { id } });
  revalidatePath("/embaixadores");
}

export async function mudarNivel(f: FormData) {
  await requireAdmin();
  const id = String(f.get("id") ?? "");
  const level = String(f.get("level") ?? "");
  const p = await ambProgram();
  const lv = p.levels.find((l) => l.key === level);
  if (!lv) return;
  await db.referral.update({ where: { id }, data: { level: lv.key, commissionPct: lv.pct } });
  revalidatePath("/embaixadores");
}

export async function salvarNiveis(f: FormData) {
  await requireAdmin();
  const p = await ambProgram();
  const txt = (k: string, n = 300) => String(f.get(k) ?? "").trim().slice(0, n);
  const num = (k: string) => { const v = Number(txt(k).replace(",", ".")); return Number.isFinite(v) ? v : 0; };
  const next: AmbProgram = {
    v: 2,
    minWithdrawCents: Math.round(num("min") * 100),
    clientOff: num("off"),
    levels: p.levels.map((l, i) => ({
      ...l,
      pct: num(`pct_${l.key}`),
      orders: l.invite ? null : i === 0 ? 0 : Math.round(num(`orders_${l.key}`)) || null,
      how: txt(`how_${l.key}`) || l.how,
      siteOff: num(`site_${l.key}`),
      perks: txt(`perks_${l.key}`),
      clientOff: num("off"),
    })),
  };
  await saveAmbProgram(next);
  // quem já está num nível passa a ganhar a % nova
  for (const l of next.levels) await db.referral.updateMany({ where: { kind: "embaixador", level: l.key }, data: { commissionPct: l.pct } });
  revalidatePath("/embaixadores");
  redirect("/embaixadores?salvo=1");
}
