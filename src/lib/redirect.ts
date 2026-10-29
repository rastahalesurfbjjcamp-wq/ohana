import { db } from "./db";
import { env } from "./env";

// Ordem de enchimento: um grupo de cada vez, pelo nome. Quando um enche, o próximo abre.
export async function fillOrder() {
  const groups = await db.group.findMany({ where: { isCommunity: true, archived: false, kind: { not: "avisos" } } });
  return groups.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
}
export const hasRoom = (g: { size: number; capacity: number }) => g.size < g.capacity - 5;

// Grupo da comunidade que está recebendo agora (com convite disponível)
export async function groupWithRoom() {
  const groups = (await fillOrder()).filter((g) => g.inviteCode);
  return groups.find(hasRoom) ?? [...groups].sort((a, b) => a.size / a.capacity - b.size / b.capacity)[0] ?? null;
}

export const redirectLink = () => `${env.appUrl().replace(/\/$/, "")}/g`;
