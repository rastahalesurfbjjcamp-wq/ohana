import type { Metadata } from "next";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { Rastreio } from "./Rastreio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Acompanhe seu pedido", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const sp = await searchParams;
  const st = await getSettings().catch(() => null);
  return <Rastreio store={env.storeName()} site={st?.postsale.storeUrl ?? ""} wa="" pedido={(sp.pedido ?? "").replace(/\D/g, "").slice(0, 12)} />;
}
