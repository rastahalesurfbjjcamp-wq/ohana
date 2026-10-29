"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftRight, Bot, Box, CalendarClock, CalendarHeart, ChartNoAxesCombined, ChevronDown, ChevronRight, Contact,
  Gift, HeartHandshake, LayoutDashboard, LogOut, MessageCircle, MessagesSquare, Package, Percent, ReceiptText,
  RefreshCcw, Rocket, Route, Send, Settings, ShoppingBag, Sparkles, SquareCheckBig, Truck, UserPlus, Users, Vote,
  Wallet, Warehouse, Workflow, Coins, Plug, LayoutTemplate, Medal, Crown, Calculator, type LucideIcon,
} from "lucide-react";

type Item = { href: string; icon: LucideIcon; label: string; badge?: number; soon?: boolean };
type Group = { label: string; icon: LucideIcon; items: Item[] };

export function Sidebar({ name, store, connected, leaves, logout }: { name: string; store: string; connected: boolean; leaves: number; logout: () => Promise<void> }) {
  const path = usePathname();
  const pinned: Item[] = [
    { href: "/", icon: LayoutDashboard, label: "Visão geral" },
    { href: "/tarefas", icon: SquareCheckBig, label: "Tarefas" },
  ];
  const groups: Group[] = [
    {
      label: "Comunidade",
      icon: Users,
      items: [
        { href: "/grupos", icon: MessagesSquare, label: "Grupos" },
        { href: "/entradas", icon: ArrowLeftRight, label: "Entradas e saídas", badge: leaves || undefined },
        { href: "/leads", icon: UserPlus, label: "Leads" },
        { href: "/disparos", icon: Send, label: "Disparos" },
        { href: "/agendamentos", icon: CalendarClock, label: "Agendamentos" },
        { href: "/votacoes", icon: Vote, label: "Votações" },
        { href: "/lancamento", icon: Rocket, label: "Lançamento" },
        { href: "/funis", icon: Workflow, label: "Funis" },
      ],
    },
    {
      label: "Vendas",
      icon: ShoppingBag,
      items: [
        { href: "/financeiro", icon: Wallet, label: "Financeiro" },
        { href: "/produtos", icon: Box, label: "Produtos e lucro" },
        { href: "/precificacao", icon: Calculator, label: "Precificação" },
        { href: "/estoque", icon: Warehouse, label: "Estoque" },
        { href: "/pedidos", icon: Package, label: "Pedidos" },
        { href: "/custos", icon: Coins, label: "Custos e impostos" },
        { href: "/recuperacao", icon: RefreshCcw, label: "Recuperação" },
        { href: "/modelos", icon: LayoutTemplate, label: "Modelos prontos" },
        { href: "/entregas", icon: Truck, label: "Entregas" },
        { href: "/atendimento", icon: MessageCircle, label: "Atendimento" },
        { href: "/assistente", icon: Bot, label: "Assistente IA" },
        { href: "/pos-venda", icon: HeartHandshake, label: "Pós-venda" },
        { href: "/atletas", icon: Medal, label: "Atletas e influenciadores" },
        { href: "/clube", icon: Crown, label: "Clube de fidelidade" },
        { href: "/indique", icon: Gift, label: "Indique e ganhe" },
      ],
    },
    {
      label: "Clientes",
      icon: Contact,
      items: [
        { href: "/clientes", icon: Contact, label: "CRM" },
        { href: "/calendario", icon: CalendarHeart, label: "Calendário de vendas" },
      ],
    },
    {
      label: "Inteligência",
      icon: Sparkles,
      items: [
        { href: "/conversao", icon: Percent, label: "Conversão" },
        { href: "/origem", icon: Route, label: "Vendas por origem" },
        { href: "/relatorio", icon: ReceiptText, label: "Relatório diário" },
        { href: "/campanhas", icon: ChartNoAxesCombined, label: "Campanhas" },
        { href: "/diagnostico", icon: Sparkles, label: "Diagnóstico com IA" },
      ],
    },
  ];
  const active = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"));
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.label, g.items.some((i) => active(i.href)) || g.label === "Comunidade"])),
  );
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const link = (it: Item, sub = false) => (
    <Link key={it.href} href={it.href} className={`nv${sub ? " sub" : ""}${active(it.href) ? " on" : ""}${it.soon ? " soon" : ""}`}>
      <it.icon size={18} strokeWidth={1.75} className="ic" />
      <span>{it.label}</span>
      {it.badge ? <span className="bdg">{it.badge}</span> : null}
      {it.soon ? <span className="bdg soon">breve</span> : null}
    </Link>
  );

  return (
    <aside className="side">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mark-img" src="/brand/lion.png" alt="" width={36} height={39} />
        <div>
          <b>{store} Hub</b>
          <small>Comunidade e vendas</small>
        </div>
      </div>
      <nav className="nav">
        {pinned.map((it) => link(it))}
        {groups.map((g) => (
          <div className="grp" key={g.label}>
            <button type="button" className="gh" onClick={() => setOpen((o) => ({ ...o, [g.label]: !o[g.label] }))}>
              <g.icon size={18} strokeWidth={1.75} className="ic" />
              <span>{g.label}</span>
              {open[g.label] ? <ChevronDown size={16} className="chev" /> : <ChevronRight size={16} className="chev" />}
            </button>
            {open[g.label] && <div className="gi">{g.items.map((it) => link(it, true))}</div>}
          </div>
        ))}
      </nav>
      <div className="foot">
        {link({ href: "/integracoes", icon: Plug, label: "Integrações" })}
        {link({ href: "/configuracoes", icon: Settings, label: "Configurações" })}
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
