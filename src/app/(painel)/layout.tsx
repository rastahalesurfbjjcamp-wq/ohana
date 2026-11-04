import { redirect } from "next/navigation";
import { getSession, logout } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";
import { env } from "@/lib/env";
import { TableSort } from "@/components/TableSort";
import { ChunkGuard } from "@/components/ChunkGuard";
import { warmSoon } from "@/lib/warm";
import { NavProgress } from "@/components/NavProgress";

export const dynamic = "force-dynamic";

async function sair() {
  "use server";
  await logout();
  redirect("/login");
}

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // acesso mudou (áreas ou conta desativada): renova a sessão
  if (process.env.DEMO_MODE !== "1") {
    const u = await db.user.findUnique({ where: { id: session.userId }, select: { active: true, areas: true, role: true } }).catch(() => null);
    if (u && (!u.active || u.role !== session.role || JSON.stringify(u.areas ?? []) !== JSON.stringify(session.areas ?? []))) redirect("/api/auth/refresh");
  }
  warmSoon();
  const [wa, leaves] = await Promise.all([
    db.setting.findUnique({ where: { key: "_whatsapp" } }),
    db.memberEvent.count({ where: { type: "LEAVE", createdAt: { gte: new Date(Date.now() - 864e5) }, group: { isCommunity: true } } }),
  ]);
  const connected = (wa?.value as { state?: string } | undefined)?.state === "open";
  return (
    <div className="app">
      <Sidebar name={session.name} store={env.storeName()} connected={connected} leaves={leaves} logout={sair} role={session.role} areas={session.areas ?? []} lite={process.env.HUB_LITE === "1"} />
      <main className="main">
        {children}
      </main>
      <TableSort />
      <ChunkGuard />
      <NavProgress name={env.storeName()} />
    </div>
  );
}
