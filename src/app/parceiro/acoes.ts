"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { currentPartner, partnerSignIn, partnerSignOut } from "@/lib/partnerAuth";
import { cents, requestWithdrawal } from "@/lib/ledger";

const VALID_MS = 7 * 864e5;
const tries = new Map<string, { n: number; at: number }>();

export async function entrarParceiro(f: FormData) {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const pass = String(f.get("password") ?? "");
  const t = tries.get(email);
  if (t && t.n >= 8 && Date.now() - t.at < 15 * 60_000) redirect("/parceiro/entrar?e=muitas");
  const p = email ? await db.referral.findFirst({ where: { email: { equals: email, mode: "insensitive" }, active: true, passwordHash: { not: null } } }) : null;
  if (!p || !(await bcrypt.compare(pass, p.passwordHash!))) {
    tries.set(email, { n: (t && Date.now() - t.at < 15 * 60_000 ? t.n : 0) + 1, at: Date.now() });
    redirect("/parceiro/entrar?e=1");
  }
  tries.delete(email);
  await db.referral.update({ where: { id: p!.id }, data: { lastLoginAt: new Date() } });
  await partnerSignIn(p!.id);
  redirect("/parceiro");
}

export async function sairParceiro() {
  await partnerSignOut();
  redirect("/parceiro/entrar");
}

export async function criarSenhaParceiro(f: FormData) {
  const token = String(f.get("token") ?? "");
  const pass = String(f.get("password") ?? "");
  if (pass.length < 8) redirect(`/parceiro/convite/${token}?e=curta`);
  if (pass !== String(f.get("again") ?? "")) redirect(`/parceiro/convite/${token}?e=igual`);
  const p = token ? await db.referral.findFirst({ where: { inviteToken: token, active: true } }) : null;
  if (!p || !p.inviteAt || Date.now() - p.inviteAt.getTime() > VALID_MS) redirect(`/parceiro/convite/${token}?e=expirado`);
  await db.referral.update({ where: { id: p!.id }, data: { passwordHash: await bcrypt.hash(pass, 10), inviteToken: null, lastLoginAt: new Date() } });
  await partnerSignIn(p!.id);
  redirect("/parceiro?bemvindo=1");
}

export async function pedirSaque(f: FormData) {
  const p = await currentPartner();
  if (!p) redirect("/parceiro/entrar");
  const raw = String(f.get("amount") ?? "").replace(/[^\d,.]/g, "");
  const value = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  const r = await requestWithdrawal(p!.id, cents(value), String(f.get("pix") ?? ""));
  if (!r.ok) redirect(`/parceiro?saque=erro&msg=${encodeURIComponent(r.error)}#saque`);
  redirect("/parceiro?saque=ok#saque");
}
