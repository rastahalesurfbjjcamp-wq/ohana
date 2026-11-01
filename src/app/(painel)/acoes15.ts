"use server";
// Equipe: criar acesso, áreas liberadas, convite para a pessoa criar a própria senha, desativar.
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALL_HREFS } from "@/lib/access";
import { demoBlock } from "@/lib/demo/guard";

async function admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "ADMIN") redirect("/");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const token = () => randomBytes(24).toString("base64url");
const areasOf = (f: FormData) => f.getAll("areas").map(String).filter((h) => ALL_HREFS.includes(h));

export async function createMember(f: FormData) {
  demoBlock("/equipe?demo=bloqueado");
  await admin();
  const name = str(f, "name"), email = str(f, "email").toLowerCase();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/equipe?erro=dados");
  if (await db.user.findUnique({ where: { email } })) redirect("/equipe?erro=email");
  const role = str(f, "role") === "ADMIN" ? "ADMIN" : "TEAM";
  const u = await db.user.create({ data: { name, email, role, passwordHash: "", areas: role === "ADMIN" ? [] : areasOf(f), inviteToken: token(), inviteAt: new Date(), phone: str(f, "phone").replace(/\D/g, "") || null } });
  revalidatePath("/equipe");
  redirect(`/equipe?convite=${u.id}`);
}

export async function updateMember(f: FormData) {
  demoBlock("/equipe?demo=bloqueado");
  const s = await admin();
  const id = str(f, "id");
  const role = str(f, "role") === "ADMIN" ? "ADMIN" : "TEAM";
  if (id === s.userId && role !== "ADMIN") redirect("/equipe?erro=voce");
  await db.user.update({ where: { id }, data: { name: str(f, "name") || undefined, role, areas: role === "ADMIN" ? [] : areasOf(f), phone: str(f, "phone").replace(/\D/g, "") || null } });
  revalidatePath("/equipe");
  redirect("/equipe?salvo=1");
}

export async function resendInvite(f: FormData) {
  demoBlock("/equipe?demo=bloqueado");
  await admin();
  const id = str(f, "id");
  await db.user.update({ where: { id }, data: { inviteToken: token(), inviteAt: new Date() } });
  revalidatePath("/equipe");
  redirect(`/equipe?convite=${id}`);
}

export async function toggleMember(f: FormData) {
  demoBlock("/equipe?demo=bloqueado");
  const s = await admin();
  const id = str(f, "id");
  if (id === s.userId) redirect("/equipe?erro=voce");
  const u = await db.user.findUnique({ where: { id } });
  if (u) await db.user.update({ where: { id }, data: { active: !u.active, inviteToken: u.active ? null : u.inviteToken } });
  revalidatePath("/equipe");
  redirect("/equipe");
}

export async function removeMember(f: FormData) {
  demoBlock("/equipe?demo=bloqueado");
  const s = await admin();
  const id = str(f, "id");
  if (id === s.userId) redirect("/equipe?erro=voce");
  await db.user.delete({ where: { id } }).catch(() => null);
  revalidatePath("/equipe");
  redirect("/equipe");
}
