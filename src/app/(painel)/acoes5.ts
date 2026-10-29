"use server";
// Atletas e influenciadores: cadastro, cupom na Shopify e pagamento de comissão.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPartnerCode, discFields, findShopifyCode, ruleDisc, sameDisc, setPartnerDisc, type Disc, type DiscType } from "@/lib/partners";
import { saveSetting } from "@/lib/settings";
import { normalizePhone } from "@/lib/segments";

async function admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "ADMIN") throw new Error("Só o administrador pode mudar isso");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
// Desconto vindo do formulário (tipo + valor + compra mínima); vazio = regra do programa
async function discFrom(f: FormData, prefix = ""): Promise<Disc> {
  const rule = await ruleDisc();
  const t = str(f, `${prefix}dtype`) as DiscType;
  if (!t) return rule;
  const n = (k: string) => { const v = Number(str(f, `${prefix}${k}`).replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) && v > 0 ? v : null; };
  return { type: t, value: t === "percent" || t === "fixed" ? n("dvalue") : null, min: n("dmin") };
}
const msg = (e: unknown) => encodeURIComponent(String(e).replace(/^Error: /, "").slice(0, 160));

// Novo atleta: cria o cupom na Shopify (ou vincula um que já existe) e já gera o link
export async function addPartner(f: FormData) {
  await admin();
  const name = str(f, "name");
  if (!name) redirect("/atletas?novo=1&erro=nome");
  const want = await discFrom(f);
  const suffix = want.type === "percent" && want.value ? String(want.value) : want.type === "fixed" && want.value ? String(want.value) : want.type === "shipping" ? "FRETE" : "";
  const base = (str(f, "code") || name.split(" ")[0]).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20);
  const code = str(f, "code") ? base : `${base}${suffix}`;
  const phone = normalizePhone(str(f, "phone")) ?? `sem-${Date.now()}`;
  let discountId: string | null = null;
  let disc: Disc = want;
  try {
    if (await db.referral.findFirst({ where: { code: { equals: code, mode: "insensitive" } } })) redirect(`/atletas?novo=1&erro=${encodeURIComponent("Esse cupom já está ligado a alguém")}`);
    const existing = await findShopifyCode(code);
    if (existing) {
      discountId = existing.id;
      disc = existing.disc;
      if (f.get("ajustar") === "on" && !sameDisc(existing.disc, want)) { discountId = await setPartnerDisc(existing.id, code, existing.disc, want); disc = want; }
    } else {
      discountId = await createPartnerCode(code, want, `Atleta ${name}`);
    }
    await db.referral.create({ data: { name, phone, code, discountId, ...discFields(disc), kind: str(f, "kind") || "atleta", payout: str(f, "payout") || "pix", instagram: str(f, "instagram").replace(/^@/, "") || null } });
  } catch (e) {
    if (String(e).includes("NEXT_REDIRECT")) throw e;
    redirect(`/atletas?novo=1&erro=${msg(e)}`);
  }
  revalidatePath("/atletas");
  redirect(`/atletas?criado=${code}`);
}

// Deixa o cupom no desconto padrão do programa, ou no desconto escolhido para esse atleta
export async function fixPartnerPercent(f: FormData) {
  await admin();
  const r = await db.referral.findUnique({ where: { id: str(f, "id") } });
  if (!r) redirect("/atletas");
  const want = await discFrom(f);
  try {
    const found = await findShopifyCode(r!.code);
    if (!found) throw new Error("Cupom não encontrado na Shopify");
    const id = await setPartnerDisc(found.id, r!.code, found.disc, want);
    await db.referral.update({ where: { id: r!.id }, data: { discountId: id, ...discFields(want) } });
  } catch (e) {
    redirect(`/atletas?erro=${msg(e)}`);
  }
  revalidatePath("/atletas");
  redirect("/atletas?ok=desconto");
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
  const t = str(f, "dtype") || "percent";
  await saveSetting("referral", { commission: Math.min(50, n("commission", 8)), discountType: t, ...(t === "percent" ? { percent: Math.min(90, Math.max(1, n("dvalue", 10))) } : {}), ...(t === "fixed" ? { fixedAmount: Math.max(1, n("dvalue", 10)) } : {}), minSubtotal: n("dmin", 0) });
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
  const id = str(f, "id");
  const code = str(f, "code").replace(/\s+/g, "").toUpperCase();
  if (!code) redirect(`/atletas?editar=${id}`);
  const other = await db.referral.findFirst({ where: { code: { equals: code, mode: "insensitive" }, NOT: { id } } });
  if (other) redirect(`/atletas?editar=${id}&erro=${encodeURIComponent(`O cupom ${code} já está ligado a ${other.name ?? "outra pessoa"}`)}`);
  try {
    const existing = await findShopifyCode(code);
    const rule = await ruleDisc();
    const discountId = existing ? existing.id : await createPartnerCode(code, rule);
    await db.referral.update({ where: { id }, data: { code, discountId, ...discFields(existing ? existing.disc : rule) } });
  } catch (e) {
    if (String(e).includes("NEXT_REDIRECT")) throw e;
    redirect(`/atletas?editar=${id}&erro=${msg(e)}`);
  }
  revalidatePath("/atletas");
  redirect(`/atletas?trocado=${code}`);
}
