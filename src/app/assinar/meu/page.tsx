import type { Metadata } from "next";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { MemberArea } from "./MemberArea";
import "../assinar.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meu clube", description: "Seus pontos, seu desconto e seus resgates." };

const Lock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;

export default async function MeuClube({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const { club, postsale } = await getSettings();
  return (
    <div className="sub">
      <header className="sb-top">
        <a className="sb-logo" href={postsale.storeUrl}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lion.png" alt="" /><b>{env.storeName()}</b>
        </a>
        <div className="sb-sec"><Lock /> Área do membro</div>
      </header>
      <div className="sb-rule" />
      <div className="mc-wrap">
        <div className="sb-eyebrow">{club.name}</div>
        <h1 className="mc-h">Meu clube</h1>
        <MemberArea token={t ?? ""} />
      </div>
    </div>
  );
}
