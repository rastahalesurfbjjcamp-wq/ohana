// O que precisa de atenção agora, do mais urgente para o menos, e sugestões do que ainda falta montar.
import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleAlert, Info, Lightbulb } from "lucide-react";
import { db } from "@/lib/db";
import { evolution } from "@/lib/evolution";
import { recentOrders, type Order } from "@/lib/store";
import { isoDayLocal, addDays } from "@/lib/time";
import { FLOW_TEMPLATES } from "@/lib/flowTemplates";

type Item = { sev: 1 | 2 | 3; title: string; sub?: string; href: string; cta: string };

const isBoleto = (o: Order) => (o.gateway ?? "").toLowerCase().includes("boleto");
const dueOf = (o: Order) => isoDayLocal(new Date(new Date(o.createdAt).getTime() + 3 * 864e5));

export async function Pendencias() {
  const today = isoDayLocal();
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [wa, waiting, errs, camps, orders, autos, popups] = await Promise.all([
    process.env.DEMO_MODE === "1" ? Promise.resolve("open") : evolution.connectionState().catch(() => "error"),
    db.chatThread.count({ where: { status: "aberto", unread: { gt: 0 } } }).catch(() => 0),
    db.automationRun.groupBy({ by: ["automationId"], where: { status: "erro", OR: [{ lastSentAt: { gte: weekAgo } }, { nextAt: { gte: weekAgo } }] }, _count: true }).catch(() => []),
    db.automation.findMany({ where: { trigger: "manual" }, select: { id: true, name: true, config: true } }).catch(() => []),
    recentOrders(150).catch(() => [] as Order[]),
    db.automation.findMany({ select: { id: true, name: true, trigger: true, active: true } }).catch(() => []),
    db.popup.count({ where: { active: true } }).catch(() => 0),
  ]);
  const items: Item[] = [];
  if (wa !== "open") items.push({ sev: 1, title: "WhatsApp desconectado", sub: "Automações, campanhas e respostas ficam paradas até reconectar.", href: "/configuracoes", cta: "Reconectar" });
  const errAutos = errs.filter((e) => e._count > 0);
  if (errAutos.length) {
    const names = new Map(autos.map((a) => [a.id, a.name]));
    const total = errAutos.reduce((s, e) => s + e._count, 0);
    items.push({ sev: 1, title: `${total} ${total === 1 ? "envio falhou" : "envios falharam"} nas automações`, sub: errAutos.slice(0, 3).map((e) => names.get(e.automationId) ?? "Automação").join(", "), href: `/automacoes/${errAutos[0].automationId}/relatorio`, cta: "Ver" });
  }
  const lateTrack = orders.filter((o) => !o.cancelled && o.financial === "PAID" && !o.tracking && Date.now() - Date.parse(o.createdAt) > 2 * 864e5);
  if (lateTrack.length) items.push({ sev: 2, title: `${lateTrack.length} ${lateTrack.length === 1 ? "pedido pago" : "pedidos pagos"} sem rastreio há mais de 2 dias`, sub: lateTrack.slice(0, 4).map((o) => o.name).join(", "), href: "/pedidos?at=sem_rastreio", cta: "Ver pedidos" });
  if (waiting) items.push({ sev: 2, title: `${waiting} ${waiting === 1 ? "conversa esperando" : "conversas esperando"} resposta`, href: "/atendimento", cta: "Responder" });
  const boleto = orders.filter((o) => !o.cancelled && o.financial === "PENDING" && isBoleto(o) && (dueOf(o) === today || dueOf(o) === addDays(today, 1)));
  if (boleto.length) items.push({ sev: 3, title: `${boleto.length} ${boleto.length === 1 ? "boleto vence" : "boletos vencem"} hoje ou amanhã`, href: "/pedidos?at=boleto_hoje", cta: "Ver" });
  const pix = orders.filter((o) => !o.cancelled && o.financial === "PENDING" && (o.gateway ?? "").toLowerCase().includes("pix") && Date.now() - Date.parse(o.createdAt) < 2 * 864e5);
  if (pix.length) items.push({ sev: 3, title: `${pix.length} ${pix.length === 1 ? "Pix pendente" : "Pix pendentes"} nas últimas 48h`, href: "/pedidos?at=pix_pendente", cta: "Ver" });
  const campToday = camps.filter((c) => { const cfg = (c.config ?? {}) as { campaign?: boolean; state?: string; at?: string }; return cfg.campaign && (cfg.state === "agendada" || cfg.state === "enviando") && (cfg.at ?? "").slice(0, 10) === today; });
  for (const c of campToday.slice(0, 2)) { const cfg = c.config as { state?: string; at?: string }; items.push({ sev: 3, title: `Campanha ${cfg.state === "enviando" ? "enviando agora" : `hoje às ${(cfg.at ?? "").slice(11, 16)}`}: ${c.name}`, href: `/campanhas-whatsapp/${c.id}`, cta: "Abrir" }); }
  items.sort((a, b) => a.sev - b.sev);

  const has = new Set(autos.map((a) => a.trigger));
  const recs: Item[] = FLOW_TEMPLATES.filter((t) => !has.has(t.trigger)).slice(0, 3).map((t) => ({ sev: 3, title: t.name, sub: "Ainda não tem automação para isso", href: `/automacoes?novo=1&cat=${encodeURIComponent(t.cat)}`, cta: "Criar" }));
  if (!popups) recs.push({ sev: 3, title: "Popup no site", sub: "Capture o WhatsApp de quem visita a loja", href: "/popups", cta: "Criar" });
  const off = autos.filter((a) => !a.active && a.trigger !== "manual");
  if (off.length && recs.length < 4) recs.push({ sev: 3, title: `${off.length} ${off.length === 1 ? "automação desligada" : "automações desligadas"}`, sub: "Revise e ligue quando estiver tudo certo", href: "/automacoes", cta: "Ver" });

  if (!items.length && !recs.length) return null;
  const Icon = { 1: CircleAlert, 2: AlertTriangle, 3: Info };
  return (
    <div className="pd">
      <section className="pnl pd-col">
        <div className="pd-h"><b>Precisa de atenção</b><small>{items.length ? `${items.length} ${items.length === 1 ? "item" : "itens"}` : "Tudo em dia"}</small></div>
        {items.length ? items.slice(0, 6).map((it, i) => { const I = Icon[it.sev]; return (
          <Link key={i} href={it.href} className={`pd-it s${it.sev}`}>
            <I size={16} />
            <span className="pd-t"><b>{it.title}</b>{it.sub && <small>{it.sub}</small>}</span>
            <span className="pd-cta">{it.cta} <ArrowRight size={13} /></span>
          </Link>
        ); }) : <div className="pd-ok">Nada pendente agora.</div>}
      </section>
      {recs.length > 0 && (
        <section className="pnl pd-col">
          <div className="pd-h"><b>Sugestões</b><small>o que ainda dá para montar</small></div>
          {recs.slice(0, 4).map((it, i) => (
            <Link key={i} href={it.href} className="pd-it s4">
              <Lightbulb size={16} />
              <span className="pd-t"><b>{it.title}</b>{it.sub && <small>{it.sub}</small>}</span>
              <span className="pd-cta">{it.cta} <ArrowRight size={13} /></span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
