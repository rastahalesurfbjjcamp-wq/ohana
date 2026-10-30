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
  warmSoon();
  const [wa, leaves] = await Promise.all([
    db.setting.findUnique({ where: { key: "_whatsapp" } }),
    db.memberEvent.count({ where: { type: "LEAVE", createdAt: { gte: new Date(Date.now() - 864e5) }, group: { isCommunity: true } } }),
  ]);
  const connected = (wa?.value as { state?: string } | undefined)?.state === "open";
  return (
    <div className="app">
      <Sidebar name={session.name} store={env.storeName()} connected={connected} leaves={leaves} logout={sair} />
      <main className="main">
        {process.env.DEMO_MODE === "1" && <div className="demo-bar">Demonstração com dados fictícios. Pode mexer à vontade: toda noite tudo volta ao original. Mensagens não são enviadas de verdade.</div>}
        {children}
      </main>
      <TableSort />
      <ChunkGuard />
      <NavProgress name={env.storeName()} />
    </div>
  );
}
