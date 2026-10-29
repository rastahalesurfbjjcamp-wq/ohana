import { db } from "./db";
import { env } from "./env";

// Grupo da comunidade com mais vaga e convite disponível
export async function groupWithRoom() {
  const groups = await db.group.findMany({ where: { isCommunity: true, archived: false, inviteCode: { not: null } } });
  const open = groups.filter((g) => g.size < g.capacity - 5).sort((a, b) => a.size - b.size);
  return open[0] ?? groups.sort((a, b) => a.size - b.size)[0] ?? null;
}

export const redirectLink = () => `${env.appUrl().replace(/\/$/, "")}/g`;
