"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { currentPartner, partnerSignIn, partnerSignOut } from "@/lib/partnerAuth";
import { cents, requestWithdrawal } from "@/lib/ledger";
import { createPartnerCode, findShopifyCode, ruleDisc } from "@/lib/partners";

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
  await db.referral.update({ where: { id: p!.id }, data: { passwordHash: await bcrypt.hash(pass, 10), inviteToken: null, lastLoginAt: new Date(), portalAt: p!.portalAt ?? new Date() } });
  await partnerSignIn(p!.id);
  redirect("/parceiro?bemvindo=1");
}

export async function pedirSaque(f: FormData) {
  const p = await currentPartner();
  if (!p) redirect("/parceiro/entrar");
  const raw = String(f.get("amount") ?? "").replace(/[^\d,.]/g, "");
  const value = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  const r = await requestWithdrawal(p!.id, cents(value), String(f.get("pix") ?? ""));
  if (!r.ok) redirect(`/parceiro/saques?saque=erro&msg=${encodeURIComponent(r.error)}`);
  redirect("/parceiro/saques?saque=ok");
}

const igOf = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/?].*$/, "").replace(/^@/, "");

// Cadastro aberto: acha o parceiro pelo @ (ou cria), liga ou cria o cupom na Shopify e já entra.
// A comissão passa a contar a partir deste momento.
export async function cadastrarParceiro(f: FormData) {
  const ig = igOf(String(f.get("instagram") ?? ""));
  const name = String(f.get("name") ?? "").trim().slice(0, 80);
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const pass = String(f.get("password") ?? "");
  let phone = String(f.get("phone") ?? "").replace(/\D/g, "");
  if (!ig || !name || !email || !pass) redirect("/parceiro/cadastro?e=campos");
  if (!/^[a-z0-9._]{2,30}$/.test(ig)) redirect("/parceiro/cadastro?e=arroba");
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  if (phone.length < 12 || phone.length > 13) redirect("/parceiro/cadastro?e=fone");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/parceiro/cadastro?e=email");
  if (pass.length < 8) redirect("/parceiro/cadastro?e=curta");
  if (pass !== String(f.get("again") ?? "")) redirect("/parceiro/cadastro?e=igual");
  if (await db.referral.findFirst({ where: { email: { equals: email, mode: "insensitive" }, passwordHash: { not: null } } })) redirect("/parceiro/cadastro?e=emailuso");

  const partners = await db.referral.findMany({ where: { instagram: { not: null } } });
  const found = partners.find((r) => igOf(r.instagram) === ig);
  if (found?.passwordHash) redirect("/parceiro/cadastro?e=existe");
  // proteção: o @ já é de um atleta cadastrado pela equipe, então o WhatsApp tem que bater com o que está lá
  const tail = (v: string) => v.replace(/\D/g, "").slice(-8);
  if (found && !found.phone.startsWith("sem-") && tail(found.phone) !== tail(phone)) redirect("/parceiro/cadastro?e=confere");
  const hash = await bcrypt.hash(pass, 10);
  const now = new Date();

  // garante que o cupom existe na Shopify: usa o que já tem, senão cria
  const ensureCode = async (code: string, current: string | null) => {
    if (current) return current;
    try {
      const ex = await findShopifyCode(code);
      if (ex) return ex.id;
      return await createPartnerCode(code, await ruleDisc(), `Atleta ${code}`);
    } catch (err) {
      console.error("[parceiro] cupom", code, err);
      return null;
    }
  };

  let id: string;
  if (found) {
    const discountId = await ensureCode(found.code, found.discountId);
    await db.referral.update({ where: { id: found.id }, data: { email, passwordHash: hash, portalAt: found.portalAt ?? now, lastLoginAt: now, name: found.name || name, active: true, discountId, kind: found.kind === "influenciador" ? "influenciador" : "atleta" } });
    id = found.id;
  } else {
    if (await db.referral.findUnique({ where: { phone } })) redirect("/parceiro/cadastro?e=foneuso");
    const base = ig.replace(/[^a-z0-9]/g, "").toUpperCase().slice(0, 16) || "ATLETA";
    let code = base;
    for (let i = 2; await db.referral.findUnique({ where: { code } }); i++) code = `${base}${i}`;
    const discountId = await ensureCode(code, null);
    const r = await db.referral.create({ data: { phone, name, email, instagram: `@${ig}`, code, discountId, kind: "atleta", payout: "pix", passwordHash: hash, portalAt: now, lastLoginAt: now } });
    id = r.id;
  }
  await partnerSignIn(id);
  redirect("/parceiro?bemvindo=1");
}
