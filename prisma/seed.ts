// Cria os 2 acessos do painel na primeira vez, com os dados das variáveis do servidor.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function ensure(email: string | undefined, password: string | undefined, name: string, role: "ADMIN" | "TEAM") {
  if (!email || !password) return;
  const e = email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email: e } })) return;
  await db.user.create({ data: { email: e, name, role, passwordHash: await bcrypt.hash(password, 10) } });
  console.log(`Acesso criado: ${e}`);
}

async function main() {
  const env = process.env;
  await ensure(env.ADMIN_EMAIL, env.ADMIN_PASSWORD, env.ADMIN_NAME ?? "Administrador", "ADMIN");
  await ensure(env.TEAM_EMAIL, env.TEAM_PASSWORD, env.TEAM_NAME ?? "Equipe", "TEAM");
}

main().finally(() => db.$disconnect());
