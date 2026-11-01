import { redirect } from "next/navigation";
import { migrateFunnels } from "@/lib/funnelMigrate";

export const dynamic = "force-dynamic";

// Funis agora são automações no editor de blocos
export default async function Funis() {
  await migrateFunnels().catch(() => null);
  redirect("/automacoes");
}
