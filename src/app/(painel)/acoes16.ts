"use server";
// Portal dos parceiros pelo lado da loja: acordo, acesso, saques, ajustes e regras do programa.
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cents, program, saveProgram, syncLedger, type Program } from "@/lib/ledger";

async function admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "ADMIN") redirect("/atletas/portal?erro=admin");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const money = (v: string) => { const r = v.replace(/[^\d,.-]/g, ""); return Number(r.includes(",") ? r.replace(/\./g, "").replace(",", ".") : r) || 0; };
const back = (q = "") => { revalidatePath("/atletas/portal"); redirect(`/atletas/portal${q}`); };

export async function savePartnerAccess(f: FormData) {
  await admin();
  const id = str(f, "id");
  const pct = str(f, "pct");
  const email = str(f, "email").toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("?erro=email");
  if (email && (await db.referral.findFirst({ where: { email: { equals: email, mode: "insensitive" }, id: { not: id } } }))) back("?erro=emailuso");
  const fx = str(f, "fixed"), mn = str(f, "min");
  await db.referral.update({ where: { id }, data: { commissionPct: pct === "" ? null : Math.max(0, Math.min(50, money(pct))), email: email || null, fixedMonthly: fx === "" ? null : Math.max(0, money(fx)) || null, minMonthly: mn === "" ? null : Math.max(0, money(mn)) || null } });
  back("?salvo=1");
}

export async function invitePartner(f: FormData) {
  await admin();
  const id = str(f, "id");
  const p = await db.referral.findUnique({ where: { id } });
  if (!p?.email) back("?erro=semEmail");
  await db.referral.update({ where: { id }, data: { inviteToken: randomBytes(24).toString("base64url"), inviteAt: new Date() } });
  back(`?convite=${id}`);
}

export async function revokePartner(f: FormData) {
  await admin();
  await db.referral.update({ where: { id: str(f, "id") }, data: { passwordHash: null, inviteToken: null } });
  back("?salvo=1");
}

export async function payWithdrawal(f: FormData) {
  const s = await admin();
  const id = str(f, "id");
  const w = await db.partnerWithdrawal.findUnique({ where: { id } });
  if (!w || w.status !== "solicitado") back();
  await db.partnerWithdrawal.update({ where: { id }, data: { status: "pago", paidAt: new Date(), paidBy: s.name, method: str(f, "method") || "pix" } });
  back("?pago=1");
}

export async function refuseWithdrawal(f: FormData) {
  const s = await admin();
  const id = str(f, "id");
  const w = await db.partnerWithdrawal.findUnique({ where: { id } });
  if (!w || w.status !== "solicitado") back();
  await db.partnerWithdrawal.update({ where: { id }, data: { status: "recusado", paidBy: s.name, note: str(f, "note").slice(0, 200) || null } });
  back("?salvo=1");
}

// Pagamento feito por fora (sem pedido do parceiro): entra como saque pago
export async function manualPayout(f: FormData) {
  const s = await admin();
  const amount = cents(money(str(f, "amount")));
  if (amount <= 0) back("?erro=valor");
  await db.partnerWithdrawal.create({ data: { referralId: str(f, "id"), amountCents: amount, status: "pago", paidAt: new Date(), paidBy: s.name, method: str(f, "method") || "pix", note: str(f, "note").slice(0, 200) || "Pagamento lançado pela loja" } });
  back("?pago=1");
}

export async function addAdjustment(f: FormData) {
  const s = await admin();
  const amount = cents(money(str(f, "amount")));
  const note = str(f, "note").slice(0, 200);
  if (!amount || !note) back("?erro=ajuste");
  const now = new Date();
  await db.partnerEarning.create({ data: { referralId: str(f, "id"), key: `ajuste:${randomBytes(8).toString("hex")}`, kind: "ajuste", month: now.toISOString().slice(0, 7), amountCents: amount, availableAt: now, note, createdBy: s.name } });
  back(`?p=${str(f, "id")}&salvo=1`);
}

export async function saveProgramForm(f: FormData) {
  await admin();
  const cur = await program();
  const tiers = f.getAll("tmin").map((v, i) => ({ minCents: cents(money(String(v))), bonusCents: cents(money(String(f.getAll("tbonus")[i] ?? ""))) })).filter((t) => t.minCents > 0 && t.bonusCents > 0);
  const milestones = f.getAll("mmin").map((v, i) => ({ minCents: cents(money(String(v))), prizeCents: cents(money(String(f.getAll("mprize")[i] ?? ""))) })).filter((m) => m.minCents > 0 && m.prizeCents > 0);
  const start = str(f, "startDate");
  const next: Program = {
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : cur.startDate,
    releaseDay: Math.max(1, Math.min(28, Number(str(f, "releaseDay")) || 1)),
    minWithdrawCents: cents(money(str(f, "minWithdraw"))) || 0,
    tiers, milestones,
  };
  await saveProgram(next);
  back("?salvo=1");
}

export async function syncNowLedger() {
  await admin();
  await syncLedger({ force: true });
  back("?sync=1");
}
