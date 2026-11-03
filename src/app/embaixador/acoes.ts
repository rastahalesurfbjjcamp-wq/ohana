"use server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { BELTS, startLevel } from "@/lib/ambassador";
import { pushcut } from "@/lib/pushcut";

const igOf = (v: string) => v.trim().toLowerCase().replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/?].*$/, "").replace(/^@+/, "");
const back = (e: string) => redirect(`/embaixador?e=${e}#cadastro`);

// Cadastro público de embaixador: entra como pedido, a equipe aprova no Hub
export async function cadastrarEmbaixador(f: FormData) {
  const ig = igOf(String(f.get("instagram") ?? ""));
  const name = String(f.get("name") ?? "").trim().slice(0, 80);
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const pass = String(f.get("password") ?? "");
  const belt = String(f.get("belt") ?? "");
  const teacher = String(f.get("teacher") ?? "") === "sim";
  let phone = String(f.get("phone") ?? "").replace(/\D/g, "");
  if (!ig || !name || !email || !pass || !belt || !f.get("teacher")) back("campos");
  if (!/^[a-z0-9._]{2,30}$/.test(ig) || ig.startsWith(".") || ig.endsWith(".") || ig.includes("..")) back("arroba");
  if (!(BELTS as readonly string[]).includes(belt)) back("campos");
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  if (phone.length < 12 || phone.length > 13) back("fone");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("email");
  if (pass.length < 8) back("curta");
  if (pass !== String(f.get("again") ?? "")) back("igual");
  if (await db.referral.findFirst({ where: { email: { equals: email, mode: "insensitive" }, passwordHash: { not: null } } })) back("emailuso");
  const all = await db.referral.findMany({ where: { instagram: { not: null } }, select: { instagram: true } });
  if (all.some((r) => igOf(r.instagram ?? "") === ig)) back("existe");
  if (await db.referral.findUnique({ where: { phone } })) back("foneuso");

  const base = ig.replace(/[^a-z0-9]/g, "").toUpperCase().slice(0, 16) || "EMBAIXADOR";
  let code = base;
  for (let i = 2; await db.referral.findUnique({ where: { code } }); i++) code = `${base}${i}`;
  await db.referral.create({
    data: { phone, name, email, instagram: `@${ig}`, code, kind: "embaixador", payout: "pix", active: false, pendingAt: new Date(), passwordHash: await bcrypt.hash(pass, 10), belt, teacher, level: startLevel(belt, teacher) },
  });
  await pushcut("Novo pedido de embaixador", `${name} (@${ig}) · faixa ${belt}${teacher ? " · professor" : ""}`).catch(() => null);
  redirect("/embaixador?ok=1#cadastro");
}
