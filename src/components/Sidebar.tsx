"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftRight, CalendarClock, ChevronDown, ChevronRight, LayoutDashboard, LogOut, MessagesSquare,
  ReceiptText, Settings, ShoppingBag, Sparkles, Users, Wallet, type LucideIcon,
} from "lucide-react";

type Item = { href: string; icon: LucideIcon; label: string; badge?: number };
type Group = { label: string; icon: LucideIcon; items: Item[] };

export function Sidebar({ name, connected, leaves, logout }: { name: string; connected: boolean; leaves: number; logout: () => Promise<void> }) {
  const path = usePathname();
  const groups: Group[] = [
    {
      label: "Comunidade",
      icon: Users,
      items: [
        { href: "/grupos", icon: MessagesSquare, label: "Grupos" },
        { href: "/entradas", icon: ArrowLeftRight, label: "Entradas e saídas", badge: leaves || undefined },
        { href: "/agendamentos", icon: CalendarClock, label: "Agendamentos" },
      ],
    },
    { label: "Vendas", icon: ShoppingBag, items: [{ href: "/custos", icon: Wallet, label: "Custos e lotes" }] },
    { label: "Inteligência", icon: Sparkles, items: [{ href: "/relatorio", icon: ReceiptText, label: "Relatório diário" }] },
  ];
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.label, true])),
  );
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside className="side">
      <div className="brand">
        <div className="mark">O</div>
        <div>
          <b>Ohana</b>
          <small>Rasta Hale</small>
        </div>
      </div>
      <nav className="nav">
        <Link href="/" className={`nv${active("/") ? " on" : ""}`}>
          <LayoutDashboard size={18} strokeWidth={1.75} className="ic" />
          <span>Visão geral</span>
        </Link>
        {groups.map((g) => (
          <div className="grp" key={g.label}>
            <button type="button" className="gh" onClick={() => setOpen((o) => ({ ...o, [g.label]: !o[g.label] }))}>
              <g.icon size={18} strokeWidth={1.75} className="ic" />
              <span>{g.label}</span>
              {open[g.label] ? <ChevronDown size={16} className="chev" /> : <ChevronRight size={16} className="chev" />}
            </button>
            {open[g.label] && (
              <div className="gi">
                {g.items.map((it) => (
                  <Link key={it.href} href={it.href} className={`nv sub${active(it.href) ? " on" : ""}`}>
                    <it.icon size={18} strokeWidth={1.75} className="ic" />
                    <span>{it.label}</span>
                    {it.badge ? <span className="bdg">{it.badge}</span> : null}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="foot">
        <Link href="/configuracoes" className={`nv${active("/configuracoes") ? " on" : ""}`}>
          <Settings size={18} strokeWidth={1.75} className="ic" />
          <span>Configurações</span>
        </Link>
        <div className="me">
          <div className="av">{initials}</div>
          <div>
            <b>{name.split(" ")[0]}</b>
            <small>
              <i className={`live${connected ? "" : " off"}`} />
              {connected ? "WhatsApp conectado" : "WhatsApp desconectado"}
            </small>
          </div>
          <form action={logout}>
            <button className="btn sm" title="Sair" type="submit" style={{ border: 0, background: "none", color: "var(--ink2)" }}>
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
