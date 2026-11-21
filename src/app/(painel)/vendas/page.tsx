import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { ordersBetween, type Order } from "@/lib/store";
import { computeMetrics } from "@/lib/report";
import { addDays, brl, dayRange, isoDayLocal } from "@/lib/time";
import { formatPhone } from "@/lib/phone";
import { ErrorNote } from "@/components/ui";
import { NxHead, NxRow2, NxHero, NxStat, NxTracks, NxTrack, NxAvs, NxNote, NxTabsCard, NxFilters, NxPill, NxPanel, NxItem, NxEmpty, NxDHead, NxDNum, NxDText, NxWho, NxDCards, NxDFoot, NxBtn } from "@/components/nx";

export const dynamic = "force-dynamic";

const isPaid = (o: Order) => !o.cancelled && (o.financial === "PAID" || o.financial === "PARTIALLY_REFUNDED" || o.financial === "PARTIALLY_PAID");
const kindOf = (o: Order) => { const g = (o.gateway ?? "").toLowerCase(); return g.includes("pix") ? "pix" : g.includes("boleto") ? "boleto" : "cartao"; };
const KL: Record<string, string> = { pix: "Pix", cartao: "Cartão", boleto: "Boleto" };
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  if (s < 2 * 86400) return "ontem";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso));
}
function statusOf(o: Order) {
  if (o.cancelled) return "Cancelado";
  if (isPaid(o)) return o.shipStatus === "DELIVERED" ? "Entregue" : o.tracking ? "Enviado" : "Pago";
  const k = kindOf(o);
  return k === "pix" ? "Pix gerado" : k === "boleto" ? "Boleto" : "Cartão recusado";
}

export default async function Vendas({ searchParams }: { searchParams: Promise<{ p?: string; met?: string; f?: string; q?: string; sel?: string }> }) {
  const sp = await searchParams;
  const today = isoDayLocal();
  const per = sp.p === "7" ? "7" : sp.p === "30" ? "30" : "mes";
  const from = per === "mes" ? `${today.slice(0, 8)}01` : addDays(today, -(Number(per) - 1));
  const days = Math.round((new Date(today).getTime() - new Date(from).getTime()) / 864e5) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = per === "mes" ? `${prevTo.slice(0, 8)}01` : addDays(prevTo, -(days - 1));
  const prevSame = per === "mes" ? addDays(prevFrom, days - 1) : prevTo; // mesmo número de dias no período anterior

  let orders: Order[] = [];
  let prev: Order[] = [];
  let error: unknown = null;
  const mP = computeMetrics(from, today).catch(() => null);
  try {
    [orders, prev] = await Promise.all([
      ordersBetween(dayRange(from).start, dayRange(today).end),
      ordersBetween(dayRange(prevFrom).start, dayRange(prevTo).end).catch(() => [] as Order[]),
    ]);
  } catch (e) { error = e; }
  const m = await mP;

  const paid = orders.filter(isPaid);
  const rev = paid.reduce((a, o) => a + o.subtotal, 0);
  const prevPaid = prev.filter(isPaid);
  const prevSameRev = prevPaid.filter((o) => isoDayLocal(new Date(o.createdAt)) <= prevSame).reduce((a, o) => a + o.subtotal, 0);
  const prevSameN = prevPaid.filter((o) => isoDayLocal(new Date(o.createdAt)) <= prevSame).length;
  const prevRev = prevPaid.reduce((a, o) => a + o.subtotal, 0);
  const ticket = paid.length ? rev / paid.length : 0;
  const dRev = pct(rev, prevSameRev);
  const dN = pct(paid.length, prevSameN);

  // quatro blocos do período, com quem comprou em cada um
  const span = Math.ceil(days / 4);
  const blocks = [0, 1, 2, 3].map((i) => {
    const a = addDays(from, i * span);
    const b = i === 3 ? today : addDays(from, (i + 1) * span - 1);
    const list = paid.filter((o) => { const d = isoDayLocal(new Date(o.createdAt)); return d >= a && d <= b; });
    return { a, b, v: list.reduce((s, o) => s + o.subtotal, 0), names: [...new Set(list.map((o) => o.customer).filter(Boolean))], future: a > today };
  });
  const bmax = Math.max(1, ...blocks.map((b) => b.v));
  const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

  const open = orders.filter((o) => !o.cancelled);
  const pend = open.filter((o) => !isPaid(o));
  const byK = (k: string) => paid.filter((o) => kindOf(o) === k);
  const met = ["pix", "cartao", "boleto"].includes(sp.met ?? "") ? sp.met! : "";
  const f = sp.f === "pagos" ? "pagos" : sp.f === "pendentes" ? "pendentes" : "todos";
  const q = (sp.q ?? "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const base = orders.filter((o) => (!met || kindOf(o) === met) && (!q || `${o.name} ${o.customer} ${o.email ?? ""}`.toLowerCase().includes(q) || (digits.length >= 4 && (o.phone ?? "").replace(/\D/g, "").includes(digits))));
  const list = base.filter((o) => (f === "pagos" ? isPaid(o) : f === "pendentes" ? !o.cancelled && !isPaid(o) : true));
  const cur = list.find((o) => o.id === sp.sel) ?? list[0];

  const href = (k: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const vals: Record<string, string | undefined> = { p: sp.p, met: sp.met, f: sp.f, q: sp.q, ...k };
    for (const [a, b] of Object.entries(vals)) if (b) p.set(a, b);
    return `/vendas${p.toString() ? `?${p}` : ""}`;
  };
  const perLabel = per === "mes" ? "do mês" : `de ${per} dias`;
  const margin = m && m.net ? Math.round((m.profitBeforeFixed / m.net) * 100) : null;
  const card = byK("cartao");

  return (
    <>
      <NxHead title="Vendas" back="/">
        <Link className="btn" href="/relatorio">Relatório do dia</Link>
        <Link className="btn pri" href="/pedidos">Todos os pedidos</Link>
      </NxHead>
      {error ? <ErrorNote error={error} /> : null}

      <NxRow2>
        <NxHero stats={<>
          <NxStat label={`Faturamento ${perLabel}`} pre="R$" value={n0(rev)} sub={dRev == null ? "sem venda no período anterior" : `${dRev >= 0 ? "↑" : "↓"} ${Math.abs(dRev)}% vs período anterior`} tone={dRev == null ? "mut" : dRev >= 0 ? "up" : "dn"} />
          <NxStat label="Pedidos pagos" value={paid.length.toLocaleString("pt-BR")} sub={dN == null ? "–" : `${dN >= 0 ? "↑" : "↓"} ${Math.abs(dN)}% vs período anterior`} tone={dN == null ? "mut" : dN >= 0 ? "up" : "dn"} />
          <NxStat label="Ticket médio" pre="R$" value={n0(ticket)} sub="sem frete" />
        </>}>
          <NxTracks>
            {[[0, 1], [2, 3]].map(([x, y]) => (
              <NxTrack key={x} l={`${dm(blocks[x].a)} a ${dm(blocks[x].b)}`} r={`${dm(blocks[y].a)} a ${dm(blocks[y].b)}`} pct={((blocks[x].v + blocks[y].v) / (bmax * 2)) * 100}>
                <NxAvs names={[...blocks[x].names, ...blocks[y].names].slice(0, 6)} more={Math.max(0, blocks[x].names.length + blocks[y].names.length - 6)} />
              </NxTrack>
            ))}
            <NxTrack l={per === "mes" ? "Mês passado inteiro" : "Período anterior"} r={brl(prevRev, 0)} pct={prevRev ? (rev / prevRev) * 100 : 0}>
              <NxNote>{prevRev ? `${Math.round((rev / prevRev) * 100)}% do que vendeu` : "sem venda para comparar"}</NxNote>
            </NxTrack>
          </NxTracks>
        </NxHero>
        <NxTabsCard title="Lucro antes dos custos fixos" pre="R$" value={m ? n0(m.profitBeforeFixed) : "–"} chip={margin != null ? `Margem ${margin}%` : ""}
          tabs={[
            { top: `${byK("pix").length} pedidos`, label: "Pix", href: href({ met: met === "pix" ? undefined : "pix", sel: undefined }), on: met === "pix" },
            { top: brl(card.reduce((a, o) => a + o.subtotal, 0), 0), label: "Cartão", href: href({ met: met === "cartao" ? undefined : "cartao", sel: undefined }), on: met === "cartao" || !met },
            { top: `${pend.length} pendentes`, label: "Aguardando", href: href({ f: "pendentes", met: undefined, sel: undefined }), on: f === "pendentes" && !met },
          ]}
          button={{ label: "Ver pedidos", href: "/pedidos" }} />
      </NxRow2>

      <NxFilters count={[met, sp.q, per !== "mes" ? per : ""].filter(Boolean).length}>
        <NxPill href={href({ p: undefined, sel: undefined })} on={per === "mes"}>Este mês</NxPill>
        <NxPill href={href({ p: "7", sel: undefined })} on={per === "7"}>7 dias</NxPill>
        <NxPill href={href({ p: "30", sel: undefined })} on={per === "30"}>30 dias</NxPill>
        {Object.entries(KL).map(([k, l]) => <NxPill key={k} href={href({ met: met === k ? undefined : k, sel: undefined })} on={met === k}>{l}</NxPill>)}
        <form action="/vendas" className="row" style={{ flex: 1, minWidth: 220, gap: 8 }}>
          {sp.p && <input type="hidden" name="p" value={sp.p} />}
          {sp.met && <input type="hidden" name="met" value={sp.met} />}
          {sp.f && <input type="hidden" name="f" value={sp.f} />}
          <input className="in" name="q" defaultValue={sp.q} placeholder="Buscar pedido, nome ou telefone" style={{ flex: 1 }} />
          <button className="nx-ic" type="submit" aria-label="Buscar"><Search size={16} /></button>
        </form>
      </NxFilters>

      <NxPanel title={f === "pendentes" ? "Pedidos pendentes" : f === "pagos" ? "Pedidos pagos" : "Pedidos"}
        tabs={[
          { label: "Todos", href: href({ f: undefined, sel: undefined }), on: f === "todos" },
          { label: "Pagos", count: base.filter(isPaid).length, href: href({ f: "pagos", sel: undefined }), on: f === "pagos" },
          { label: "Pendentes", count: base.filter((o) => !o.cancelled && !isPaid(o)).length, href: href({ f: "pendentes", sel: undefined }), on: f === "pendentes" },
        ]}
        tools={<Link className="btn sm" href={`/api/export/pedidos?dias=${days}`}>Exportar</Link>}
        list={list.length ? list.slice(0, 9).map((o) => (
          <NxItem key={o.id} href={href({ sel: o.id })} name={o.customer || "Cliente"} title={`${o.name} ${o.customer || ""}`} sub={`${ago(o.createdAt)} · ${KL[kindOf(o)]}`} status={statusOf(o)} ok={isPaid(o)} value={brl(o.total)} on={cur?.id === o.id} />
        )) : <NxEmpty>Nenhum pedido aqui.</NxEmpty>}
        detail={cur ? (<>
          <NxDHead cols={[
            { label: "Pedido", node: <NxDNum chip={statusOf(cur)}>{cur.name}</NxDNum> },
            { label: "Pagamento", node: <NxDText>{KL[kindOf(cur)]}{cur.codes[0] ? ` · cupom ${cur.codes[0]}` : ""}</NxDText> },
            { label: "Cliente", node: <NxWho name={cur.customer || "Cliente"} sub={cur.phone ? formatPhone(cur.phone) : [cur.city, cur.state].filter(Boolean).join(" · ")} /> },
          ]} />
          <NxDCards items={cur.lines.slice(0, 4).map((l) => ({ v: brl(l.revenue), d: `${l.quantity > 1 ? `${l.quantity}x ` : ""}${l.title}${l.variant ? ` · ${l.variant}` : ""}` }))} />
          <NxDFoot vals={[{ l: "Subtotal", v: brl(cur.subtotal) }, { l: "Frete", v: brl(Math.max(0, cur.total - cur.subtotal)) }, { l: "Total", v: brl(cur.total) }]}>
            <NxBtn href={`/pedidos?q=${encodeURIComponent(cur.name)}`}>↗</NxBtn>
            {cur.phone ? <NxBtn href={`https://wa.me/${cur.phone.replace(/\D/g, "")}`} target="_blank" lime><MessageCircle size={15} /> Chamar no WhatsApp</NxBtn> : <NxBtn href={`/pedidos?q=${encodeURIComponent(cur.name)}`} lime>Abrir pedido</NxBtn>}
          </NxDFoot>
        </>) : <NxEmpty>Escolha um pedido da lista.</NxEmpty>} />
    </>
  );
}
