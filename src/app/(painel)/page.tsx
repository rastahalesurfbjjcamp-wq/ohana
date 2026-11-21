import { Fragment } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeDollarSign, CalendarClock, ClipboardList, CreditCard, Crown, FileText, Hourglass, LogIn, LogOut, Medal, Megaphone, MessageCircle, MousePointerClick, PackageX, Receipt, RotateCcw, ShoppingBag, ShoppingCart, Target, TrendingUp, Users, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeMetrics, type Metrics } from "@/lib/report";
import { brl, dayRange, isoDayLocal } from "@/lib/time";
import { addDays } from "@/lib/time";
import { AreaChart } from "@/components/charts";
import { AutoRefresh } from "@/components/AutoRefresh";
import { onboardingSteps } from "@/lib/onboarding";
import { DateRange } from "@/components/DateRange";
import { Bars } from "@/components/charts";
import { daysBetween, resolvePeriod } from "@/lib/periods";
import { ordersBetween, products, recentOrders, type Order } from "@/lib/store";
import { beyondOrdersWindow } from "@/lib/shopify";
import { couponSales, salesSeries } from "@/lib/history";
import { ensureTeam, partnerStats } from "@/lib/partners";
import { byGroup, campStats, type CampStat } from "@/lib/meta";
import { getSettings } from "@/lib/settings";
import { saveDashCards } from "./acoes7";
import { Heart } from "lucide-react";
import { CardPicker } from "@/components/CardPicker";
import { metaLabel } from "@/lib/metaLabels";
import { RefreshButton } from "@/components/RefreshButton";
import { Pendencias } from "@/components/Pendencias";
import { Suspense } from "react";
import { LiteHome } from "./LiteHome";
import { NxHead, NxRow2, NxHero, NxStat, NxBars, NxNote, NxTabsCard, NxFilters, NxPill, NxPanel, NxItem, NxEmpty, NxDHead, NxDNum, NxDText, NxWho, NxDCards, NxDFoot, NxBtn, NxQuote } from "@/components/nx";

const CARDS: [string, string][] = [
  ["faturamento", "Faturamento"], ["pedidos", "Pedidos"], ["lucro", "Lucro"],
  ["vendas", "Anúncios de venda (gasto e ROAS)"], ["leads", "Leads dos anúncios (custo por lead)"], ["perfil", "Seguidores (custo por seguidor)"],
  ["gasto", "Gasto total em anúncios"], ["conversao", "Conversão da loja"], ["formulario", "Formulário do Hub"], ["clube", "Clube"],
];

export const dynamic = "force-dynamic";

const RANGES: [string, string, number][] = [["30", "30 dias", 30], ["90", "90 dias", 90], ["ano", "Ano", 365]];
const tz = "America/Sao_Paulo";

function ago(d: Date) {
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

const BLOCKS: [string, string][] = [["numeros", "Cartões de números"], ["resumo", "Faturamento e comunidade"], ["atalhos", "Pagamentos e atalhos"], ["aovivo", "Ao vivo"], ["pendencias", "Pendências e sugestões"], ["atletas", "Atletas, recuperação e atenção"], ["grupos", "Grupos e conversas"], ["envios", "Próximos envios"]];
const DEFAULT_BLOCKS = BLOCKS.map(([k]) => k);

export default async function Home({ searchParams }: { searchParams: Promise<{ r?: string; p?: string; de?: string; ate?: string; v?: string; sel?: string }> }) {
  const sp = await searchParams;
  if (process.env.HUB_LITE === "1") return <LiteHome sp={sp} />;
  const { r } = sp;
  const period = resolvePeriod(sp.p, "hoje", sp.de, sp.ate);
  const pStart = dayRange(period.from).start;
  const pEnd = dayRange(period.to).end;
  const range = RANGES.find((x) => x[0] === r) ?? RANGES[0];
  const today = isoDayLocal();
  const from = addDays(today, -(range[2] - 1));
  // tudo que depende de Shopify e Meta começa junto, sem esperar um pelo outro
  const oldP = beyondOrdersWindow(pStart);
  const settingsP = getSettings();
  const mP = computeMetrics(period.from, period.to).catch(() => null);
  const campsP = campStats(period.from, period.to).catch(() => null);
  const seriesP = oldP ? salesSeries(period.from, period.to, "day").catch(() => []) : Promise.resolve([]);
  const csP = settingsP.then((st) => (st.ads.cards.includes("perfil") && st.ads.perfilCoupons.length ? couponSales(st.ads.perfilCoupons, period.from, period.to).catch(() => null) : null));
  const [session, ob] = await Promise.all([getSession(), onboardingSteps()]);
  const obDone = ob.filter((x) => x.done).length;
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const community = { group: { isCommunity: true } };
  // entradas e saídas: só os grupos escolhidos (comunidade + resultados)
  const chosen = { group: { archived: false, OR: [{ isCommunity: true }, { isResults: true }] } };
  ensureTeam().catch(() => null);
  const safe = <T,>(p: Promise<T>, d: T) => p.catch(() => d);
  const [orders, latest, prods, partners, leadsP, leadsFeed, carts, recovered, waiting, chatFeed, tasksDue] = await Promise.all([
    oldP ? Promise.resolve([] as Order[]) : safe(ordersBetween(pStart, pEnd), [] as Order[]),
    safe(recentOrders(12), [] as Order[]),
    safe(products(), []),
    safe(partnerStats(period.from, period.to), null),
    db.lead.groupBy({ by: ["status"], where: { createdAt: { gte: pStart, lte: pEnd } }, _count: true }),
    db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    db.recoveryCase.findMany({ where: { kind: { in: ["carrinho", "pix"] }, createdAt: { gte: pStart, lte: pEnd } }, select: { kind: true, value: true, status: true } }),
    db.recoveryCase.findMany({ where: { recoveredAt: { gte: pStart, lte: pEnd } }, select: { recoveredValue: true, value: true } }),
    db.chatThread.findMany({ where: { status: "aberto", unread: { gt: 0 } }, orderBy: { lastAt: "desc" }, take: 5 }),
    db.chatMessage.findMany({ where: { fromMe: false }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.task.findMany({ where: { status: { not: "feito" }, dueDate: { lte: dayRange(today).end } }, orderBy: { dueDate: "asc" }, take: 5 }),
  ]);
  const m: Metrics | null = await mP;
  const clubAll = await db.clubMember.findMany({ where: { status: { not: "cancelado" } }, select: { paidUntil: true, joinedAt: true, status: true } }).catch(() => []);
  const clubLate = clubAll.filter((x) => !x.paidUntil || x.paidUntil.getTime() < Date.now()).length;
  const clubNew = clubAll.filter((x) => x.joinedAt >= pStart && x.joinedAt <= pEnd).length;
  const cartFeed = await db.recoveryCase.findMany({ where: { kind: { in: ["carrinho", "pix"] } }, orderBy: { createdAt: "desc" }, take: 8 });
  const [periodEv, liveEv] = await Promise.all([
    db.memberEvent.groupBy({ by: ["type"], where: { createdAt: { gte: pStart, lte: pEnd }, ...chosen }, _count: true }),
    db.memberEvent.findMany({ where: chosen, orderBy: { createdAt: "desc" }, take: 12, include: { contact: true, group: true } }),
  ]);
  const week = new Date(Date.now() - 7 * 864e5);
  const [next, groups, history, sentDays, weekEv] = await Promise.all([
    db.scheduledMessage.findMany({ where: { status: "SCHEDULED" }, orderBy: { sendAt: "asc" }, take: 4 }),
    db.group.findMany({ where: { isCommunity: true, archived: false }, orderBy: { size: "desc" } }),
    db.memberEvent.findMany({ where: { createdAt: { gte: dayRange(from).start }, ...community }, select: { type: true, createdAt: true } }),
    db.scheduledMessage.findMany({ where: { status: "SENT", sendAt: { gte: dayRange(from).start } }, select: { sendAt: true, text: true }, orderBy: { sendAt: "asc" } }),
    db.memberEvent.groupBy({ by: ["groupId", "type"], where: { createdAt: { gte: week }, ...community }, _count: true }),
  ]);
  const members = groups.reduce((s, g) => s + g.size, 0);

  // Reconstrói o total de membros dia a dia, voltando a partir do total de hoje
  const net = new Map<string, number>();
  for (const e of history) {
    const d = isoDayLocal(e.createdAt);
    net.set(d, (net.get(d) ?? 0) + (e.type === "LEAVE" ? -1 : 1));
  }
  const days: string[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) days.push(d);
  const series: { label: string; value: number }[] = [];
  let level = members;
  for (let i = days.length - 1; i >= 0; i--) {
    series.unshift({ label: `${days[i].slice(8)}/${days[i].slice(5, 7)}`, value: level });
    level -= net.get(days[i]) ?? 0;
  }
  const startLevel = series[0]?.value ?? members;
  const growth = members - startLevel;
  const markers: { index: number; label: string }[] = [];
  for (const s of sentDays) {
    const i = days.indexOf(isoDayLocal(s.sendAt));
    if (i >= 0 && !markers.some((mk) => mk.index === i)) markers.push({ index: i, label: s.text.split("\n")[0].slice(0, 22) });
  }

  const weekBy = (gid: string) => {
    const j = weekEv.filter((w) => w.groupId === gid && w.type !== "LEAVE").reduce((s, w) => s + w._count, 0);
    const l = weekEv.filter((w) => w.groupId === gid && w.type === "LEAVE").reduce((s, w) => s + w._count, 0);
    return j - l;
  };
  const full = groups.filter((g) => g.capacity && g.size / g.capacity >= 0.95);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const evInfo: Record<string, { icon: typeof LogIn; tone: string; verb: string }> = {
    JOIN: { icon: LogIn, tone: "t-l", verb: "entrou em" },
    RETURN: { icon: RotateCcw, tone: "t-k", verb: "voltou para" },
    LEAVE: { icon: LogOut, tone: "t-c", verb: "saiu de" },
  };

  /* Diagnóstico do período */
  const isPaid = (o: Order) => o.financial === "PAID" || o.financial === "PARTIALLY_REFUNDED" || o.financial === "PARTIALLY_PAID";
  const open = orders.filter((o) => !o.cancelled && o.financial !== "REFUNDED" && o.financial !== "VOIDED");
  // vendas = só pedidos aprovados (pago). Pix e boleto gerados ficam em "Aguardando pagamento"
  const valid = open.filter(isPaid);
  const lost = orders.filter((o) => o.cancelled || o.financial === "REFUNDED" || o.financial === "VOIDED");
  const kindOf = (o: Order) => { const g = (o.gateway ?? "").toLowerCase(); return g.includes("pix") ? "pix" : g.includes("boleto") ? "boleto" : "cartao"; };
  const pay = (["pix", "cartao", "boleto"] as const).map((k) => {
    const list = open.filter((o) => kindOf(o) === k);
    const paidL = list.filter(isPaid);
    const pend = list.filter((o) => !isPaid(o));
    return { k, label: k === "pix" ? "Pix" : k === "cartao" ? "Cartão" : "Boleto", n: paidL.length, v: paidL.reduce((a, o) => a + o.total, 0), pn: pend.length, pv: pend.reduce((a, o) => a + o.total, 0) };
  }).filter((x) => x.n || x.pn || x.k !== "boleto");
  const paidTotal = pay.reduce((a, x) => a + x.v, 0);
  const pendTotal = pay.reduce((a, x) => a + x.pv, 0);
  const oneDay = period.from === period.to;
  const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
  // período com mais de 60 dias: a Shopify não entrega os pedidos, então vendas vêm do relatório
  const old = oldP;
  const oldSeries = await seriesP;
  const nOrders = old ? m?.orders ?? 0 : valid.length;
  const salesBars = old
    ? oldSeries.map((r) => ({ label: `${r.key.slice(8)}/${r.key.slice(5, 7)}`, value: r.net }))
    : oneDay
    ? Array.from({ length: period.from === today ? hour + 1 : 24 }, (_, h) => ({ label: `${h}h`, value: valid.filter((o) => hourOf(o.createdAt) === h).reduce((a, o) => a + o.subtotal, 0) }))
    : daysBetween(period.from, period.to).map((d) => ({ label: `${d.slice(8)}/${d.slice(5, 7)}`, value: valid.filter((o) => isoDayLocal(new Date(o.createdAt)) === d).reduce((a, o) => a + o.subtotal, 0) }));
  const leadsN = leadsP.reduce((a, x) => a + x._count, 0);
  const pc = (t: string) => periodEv.find((e) => e.type === t)?._count ?? 0;
  const cartN = carts.filter((c) => c.kind === "carrinho").length;
  const cartV = carts.filter((c) => c.kind === "carrinho").reduce((a, c) => a + c.value, 0);
  const pixN = carts.filter((c) => c.kind === "pix" && c.status === "ativo").length;
  const recV = recovered.reduce((a, c) => a + (c.recoveredValue ?? c.value), 0);
  const sessions = m?.conversion?.sessions ?? null;
  const settings = await settingsP;
  const camps: CampStat[] | null = await campsP;
  const g = camps ? byGroup(camps) : null;
  const salesSpend = g ? g.vendas.spend : m?.ads ?? null;
  const roas = salesSpend && m ? m.net / salesSpend : null;
  const perfilCs = await csP;
  // sem métrica de seguidor escolhida e sem seguidor vindo do Meta, mostra visitas ao perfil
  const fm = settings.ads.followMetric;
  const pVal = g ? (g.perfil.follows || (fm ? 0 : g.perfil.visits)) : 0;
  const pLabel = fm ? (metaLabel(fm).startsWith("Seguidores") ? "Seguidores" : metaLabel(fm)) : g && !g.perfil.follows && g.perfil.visits ? "Visitas no perfil" : "Seguidores";
  const per = (a: number, b: number) => (b ? brl(a / b) : "–");
  const n0 = (v: number) => v.toLocaleString("pt-BR");
  const cardOn = settings.ads.cards;
  const blockOrder = (settings.ads.blocks?.length ? settings.ads.blocks : DEFAULT_BLOCKS).filter((k) => BLOCKS.some(([b]) => b === k));
  const ks: Record<string, React.ReactNode> = {
    faturamento: <Link key="faturamento" href="/historico" className="ks hl"><small><Wallet size={14} /> Faturamento</small><b>{m ? brl(m.net, 0) : "–"}</b><span>{period.label.toLowerCase()}</span></Link>,
    pedidos: <Link key="pedidos" href="/pedidos" className="ks"><small><Receipt size={14} /> Pedidos</small><b>{nOrders}</b><span>ticket {old ? (m?.orders ? brl(m.aov, 0) : "–") : valid.length ? brl(valid.reduce((a, o) => a + o.subtotal, 0) / valid.length, 0) : "–"}</span></Link>,
    lucro: <Link key="lucro" href="/financeiro" className="ks"><small><TrendingUp size={14} /> Lucro</small><b className={m && m.profitBeforeFixed < 0 ? "dn" : "up"}>{m ? brl(m.profitBeforeFixed, 0) : "–"}</b><span>antes dos custos fixos</span></Link>,
    vendas: <Link key="vendas" href="/campanhas" className="ks"><small><Target size={14} /> Anúncios de venda</small><b>{salesSpend != null ? brl(salesSpend, 0) : "–"}</b><span>{roas ? `ROAS ${roas.toFixed(2).replace(".", ",")}` : "sem gasto lido"}{g && g.vendas.purchases ? ` · Meta: ${n0(g.vendas.purchases)} compras` : ""}</span></Link>,
    leads: <Link key="leads" href="/campanhas" className="ks"><small><FileText size={14} /> Leads dos anúncios</small><b>{g ? n0(g.leads.leads) : "–"}</b><span>{g ? (g.leads.spend || g.leads.leads ? `${per(g.leads.spend, g.leads.leads)} por lead · gasto ${brl(g.leads.spend, 0)}` : "nenhuma campanha de lead") : "conecte o Meta Ads"}</span></Link>,
    perfil: <Link key="perfil" href="/campanhas" className="ks"><small><Heart size={14} /> {pLabel}</small><b>{g ? n0(pVal) : "–"}</b><span>{g ? (g.perfil.spend ? `${per(g.perfil.spend, pVal)} cada · gasto ${brl(g.perfil.spend, 0)}` : "nenhuma campanha de perfil") : "conecte o Meta Ads"}{perfilCs?.orders ? ` · cupom ${brl(perfilCs.net, 0)} em ${perfilCs.orders} venda(s)` : ""}</span></Link>,
    gasto: <Link key="gasto" href="/campanhas" className="ks"><small><Megaphone size={14} /> Gasto em anúncios</small><b>{g ? brl(g.total.spend, 0) : m?.ads != null ? brl(m.ads, 0) : "–"}</b><span>{g ? `${g.total.campaigns} campanha(s) com gasto` : "todas as contas"}</span></Link>,
    conversao: <Link key="conversao" href="/conversao" className="ks"><small><MousePointerClick size={14} /> Conversão</small><b>{m?.conversion ? `${(m.conversion.rate * 100).toFixed(2).replace(".", ",")}%` : "–"}</b><span>{m?.conversion?.sessions != null ? `${m.conversion.sessions.toLocaleString("pt-BR")} visitas` : "visitas na loja"}</span></Link>,
    formulario: <Link key="formulario" href="/leads" className="ks"><small><FileText size={14} /> Formulário</small><b>{leadsP.reduce((a, x) => a + x._count, 0)}</b><span>{leadsP.filter((x) => x.status === "no_grupo" || x.status === "cliente").reduce((a, x) => a + x._count, 0)} já no grupo ou clientes</span></Link>,
    clube: <Link key="clube" href="/clube" className="ks"><small><Crown size={14} /> Clube</small><b>{clubAll.length}</b><span>{clubNew} novo(s) · {clubLate} atrasado(s)</span></Link>,
  };
  const shown = CARDS.map(([k]) => k).filter((k) => cardOn.includes(k));
  const sold = new Map<string, number>();
  for (const o of valid) for (const l of o.lines) sold.set(l.title, (sold.get(l.title) ?? 0) + l.quantity);
  const zeroed = prods.filter((p) => p.status === "ACTIVE" && p.totalInventory <= 0).sort((a, b) => (sold.get(b.title) ?? 0) - (sold.get(a.title) ?? 0));
  const lowVar = prods.filter((p) => p.status === "ACTIVE" && !p.bundle && p.published !== false).flatMap((p) => p.variants.filter((v) => v.stock > 0 && v.stock <= 2).map((v) => ({ p: p.title, v: v.title, n: v.stock })));
  const team = (partners?.rows ?? []).filter((r) => r.active);
  const teamRev = team.reduce((a, r) => a + r.revenue, 0);
  const teamCom = team.reduce((a, r) => a + r.commission, 0);
  const plab = period.label.toLowerCase();

  type Live = { at: Date; icon: typeof LogIn; tone: string; t: string; s: string; href: string; v?: string; who?: string; st?: string; ok?: boolean; order?: Order; kind?: string };
  const live: Live[] = [
    ...latest.map((o) => ({ at: new Date(o.createdAt), icon: o.cancelled ? PackageX : isPaid(o) ? ShoppingBag : Hourglass, tone: o.cancelled ? "t-c" : isPaid(o) ? "t-l" : "t-s", t: `Pedido ${o.name}${o.cancelled ? " cancelado" : isPaid(o) ? " pago" : " aguardando pagamento"}`, s: `${o.customer || "Cliente"} · ${kindOf(o) === "pix" ? "Pix" : kindOf(o) === "boleto" ? "Boleto" : "Cartão"}${o.codes[0] ? ` · cupom ${o.codes[0]}` : ""}`, href: "/pedidos", v: brl(o.total, 0), who: o.customer || "Cliente", st: o.cancelled ? "Cancelado" : isPaid(o) ? "Pago" : "Aguardando", ok: !o.cancelled && isPaid(o), order: o, kind: "pedido" })),
    ...leadsFeed.map((l) => ({ at: l.createdAt, icon: FileText, tone: "t-p", t: `${l.name || "Alguém"} preencheu o formulário`, s: `virou lead · ${l.source}${l.utmSource ? ` · ${l.utmSource}` : ""}`, href: "/leads", who: l.name || "Lead", st: "Lead", kind: "lead" })),
    ...liveEv.map((e) => { const info = evInfo[e.type] ?? evInfo.JOIN; return { at: e.createdAt, icon: info.icon, tone: info.tone, t: e.contact.name || `+${e.contact.phone}`, s: `${info.verb} ${e.group.name}`, href: "/entradas", who: e.contact.name || e.contact.phone, st: e.type === "LEAVE" ? "Saiu" : e.type === "RETURN" ? "Voltou" : "Entrou", ok: e.type !== "LEAVE", kind: "grupo" }; }),
    ...cartFeed.map((c) => ({ at: c.recoveredAt ?? c.createdAt, icon: c.recoveredAt ? BadgeDollarSign : ShoppingCart, tone: c.recoveredAt ? "t-l" : "t-s", t: c.recoveredAt ? `Venda recuperada de ${c.name || "cliente"}` : c.kind === "pix" ? `Pix gerado e não pago: ${c.name || "cliente"}` : `Carrinho abandonado: ${c.name || "cliente"}`, s: c.product ?? "", href: "/recuperacao", v: brl(c.recoveredValue ?? c.value, 0), who: c.name || "Cliente", st: c.recoveredAt ? "Recuperada" : c.kind === "pix" ? "Pix gerado" : "Carrinho", ok: !!c.recoveredAt, kind: "carrinho" })),
    ...chatFeed.map((c) => ({ at: c.createdAt, icon: MessageCircle, tone: "t-k", t: "Mensagem no atendimento", s: c.text.slice(0, 70), href: `/atendimento?tel=${c.phone}`, who: c.phone, st: "Responder", kind: "chat" })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 16);

  const B: Record<string, React.ReactNode> = {
    resumo: (<>
      <NxRow2>
        <NxHero stats={<>
          <NxStat label={`Faturamento · ${plab}`} pre="R$" value={m ? Math.round(m.net).toLocaleString("pt-BR") : "–"} sub={m ? `${nOrders} pedido(s) pagos` : "sem dados da loja"} />
          <NxStat label="Pedidos pagos" value={nOrders.toLocaleString("pt-BR")} sub={`ticket ${old ? (m?.orders ? brl(m.aov, 0) : "–") : valid.length ? brl(valid.reduce((a, o) => a + o.subtotal, 0) / valid.length, 0) : "–"}`} tone="up" />
          <NxStat label="Lucro" pre="R$" value={m ? Math.round(m.profitBeforeFixed).toLocaleString("pt-BR") : "–"} sub="antes dos custos fixos" tone={m && m.profitBeforeFixed < 0 ? "dn" : "mut"} />
        </>}>
          {nOrders ? <NxBars items={salesBars} fmt={(v) => brl(v, 0)} /> : <NxNote>Nenhuma venda {oneDay && period.from === today ? "hoje ainda" : "no período"}.</NxNote>}
        </NxHero>
        <NxTabsCard title={`Comunidade · ${plab}`} value={`${pc("JOIN") + pc("RETURN") - pc("LEAVE") >= 0 ? "+" : ""}${(pc("JOIN") + pc("RETURN") - pc("LEAVE")).toLocaleString("pt-BR")}`} chip={`${members.toLocaleString("pt-BR")} pessoas`}
          tabs={[{ top: pc("JOIN"), label: "Entraram", href: "/entradas" }, { top: pc("LEAVE"), label: "Saíram", href: "/entradas?t=LEAVE", on: true }, { top: pc("RETURN"), label: "Voltaram", href: "/entradas" }]}
          button={{ label: "Ver comunidade", href: "/entradas" }} />
      </NxRow2>

</>),
    atalhos: (<>
      <NxFilters>
        <NxPill href="/pedidos">Pagamentos: {pay.map((x) => `${x.label} ${brl(x.v, 0)}`).join(" · ") || "–"}</NxPill>
        <NxPill href="/pedidos">Aguardando {brl(pendTotal, 0)}</NxPill>
        <NxPill href="/recuperacao">Recuperado {brl(recV, 0)}</NxPill>
        <NxPill href="/atendimento" on={waiting.length > 0}>{waiting.length} esperando resposta</NxPill>
      </NxFilters>

</>),
    aovivo: (<>
      {(() => {
        const fil = sp.v ?? "tudo";
        const list = live.filter((x) => fil === "tudo" || (fil === "pedidos" ? x.kind === "pedido" : x.kind !== "pedido" && x.kind !== "lead"));
        const selI = Math.min(Math.max(0, Number(sp.sel ?? 0) || 0), Math.max(0, list.length - 1));
        const cur = list[selI];
        const qs = (k: Record<string, string>) => { const u = new URLSearchParams(); if (sp.p) u.set("p", sp.p); if (sp.de) u.set("de", sp.de); if (sp.ate) u.set("ate", sp.ate); for (const [a, b] of Object.entries(k)) if (b) u.set(a, b); const t = u.toString(); return t ? `/?${t}` : "/"; };
        const o = cur?.order;
        return (
          <NxPanel title="Ao vivo"
            tabs={[
              { label: "Tudo", href: qs({}), on: fil === "tudo" },
              { label: "Pedidos", count: live.filter((x) => x.kind === "pedido").length, href: qs({ v: "pedidos" }), on: fil === "pedidos" },
              { label: "Comunidade e atendimento", count: live.filter((x) => x.kind !== "pedido" && x.kind !== "lead").length, href: qs({ v: "outros" }), on: fil === "outros" },
            ]}
            list={list.length ? list.slice(0, 8).map((x, i) => (
              <NxItem key={i} href={qs({ v: fil === "tudo" ? "" : fil, sel: String(i) })} name={x.who ?? x.t} title={x.t} sub={`${x.s ? `${x.s} · ` : ""}${ago(x.at)}`} status={x.st} ok={x.ok} value={x.v} on={i === selI} />
            )) : <NxEmpty>Nada aconteceu ainda.</NxEmpty>}
            detail={!cur ? <NxEmpty>Escolha um item da lista.</NxEmpty> : o ? (<>
              <NxDHead cols={[
                { label: "Pedido", node: <NxDNum chip={cur.st}>{o.name}</NxDNum> },
                { label: "Pagamento", node: <NxDText>{kindOf(o) === "pix" ? "Pix" : kindOf(o) === "boleto" ? "Boleto" : "Cartão"}{o.codes[0] ? ` · cupom ${o.codes[0]}` : ""}</NxDText> },
                { label: "Cliente", node: <NxWho name={o.customer || "Cliente"} sub={[o.city, o.state].filter(Boolean).join(" · ") || o.phone || ""} /> },
              ]} />
              <NxDCards items={o.lines.slice(0, 4).map((l) => ({ v: brl(l.revenue, 2), d: `${l.quantity > 1 ? `${l.quantity}x ` : ""}${l.title}${l.variant ? ` · ${l.variant}` : ""}` }))} />
              <NxDFoot vals={[{ l: "Subtotal", v: brl(o.subtotal, 2) }, { l: "Frete", v: brl(Math.max(0, o.total - o.subtotal), 2) }, { l: "Total", v: brl(o.total, 2) }]}>
                {o.phone && <NxBtn href={`https://wa.me/${o.phone.replace(/\D/g, "")}`} target="_blank"><MessageCircle size={16} /></NxBtn>}
                <NxBtn href="/pedidos" lime>Abrir pedido</NxBtn>
              </NxDFoot>
            </>) : (<>
              <NxDHead cols={[
                { label: "O que aconteceu", node: <NxDNum chip={cur.st}>{null}</NxDNum> },
                { label: "Quando", node: <NxDText>{ago(cur.at)}</NxDText> },
                { label: "Quem", node: <NxWho name={cur.who ?? cur.t} /> },
              ]} />
              <NxQuote>{cur.t}{cur.s ? `\n${cur.s}` : ""}</NxQuote>
              <NxDFoot vals={cur.v ? [{ l: "Valor", v: cur.v }] : []}><NxBtn href={cur.href} lime>Abrir</NxBtn></NxDFoot>
            </>)} />
        );
      })()}

</>),
    pendencias: (<>
      <Suspense fallback={null}><Pendencias /></Suspense>
</>),
    numeros: (<>
      <div className="kstrip dyn" style={{ marginTop: 8, ["--kc" as string]: Math.min(shown.length, 7) }}>
        {shown.map((k) => ks[k])}
      </div>

</>),
    atletas: (<>
      <div className="cols c-1-1-1">
        <section className="pnl" style={{ padding: 22 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Atletas e influenciadores</h3>
            <Link className="btn sm ghost" href={`/atletas${sp.p ? `?p=${sp.p}${sp.de ? `&de=${sp.de}&ate=${sp.ate}` : ""}` : "?p=hoje"}`}>Relatório <ArrowRight size={14} /></Link>
          </div>
          <div className="row" style={{ gap: 18, margin: "6px 0 4px" }}>
            <div><div className="dim" style={{ fontSize: 12 }}>Vendas pelos cupons</div><b className="mid-num" style={{ fontSize: 22 }}>{brl(teamRev, 0)}</b></div>
            <div><div className="dim" style={{ fontSize: 12 }}>Comissão a pagar</div><b className="mid-num" style={{ fontSize: 22, color: "var(--sun)" }}>{brl(teamCom, 0)}</b></div>
          </div>
          {team.length ? team.slice(0, 5).map((r) => (
            <div className="lrow" key={r.id}>
              <span className="tile sm t-s"><Medal size={15} /></span>
              <div style={{ minWidth: 0, flex: 1 }}><div className="t" style={{ fontSize: 13.5 }}>{r.name}</div><div className="s">{r.code} · {r.orders} pedido(s)</div></div>
              <span className="end"><b style={{ fontSize: 13.5, display: "block" }}>{brl(r.revenue, 0)}</b><span style={{ fontSize: 12, color: "var(--sun)" }}>{brl(r.commission, 0)}</span></span>
            </div>
          )) : <div className="empty">Nenhum atleta cadastrado.</div>}
        </section>

        <section className="pnl" style={{ padding: 22 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Recuperação e atendimento</h3>
            <Link className="btn sm ghost" href="/recuperacao">Abrir <ArrowRight size={14} /></Link>
          </div>
          <div className="lrow"><span className="tile sm t-s"><ShoppingCart size={15} /></span><div><div className="t">Carrinhos abandonados</div><div className="s">{cartN} no período</div></div><div className="end mid-num" style={{ fontSize: 20 }}>{brl(cartV, 0)}</div></div>
          <div className="lrow"><span className="tile sm t-s"><Hourglass size={15} /></span><div><div className="t">Pix sem pagar</div><div className="s">ainda em recuperação</div></div><div className="end mid-num" style={{ fontSize: 20 }}>{pixN}</div></div>
          <div className="lrow"><span className="tile sm t-l"><BadgeDollarSign size={15} /></span><div><div className="t">Recuperado</div><div className="s">{recovered.length} venda(s)</div></div><div className="end mid-num up" style={{ fontSize: 20 }}>{brl(recV, 0)}</div></div>
          <Link href="/atendimento" className="lrow" style={{ color: "inherit" }}><span className="tile sm t-k"><MessageCircle size={15} /></span><div style={{ minWidth: 0, flex: 1 }}><div className="t">Esperando resposta</div><div className="s" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{waiting[0] ? `${waiting[0].name || `+${waiting[0].phone}`}: ${waiting[0].lastText ?? ""}` : "ninguém esperando"}</div></div><div className="end mid-num" style={{ fontSize: 20, color: waiting.length ? "var(--sun)" : undefined }}>{waiting.length}</div></Link>
        </section>

        <section className="pnl" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Precisa de atenção</h3>
          {zeroed.length > 0 && <Link href="/estoque" className="lrow" style={{ color: "inherit" }}><span className="tile sm t-c"><PackageX size={15} /></span><div style={{ minWidth: 0, flex: 1 }}><div className="t" style={{ fontSize: 13.5 }}>{zeroed.length} produto(s) ativos sem estoque</div><div className="s" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{zeroed.slice(0, 2).map((p) => p.title).join(", ")}</div></div></Link>}
          {lowVar.length > 0 && <Link href="/estoque" className="lrow" style={{ color: "inherit" }}><span className="tile sm t-s"><AlertTriangle size={15} /></span><div style={{ minWidth: 0, flex: 1 }}><div className="t" style={{ fontSize: 13.5 }}>{lowVar.length} tamanho(s) acabando</div><div className="s" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lowVar.slice(0, 2).map((x) => `${x.p} ${x.v} (${x.n})`).join(", ")}</div></div></Link>}
          {tasksDue.length > 0 && <Link href="/tarefas" className="lrow" style={{ color: "inherit" }}><span className="tile sm t-p"><ClipboardList size={15} /></span><div style={{ minWidth: 0, flex: 1 }}><div className="t" style={{ fontSize: 13.5 }}>{tasksDue.length} tarefa(s) para hoje ou atrasadas</div><div className="s" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tasksDue[0].title}</div></div></Link>}
          {m && m.missingCost.length > 0 && <Link href={`/produtos?semcusto=1&${period.key === "custom" ? `p=custom&de=${period.from}&ate=${period.to}` : `p=${period.key}`}`} className="lrow" style={{ color: "inherit" }}><span className="tile sm t-s"><Wallet size={15} /></span><div style={{ minWidth: 0, flex: 1 }}><div className="t" style={{ fontSize: 13.5 }}>{m.missingCost.length} produto(s) vendidos sem custo</div><div className="s">o lucro fica maior do que é</div></div></Link>}
          {clubAll.length > 0 && <Link href="/clube?f=atraso" className="lrow" style={{ color: "inherit" }}><span className="tile sm t-s"><Crown size={15} /></span><div><div className="t" style={{ fontSize: 13.5 }}>Clube: {clubAll.length - clubLate} em dia{clubNew ? `, ${clubNew} novo(s)` : ""}</div><div className="s">{clubLate ? `${clubLate} com mensalidade vencida` : "ninguém atrasado"}</div></div></Link>}
          {full.length > 0 && <Link href="/grupos" className="lrow" style={{ color: "inherit" }}><span className="tile sm t-c"><Users size={15} /></span><div><div className="t" style={{ fontSize: 13.5 }}>{full.length} grupo(s) cheio(s)</div><div className="s">o convite já manda para um com vaga</div></div></Link>}
          {!clubAll.length && !zeroed.length && !lowVar.length && !tasksDue.length && !(m && m.missingCost.length) && !full.length && <div className="empty">Tudo em ordem.</div>}
        </section>
      </div>

</>),
    grupos: (<>
</>),
    envios: (<>
      <div className="cols c-2-1">
        <section className="pnl" style={{ padding: 26 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="row" style={{ gap: 10 }}>
                <span className="tile sm t-l"><Users size={17} /></span>
                <span className="mut">Pessoas na comunidade</span>
              </div>
              <div className="row" style={{ alignItems: "baseline", gap: 14, marginTop: 14 }}>
                <span className="hero-num">{members.toLocaleString("pt-BR")}</span>
                <span className={`delta ${growth >= 0 ? "up" : "dn"}`}>{growth >= 0 ? "+" : ""}{growth.toLocaleString("pt-BR")} em {range[1].toLowerCase()}</span>
              </div>
            </div>
            <div className="seg">
              {RANGES.map(([k, l]) => <Link key={k} href={k === "30" ? "/" : `/?r=${k}`} className={range[0] === k ? "on" : ""}>{l}</Link>)}
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            {groups.length ? (
              <AreaChart id="mem" data={series} markers={markers} height={230} format={(v) => v.toLocaleString("pt-BR")} />
            ) : (
              <div className="empty">Marque os grupos da comunidade em Grupos para ver a evolução aqui.</div>
            )}
          </div>
          {markers.length > 0 && <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Marcas amarelas: dias com mensagem enviada aos grupos</div>}
        </section>

        <section className="pnl" style={{ padding: 22 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Grupos</h3>
            <Link className="btn sm ghost" href="/grupos">Ver todos <ArrowRight size={14} /></Link>
          </div>
          {full.length > 0 && (
            <div className="callout coral" style={{ margin: "8px 0" }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <div>{full.length === 1 ? `${full[0].name} está cheio.` : `${full.length} grupos estão cheios.`} O link de convite já manda as pessoas para um grupo com vaga.</div>
            </div>
          )}
          {groups.length ? groups.slice(0, 6).map((g) => {
            const w = weekBy(g.id);
            const ratio = g.capacity ? g.size / g.capacity : 0;
            return (
              <div className="lrow" key={g.id} style={{ display: "block" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="t" style={{ fontSize: 13.5 }}>{g.name}</span>
                  <span className="row" style={{ gap: 10 }}>
                    <span className={`delta ${w >= 0 ? "up" : "dn"}`}>{w >= 0 ? "+" : ""}{w} 7d</span>
                    <span className="dim" style={{ fontSize: 12 }}>{g.size}/{g.capacity}</span>
                  </span>
                </div>
                <div className="hbar" style={{ marginTop: 8 }}><i className={ratio >= 0.95 ? "c" : ratio >= 0.8 ? "s" : ""} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
              </div>
            );
          }) : <div className="empty">Nenhum grupo marcado.</div>}
        </section>

      </div>

      <div className="cols c-2-1">
        <section className="pnl" style={{ padding: 22, gridColumn: "1 / -1" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Próximos envios</h3>
            <Link className="btn sm ghost" href="/agendamentos">Agenda <ArrowRight size={14} /></Link>
          </div>
          {next.length ? next.map((s) => (
            <div className="lrow" key={s.id}>
              <span className="tile sm t-s"><CalendarClock size={15} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="t" style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.text.split("\n")[0]}</div>
                <div className="s" style={{ textTransform: "capitalize" }}>{fmt.format(s.sendAt)} · {s.groupJids.length} grupo(s)</div>
              </div>
            </div>
          )) : (
            <div className="empty-art" style={{ padding: "24px 0" }}>
              <p className="mut" style={{ marginBottom: 12 }}>Nada agendado.</p>
              <Link className="btn pri sm" href="/agendamentos">Agendar mensagem</Link>
            </div>
          )}
        </section>
      </div>
</>),
  };
  return (
    <>
      <AutoRefresh seconds={45} />
      <NxHead title={<>{hello}, {session?.name.split(" ")[0]}</>}>
        <DateRange current={period.key} from={period.from} to={period.to} label={period.label} presets={["hoje", "ontem", "7d", "30d", "60d", "mes", "mes-passado", "6m", "ano"]} />
        <RefreshButton bar />
        <CardPicker cards={CARDS} on={cardOn} blocks={BLOCKS} blocksOn={blockOrder} action={saveDashCards} />
        <Link className="btn" href="/agendamentos"><CalendarClock size={16} /> Agendar</Link>
        <Link className="btn pri" href="/disparos"><Megaphone size={16} /> Novo disparo</Link>
      </NxHead>
      {obDone < ob.length && process.env.DEMO_MODE !== "1" && (
        <Link href="/comecar" className="callout lagoon" style={{ alignItems: "center" }}>
          <b>Falta pouco para a loja ficar pronta: {obDone} de {ob.length} passos.</b>
          <span className="dim">Próximo: {ob.find((x) => !x.done)?.title}</span>
          <span className="act">Continuar <ArrowRight size={14} /></span>
        </Link>
      )}
      {blockOrder.map((k) => <Fragment key={k}>{B[k]}</Fragment>)}
    </>
  );
}
