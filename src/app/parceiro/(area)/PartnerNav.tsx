"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Megaphone, Menu, ReceiptText, Wallet, X, type LucideIcon } from "lucide-react";

type Item = { href: string; icon: LucideIcon; label: string };
const ITEMS: Item[] = [
  { href: "/parceiro", icon: LayoutDashboard, label: "Início" },
  { href: "/parceiro/divulgar", icon: Megaphone, label: "Divulgar" },
  { href: "/parceiro/saques", icon: Wallet, label: "Saques" },
  { href: "/parceiro/extrato", icon: ReceiptText, label: "Extrato" },
];

export function PartnerNav({ name, code, logout }: { name: string; code: string; logout: () => Promise<void> }) {
  const path = usePathname();
  const [nav, setNav] = useState(false);
  useEffect(() => { setNav(false); }, [path]);
  useEffect(() => { document.body.classList.toggle("nav-open", nav); }, [nav]);
  const active = (h: string) => (h === "/parceiro" ? path === h : path.startsWith(h));
  const initials = name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  return (
    <>
      <header className="mtop">
        <button type="button" className="mtop-b" onClick={() => setNav(true)} aria-label="Abrir menu"><Menu size={20} /></button>
        <Link href="/parceiro" className="mtop-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lion.png" alt="" width={26} height={28} />
          <b>Rasta Hale Parceiros</b>
        </Link>
        <span style={{ width: 36 }} />
      </header>
      {nav && <div className="nav-ov" onClick={() => setNav(false)} />}
      <nav className="mtabs" aria-label="Atalhos">
        {ITEMS.map((t) => <Link key={t.href} href={t.href} className={active(t.href) ? "on" : ""}><t.icon size={20} strokeWidth={1.8} /><span>{t.label}</span></Link>)}
      </nav>
      <aside className={`side${nav ? " open" : ""}`}>
        <button type="button" className="side-x" onClick={() => setNav(false)} aria-label="Fechar menu"><X size={18} /></button>
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mark-img" src="/brand/lion.png" alt="" width={36} height={39} />
          <div><b>Rasta Hale</b><small>Área do parceiro</small></div>
        </div>
        <nav className="nav">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href} className={`nv${active(it.href) ? " on" : ""}`}>
              <it.icon size={18} strokeWidth={1.75} className="ic" /><span>{it.label}</span>
            </Link>
          ))}
        </nav>
        <div className="foot">
          <div className="me">
            <div className="av">{initials}</div>
            <div><b>{name.split(" ")[0]}</b><small>Cupom {code}</small></div>
            <form action={logout}>
              <button className="btn sm" title="Sair" type="submit" style={{ border: 0, background: "none", color: "var(--ink2)" }}><LogOut size={16} /></button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
