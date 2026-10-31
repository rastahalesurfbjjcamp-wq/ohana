"use server";
// Clube de fidelidade: cadastro, mensalidade, resgate de pontos e entrada em evento.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { addPoints, cpfValid, createMemberCode, createPrizeReward, createReward, digits, findShopifyCustomer, registerPayment, scanClub, setMemberAccess, tagCustomer } from "@/lib/club";
import { getSettings, saveSetting } from "@/lib/settings";
import { normalizePhone } from "@/lib/segments";

async function user() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
async function admin() {
  const s = await user();
  if (s.role !== "ADMIN") throw new Error("Só o administrador pode mudar isso");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const msg = (e: unknown) => encodeURIComponent(String(e).replace(/^Error: /, "").slice(0, 160));
const back = (q: string, extra: string) => `/clube?${q ? `q=${encodeURIComponent(q)}&` : ""}${extra}`;
const rethrow = (e: unknown) => { if (String(e).includes("NEXT_REDIRECT")) throw e; };

export async function addMember(f: FormData) {
  const u = await user();
  const s = (await getSettings()).club;
  const name = str(f, "name");
  const cpf = digits(str(f, "cpf")) || null;
  const phone = normalizePhone(str(f, "phone"));
  const email = str(f, "email").toLowerCase() || null;
  if (!name) redirect("/clube?novo=1&erro=nome");
  if (cpf && !cpfValid(cpf)) redirect(`/clube?novo=1&erro=${encodeURIComponent("CPF inválido")}`);
  if (!cpf && !phone && !email) redirect(`/clube?novo=1&erro=${encodeURIComponent("Coloque CPF, telefone ou e-mail")}`);
  let id = "";
  try {
    if (cpf && (await db.clubMember.findUnique({ where: { cpf } }))) throw new Error("Esse CPF já está no clube");
    const shop = str(f, "customerId") ? { id: str(f, "customerId") } : await findShopifyCustomer({ email, phone, cpf });
    const { code, id: discountId } = await createMemberCode(name, shop?.id ?? null, s.discountPct);
    if (shop?.id) await tagCustomer(shop.id);
    const m = await db.clubMember.create({ data: { name, cpf, phone, email, customerId: shop?.id ?? null, code, discountId, fee: s.fee, note: str(f, "note") || null } });
    id = m.id;
    if (f.get("paid") === "on") await registerPayment(m.id, Math.max(1, Number(str(f, "months")) || 1), u.name);
    await addPoints(m.id, Number(str(f, "bonus")) || 0, "bonus", "entrada", "Bônus de entrada", u.name);
  } catch (e) {
    rethrow(e);
    redirect(`/clube?novo=1&erro=${msg(e)}`);
  }
  revalidatePath("/clube");
  redirect(`/clube?q=${encodeURIComponent(cpf ?? phone ?? email ?? name)}&criado=${id}`);
}

export async function payMember(f: FormData) {
  const u = await user();
  const q = str(f, "q");
  try {
    await registerPayment(str(f, "id"), Math.max(1, Math.min(12, Number(str(f, "months")) || 1)), u.name);
  } catch (e) {
    redirect(back(q, `erro=${msg(e)}`));
  }
  revalidatePath("/clube");
  redirect(back(q, "ok=pago"));
}

export async function redeemPoints(f: FormData) {
  const u = await user();
  const q = str(f, "q");
  let code = "";
  try {
    code = (await createReward(str(f, "id"), Math.floor(Number(str(f, "points").replace(/\D/g, "")) || 0), u.name)).code;
  } catch (e) {
    redirect(back(q, `erro=${msg(e)}`));
  }
  revalidatePath("/clube");
  redirect(back(q, `cupom=${code}`));
}

export async function eventCheckin(f: FormData) {
  const u = await user();
  const s = (await getSettings()).club;
  const q = str(f, "q");
  const id = str(f, "id");
  const event = str(f, "event") || "Evento";
  const m = await db.clubMember.findUnique({ where: { id } });
  if (!m) redirect(back(q, "erro=membro"));
  if (s.eventPoints > 0 && m!.points < s.eventPoints) redirect(back(q, `erro=${encodeURIComponent(`Precisa de ${s.eventPoints} pontos para entrar`)}`));
  const ok = await addPoints(id, -s.eventPoints, "evento", `${event.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`, `Entrada: ${event}`, u.name);
  revalidatePath("/clube");
  redirect(back(q, ok ? "ok=entrada" : `erro=${encodeURIComponent("Entrada nesse evento já registrada hoje")}`));
}

export async function adjustPoints(f: FormData) {
  const u = await admin();
  const q = str(f, "q");
  const n = Math.round(Number(str(f, "delta").replace(",", ".")) || 0);
  if (n) await addPoints(str(f, "id"), n, "ajuste", String(Date.now()), str(f, "note") || "Ajuste manual", u.name);
  revalidatePath("/clube");
  redirect(back(q, "ok=ajuste"));
}

export async function cancelMember(f: FormData) {
  await admin();
  const q = str(f, "q");
  const m = await db.clubMember.findUnique({ where: { id: str(f, "id") } });
  if (m) {
    const on = m.status === "cancelado";
    await db.clubMember.update({ where: { id: m.id }, data: { status: on ? "ativo" : "cancelado" } });
    await setMemberAccess(m, on).catch(() => null);
  }
  revalidatePath("/clube");
  redirect(back(q, "ok=1"));
}

export async function updateMember(f: FormData) {
  await user();
  const q = str(f, "q");
  const cpf = digits(str(f, "cpf")) || null;
  if (cpf && !cpfValid(cpf)) redirect(back(q, `erro=${encodeURIComponent("CPF inválido")}`));
  await db.clubMember.update({ where: { id: str(f, "id") }, data: { name: str(f, "name") || undefined, cpf, phone: normalizePhone(str(f, "phone")), email: str(f, "email").toLowerCase() || null } }).catch(() => null);
  revalidatePath("/clube");
  redirect(back(q, "ok=1"));
}

export async function saveClubRules(f: FormData) {
  await admin();
  const n = (k: string, d: number) => { const v = Number(str(f, k).replace(",", ".")); return Number.isFinite(v) && v >= 0 ? v : d; };
  const c = (await getSettings()).club;
  await saveSetting("club", {
    enabled: f.get("enabled") === "on", name: str(f, "name") || c.name,
    fee: n("fee", c.fee), discountPct: Math.min(50, n("discountPct", c.discountPct)), pointsPerReal: n("pointsPerReal", c.pointsPerReal),
    valuePer100: n("valuePer100", c.valuePer100), monthlyPoints: Math.round(n("monthlyPoints", c.monthlyPoints)), eventPoints: Math.round(n("eventPoints", c.eventPoints)),
    minRedeem: Math.round(n("minRedeem", c.minRedeem)), graceDays: Math.round(n("graceDays", c.graceDays)), earlyHours: Math.round(n("earlyHours", c.earlyHours)),
  });
  // porcentagem ou nome mudou: atualiza o desconto automático da loja
  if (c.autoDiscountId && (Math.min(50, n("discountPct", c.discountPct)) !== c.discountPct || (str(f, "name") && str(f, "name") !== c.name))) {
    const { updateClubAutoDiscount } = await import("@/lib/club");
    await updateClubAutoDiscount().catch(() => null);
  }
  revalidatePath("/clube");
  redirect("/clube?ok=regras");
}

export async function scanClubNow() {
  await user();
  let r = { points: 0 };
  try {
    r = await scanClub(30);
  } catch (e) {
    redirect(`/clube?erro=${msg(e)}`);
  }
  revalidatePath("/clube");
  redirect(`/clube?somados=${r.points}`);
}

/* Catálogo de recompensas */
export async function savePrize(f: FormData) {
  await admin();
  const title = str(f, "title");
  const points = Math.round(Number(str(f, "points").replace(/\D/g, "")) || 0);
  const productId = str(f, "productId") || null;
  if (!title || points <= 0) redirect("/clube?premios=1&erro=" + encodeURIComponent("Coloque o nome e os pontos"));
  const image = str(f, "image") || null;
  const id = str(f, "id");
  if (id) await db.clubPrize.update({ where: { id }, data: { title, points, productId, image } });
  else await db.clubPrize.create({ data: { title, points, productId, image } });
  revalidatePath("/clube");
  redirect("/clube?premios=1&ok=1");
}
export async function togglePrize(f: FormData) {
  await admin();
  const p = await db.clubPrize.findUnique({ where: { id: str(f, "id") } });
  if (p) await db.clubPrize.update({ where: { id: p.id }, data: { active: !p.active } });
  revalidatePath("/clube");
  redirect("/clube?premios=1");
}
export async function redeemPrize(f: FormData) {
  const u = await user();
  const q = str(f, "q");
  let code = "";
  try {
    code = (await createPrizeReward(str(f, "id"), str(f, "prize"), u.name)).code;
  } catch (e) {
    redirect(back(q, `erro=${msg(e)}`));
  }
  revalidatePath("/clube");
  redirect(back(q, `cupom=${code}`));
}

// Cancela também a cobrança na Appmax
export async function cancelSubscription(f: FormData) {
  await admin();
  const q = str(f, "q");
  const m = await db.clubMember.findUnique({ where: { id: str(f, "id") } });
  if (!m) redirect(back(q, "erro=membro"));
  try {
    if (m!.subscriptionId) {
      const { cancelSubscription: cancelAt } = await import("@/lib/appmax");
      await cancelAt(m!.subscriptionId, "Cancelado pelo painel do Hub");
    }
    await db.clubMember.update({ where: { id: m!.id }, data: { status: "cancelado", canceledAt: new Date() } });
    await setMemberAccess(m!, false).catch(() => null);
    await db.clubEvent.create({ data: { memberId: m!.id, kind: "cancelou", text: "Assinatura cancelada pelo painel" } });
  } catch (e) {
    rethrow(e);
    redirect(back(q, `erro=${msg(e)}`));
  }
  revalidatePath("/clube");
  redirect(back(q, "ok=cancelado"));
}

/* Mensagens do clube no WhatsApp */
export async function toggleClubMsg(f: FormData) {
  await admin();
  const k = str(f, "key");
  if (!["msgWelcome", "msgPoints", "msgBirthday", "msgTier"].includes(k)) return;
  await saveSetting("club", { [k]: f.get("on") === "1" });
  revalidatePath("/clube");
}

export async function launchClubMsg(f: FormData) {
  await admin();
  const text = str(f, "text").slice(0, 1500);
  const s = (await getSettings()).club;
  const members = await db.clubMember.findMany({ where: { status: { not: "cancelado" }, phone: { not: null } }, select: { id: true, status: true, paidUntil: true } });
  const ids = members.filter((m) => m.paidUntil && m.paidUntil.getTime() + s.graceDays * 864e5 >= Date.now()).map((m) => m.id);
  if (!ids.length) redirect("/clube?msgs=1&erro=Nenhum membro em dia para avisar");
  const { enqueue } = await import("@/lib/queue");
  await enqueue("club-launch", { ids, text }, { jobId: `cl-${Date.now()}` });
  redirect(`/clube?msgs=1&ok=aviso&n=${ids.length}`);
}
