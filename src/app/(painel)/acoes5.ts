"use server";
// Atletas e influenciadores: cadastro, cupom na Shopify e pagamento de comissão.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createDiscount } from "@/lib/referral";
import { findShopifyCode, setCodePercent } from "@/lib/partners";
import { getSettings, saveSetting } from "@/lib/settings";
import { normalizePhone } from "@/lib/segments";

async function admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "ADMIN") throw new Error("Só o administrador pode mudar isso");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const msg = (e: unknown) => encodeURIComponent(String(e).replace(/^Error: /, "").slice(0, 160));

// Novo atleta: cria o cupom na Shopify (ou vincula um que já existe) e já gera o link
export async function addPartner(f: FormData) {
  await admin();
  const s = await getSettings();
  const name = str(f, "name");
  if (!name) redirect("/atletas?novo=1&erro=nome");
  const base = (str(f, "code") || name.split(" ")[0]).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20);
  const code = str(f, "code") ? base : `${base}${s.referral.percent}`;
  const phone = normalizePhone(str(f, "phone")) ?? `sem-${Date.now()}`;
  let discountId: string | null = null;
  let pct: number | null = s.referral.percent;
  try {
    const existing = await findShopifyCode(code);
    if (existing) {
      discountId = existing.id;
      pct = existing.percent;
      if (f.get("ajustar") === "on" && existing.percent !== s.referral.percent) { await setCodePercent(existing.id, s.referral.percent); pct = s.referral.percent; }
    } else {
      discountId = await createDiscount(code, s.referral.percent);
    }
    if (await db.referral.findFirst({ where: { code: { equals: code, mode: "insensitive" } } })) redirect(`/atletas?novo=1&erro=${encodeURIComponent("Esse cupom já está ligado a alguém")}`);
    await db.referral.create({ data: { name, phone, code, discountId, discountPct: pct, kind: str(f, "kind") || "atleta", payout: str(f, "payout") || "pix", instagram: str(f, "instagram").replace(/^@/, "") || null } });
  } catch (e) {
    if (String(e).includes("NEXT_REDIRECT")) throw e;
    redirect(`/atletas?novo=1&erro=${msg(e)}`);
  }
  revalidatePath("/atletas");
  redirect(`/atletas?criado=${code}`);
}

// Deixa o cupom no desconto padrão do programa (ex.: 10%)
export async function fixPartnerPercent(f: FormData) {
  await admin();
  const s = await getSettings();
  const r = await db.referral.findUnique({ where: { id: str(f, "id") } });
  if (!r) redirect("/atletas");
  try {
    const id = r!.discountId ?? (await findShopifyCode(r!.code))?.id;
    if (!id) throw new Error("Cupom não encontrado na Shopify");
    await setCodePercent(id, s.referral.percent);
    await db.referral.update({ where: { id: r!.id }, data: { discountId: id, discountPct: s.referral.percent } });
  } catch (e) {
    redirect(`/atletas?erro=${msg(e)}`);
  }
  revalidatePath("/atletas");
}

export async function updatePartnerInfo(f: FormData) {
  await admin();
  const id = str(f, "id");
  await db.referral.update({ where: { id }, data: { payout: str(f, "payout") || undefined, kind: str(f, "kind") || undefined, active: f.has("active") ? f.get("active") === "on" : undefined } });
  revalidatePath("/atletas");
}

export async function savePartnerRules(f: FormData) {
  await admin();
  const n = (k: string, d: number) => { const v = Number(str(f, k).replace(",", ".")); return Number.isFinite(v) && v >= 0 ? v : d; };
  await saveSetting("referral", { commission: Math.min(50, n("commission", 8)), percent: Math.min(50, Math.max(1, n("percent", 10))) });
  revalidatePath("/atletas");
  redirect("/atletas?ok=regras");
}

// Marca a comissão do mês como paga
export async function markPayout(f: FormData) {
  const s = await admin();
  const referralId = str(f, "id");
  const month = str(f, "month");
  const amount = Number(str(f, "amount"));
  const sales = Number(str(f, "sales"));
  await db.payout.upsert({
    where: { referralId_month: { referralId, month } },
    create: { referralId, month, amount, sales, method: str(f, "method") || "pix", createdBy: s.name },
    update: { amount, sales, paidAt: new Date(), method: str(f, "method") || "pix" },
  });
  revalidatePath("/atletas");
}
export async function undoPayout(f: FormData) {
  await admin();
  await db.payout.deleteMany({ where: { referralId: str(f, "id"), month: str(f, "month") } });
  revalidatePath("/atletas");
}

// Troca o cupom de um atleta: vincula o que já existe na Shopify (ou cria) e as vendas passam a contar por ele
export async function changePartnerCode(f: FormData) {
  await admin();
  const s = await getSettings();
  const id = str(f, "id");
  const code = str(f, "code").replace(/\s+/g, "").toUpperCase();
  if (!code) redirect(`/atletas?editar=${id}`);
  const other = await db.referral.findFirst({ where: { code: { equals: code, mode: "insensitive" }, NOT: { id } } });
  if (other) redirect(`/atletas?editar=${id}&erro=${encodeURIComponent(`O cupom ${code} já está ligado a ${other.name ?? "outra pessoa"}`)}`);
  try {
    const existing = await findShopifyCode(code);
    const discountId = existing ? existing.id : await createDiscount(code, s.referral.percent);
    await db.referral.update({ where: { id }, data: { code, discountId, discountPct: existing ? existing.percent : s.referral.percent } });
  } catch (e) {
    if (String(e).includes("NEXT_REDIRECT")) throw e;
    redirect(`/atletas?editar=${id}&erro=${msg(e)}`);
  }
  revalidatePath("/atletas");
  redirect(`/atletas?trocado=${code}`);
}
