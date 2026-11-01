import { redirect } from "next/navigation";
import { currentPartner } from "@/lib/partnerAuth";
import { sairParceiro } from "../acoes";
import { PartnerNav } from "./PartnerNav";

export const dynamic = "force-dynamic";

export default async function AreaLayout({ children }: { children: React.ReactNode }) {
  const p = await currentPartner();
  if (!p) redirect("/parceiro/entrar");
  return (
    <div className="app">
      <PartnerNav name={p.name ?? p.code} code={p.code} logout={sairParceiro} />
      <main className="main">{children}</main>
    </div>
  );
}
