// Cria os 2 acessos do painel na primeira vez, com os dados das variáveis do servidor.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const db = new PrismaClient();

async function ensure(email: string | undefined, password: string | undefined, name: string, role: "ADMIN" | "TEAM") {
  if (!email || !password) return;
  const e = email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email: e } })) return;
  await db.user.create({ data: { email: e, name, role, passwordHash: await bcrypt.hash(password, 10) } });
  console.log(`Acesso criado: ${e}`);
}

// Se a senha do administrador mudar nas variáveis do servidor (ADMIN_PASSWORD), o acesso passa a usar a nova.
async function syncAdminPassword(email: string | undefined, password: string | undefined) {
  if (!email || !password) return;
  const e = email.trim().toLowerCase();
  const mark = createHash("sha256").update(`${e}:${password}`).digest("hex");
  const prev = await db.setting.findUnique({ where: { key: "_admin_env_pw" } });
  if ((prev?.value as { mark?: string } | null)?.mark === mark) return;
  const u = await db.user.findUnique({ where: { email: e } });
  if (u) {
    await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(password, 10), active: true, role: "ADMIN", pendingAt: null } });
    console.log(`Senha do administrador atualizada pelas variáveis do servidor: ${e}`);
  }
  await db.setting.upsert({ where: { key: "_admin_env_pw" }, create: { key: "_admin_env_pw", value: { mark } }, update: { value: { mark } } });
}

async function main() {
  const env = process.env;
  await ensure(env.ADMIN_EMAIL, env.ADMIN_PASSWORD, env.ADMIN_NAME ?? "Administrador", "ADMIN");
  await syncAdminPassword(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  await ensure(env.TEAM_EMAIL, env.TEAM_PASSWORD, env.TEAM_NAME ?? "Equipe", "TEAM");
}

main().finally(() => db.$disconnect());
