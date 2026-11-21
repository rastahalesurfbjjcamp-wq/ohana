"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { canSee } from "@/lib/access";
import {
  ArrowLeftRight, Bot, Box, CalendarClock, CalendarHeart, ChartNoAxesCombined, ChevronDown, ChevronRight, Contact,
  Gift, HeartHandshake, LayoutDashboard, LogOut, MessageCircle, MessagesSquare, Package, Percent, ReceiptText,
  RefreshCcw, Rocket, Route, UserCog, Send, Settings, ShoppingBag, Sparkles, SquareCheckBig, Truck, UserPlus, Users, Vote,
  Wallet, Warehouse, Workflow, Coins, Plug, LayoutTemplate, Medal, Award, Crown, Calculator, Menu, X, RefreshCw, LayoutGrid, CreditCard, Bell, type LucideIcon,
  History, Library, Megaphone,
} from "lucide-react";

type Item = { href: string; icon: LucideIcon; label: string; badge?: number; soon?: boolean };
type Group = { label: string; icon: LucideIcon; items: Item[] };

export function Sidebar({ name, store, connected, leaves, logout, role = "ADMIN", areas = [], lite = false }: { name: string; store: string; connected: boolean; leaves: number; logout: () => Promise<void>; role?: string; areas?: string[]; lite?: boolean }) {
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
        { href: "/automacoes", icon: Workflow, label: "Automações" },
        { href: "/mensagens", icon: Library, label: "Mensagens" },
        { href: "/campanhas-whatsapp", icon: Megaphone, label: "Campanhas WhatsApp" },
        { href: "/listas", icon: Contact, label: "Listas" },
      ],
    },
    {
      label: "Vendas",
      icon: ShoppingBag,
      items: [
        { href: "/vendas", icon: ShoppingBag, label: "Vendas" },
        { href: "/historico", icon: History, label: "Histórico de vendas" },
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
        { href: "/embaixadores", icon: Award, label: "Embaixadores" },
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
  const ok = (h: string) => canSee(h, role, areas, lite);
  for (const g of groups) g.items = g.items.filter((i) => ok(i.href));
  const active = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"));
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.label, g.items.some((i) => active(i.href)) || g.label === "Comunidade"])),
  );
  const [nav, setNav] = useState(false);
  const [all, setAll] = useState(false);
  useEffect(() => { setAll(false); }, [path]);
  const gi = (l: string) => groups.find((g) => g.label === l)?.items.map((i) => i.href) ?? [];
  const TOP = [
    { label: "Visão geral", href: "/", match: ["/", "/tarefas"] },
    { label: "Comunidade", href: "/entradas", match: gi("Comunidade") },
    { label: "Vendas", href: "/vendas", match: gi("Vendas").filter((h) => h !== "/clube" && h !== "/embaixadores" && h !== "/atletas" && h !== "/indique") },
    { label: "Clientes", href: "/clientes", match: [...gi("Clientes"), "/embaixadores", "/atletas", "/indique"] },
    { label: "Clube", href: "/clube", match: ["/clube"] },
    { label: "Inteligência", href: "/campanhas", match: gi("Inteligência") },
  ];
  const SHORT: Item[] = [
    { href: "/disparos", icon: Send, label: "Disparos" },
    { href: "/leads", icon: UserPlus, label: "Leads" },
    { href: "/pedidos", icon: ShoppingBag, label: "Pedidos" },
    { href: "/agendamentos", icon: CalendarClock, label: "Agendamentos" },
  ];
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => { setNav(false); }, [path]);
  useEffect(() => { document.body.classList.toggle("nav-open", nav); }, [nav]);
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const link = (it: Item, sub = false) => (
    <Link key={it.href} href={it.href} className={`nv${sub ? " sub" : ""}${active(it.href) ? " on" : ""}${it.soon ? " soon" : ""}`}>
      <it.icon size={18} strokeWidth={1.75} className="ic" />
      <span>{it.label}</span>
      {it.badge ? <span className="bdg">{it.badge}</span> : null}
      {it.soon ? <span className="bdg soon">breve</span> : null}
    </Link>
  );

  const tabs: Item[] = [
    { href: "/", icon: LayoutDashboard, label: "Início" },
    { href: "/pedidos", icon: Package, label: "Pedidos" },
    { href: "/entradas", icon: Users, label: "Comunidade" },
    { href: "/clube", icon: Crown, label: "Clube" },
  ];

  return (
    <>
    <header className="tnav">
      <Link href="/" className="tn-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lite ? "/demo/mark.png" : "/brand/lion.png"} alt="" width={30} height={32} />
        <b>{store} Hub</b>
      </Link>
      <div className="tn-allw">
        <button type="button" className={`tn-menu${all ? " on" : ""}`} onClick={() => setAll((v) => !v)} aria-label="Todas as telas"><LayoutGrid size={17} /> Menu</button>
        {all && (
          <>
            <div className="tn-ov" onClick={() => setAll(false)} />
            <div className="tn-all">
              {[{ label: "Início", icon: LayoutDashboard, items: pinned }, ...groups, { label: "Sistema", icon: Settings, items: [{ href: "/integracoes", icon: Plug, label: "Integrações" }, { href: "/equipe", icon: UserCog, label: "Equipe e acessos" }, { href: "/configuracoes", icon: Settings, label: "Configurações" }] }]
                .map((g) => ({ ...g, items: g.items.filter((i) => ok(i.href)) })).filter((g) => g.items.length).map((g) => (
                <div key={g.label}>
                  <h5>{g.label}</h5>
                  {g.items.map((it) => <Link key={it.href} href={it.href} className={active(it.href) ? "on" : ""} onClick={() => setAll(false)}><it.icon size={15} strokeWidth={1.9} />{it.label}{it.badge ? <span>{it.badge}</span> : null}</Link>)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <nav className="tn-pills">
        <span className="tn-h"><CreditCard size={15} /></span>
        {TOP.filter((t) => ok(t.href)).map((t) => {
          const on = t.match.some((h) => active(h));
          return <Link key={t.label} href={t.href} className={on ? "on" : ""}>{t.label}</Link>;
        })}
      </nav>
      <div className="tn-icons">
        {SHORT.filter((t) => ok(t.href)).map((t) => <Link key={t.href} href={t.href} title={t.label} className={active(t.href) ? "on" : ""}><t.icon size={17} /></Link>)}
      </div>
      <div className="nx-sp" />
      <div className="tn-me" title={connected ? "WhatsApp conectado" : "WhatsApp desconectado"}>
        <i className={`live${connected ? "" : " off"}`} />
        {ok("/atendimento") && <Link href="/atendimento" className="tn-ic" title="Atendimento"><Bell size={17} /></Link>}
        {ok("/configuracoes") && <Link href="/configuracoes" className="tn-ic" title="Configurações"><Settings size={17} /></Link>}
        <div className="av" title={name}>{initials}</div>
        <form action={logout}><button type="submit" className="tn-ic" title="Sair"><LogOut size={16} /></button></form>
      </div>
    </header>
    <header className="mtop">
      <button type="button" className="mtop-b" onClick={() => setNav(true)} aria-label="Abrir menu"><Menu size={20} /></button>
      <Link href="/" className="mtop-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lite ? "/demo/mark.png" : "/brand/lion.png"} alt="" width={26} height={28} />
        <b>{store} Hub</b>
      </Link>
      <i className={`live${connected ? "" : " off"}`} title={connected ? "WhatsApp conectado" : "WhatsApp desconectado"} />
      <button type="button" className={`mtop-b${refreshing ? " spin" : ""}`} onClick={() => startRefresh(() => router.refresh())} aria-label="Atualizar"><RefreshCw size={18} /></button>
    </header>
    {nav && <div className="nav-ov" onClick={() => setNav(false)} />}
    <nav className="mtabs" aria-label="Atalhos">
      {tabs.filter((t) => ok(t.href)).map((t) => (
        <Link key={t.href} href={t.href} className={active(t.href) ? "on" : ""}><t.icon size={20} strokeWidth={1.8} /><span>{t.label}</span></Link>
      ))}
      <button type="button" onClick={() => setNav(true)} className={nav ? "on" : ""}><Menu size={20} strokeWidth={1.8} /><span>Menu</span></button>
    </nav>
    <aside className={`side${nav ? " open" : ""}`}>
      <button type="button" className="side-x" onClick={() => setNav(false)} aria-label="Fechar menu"><X size={18} /></button>
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mark-img" src={lite ? "/demo/mark.png" : "/brand/lion.png"} alt="" width={36} height={39} />
        <div>
          <b>{store} Hub</b>
          <small>{lite ? "Comunidade no WhatsApp" : "Comunidade e vendas"}</small>
        </div>
      </div>
      <nav className="nav">
        {pinned.filter((it) => ok(it.href)).map((it) => link(it))}
        {groups.filter((g) => g.items.length).map((g) => (
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
        {ok("/integracoes") && link({ href: "/integracoes", icon: Plug, label: "Integrações" })}
        {ok("/equipe") && link({ href: "/equipe", icon: UserCog, label: "Equipe e acessos" })}
        {ok("/configuracoes") && link({ href: "/configuracoes", icon: Settings, label: "Configurações" })}
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
    </>
  );
}
