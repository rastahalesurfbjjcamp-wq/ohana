import { customers, type Customer } from "@/lib/store";
import { SEGMENTS, inSegment, type SegmentKey } from "@/lib/segments";
import { brl } from "@/lib/time";
import Link from "next/link";
import { Send } from "lucide-react";
import { ErrorNote, Panel } from "@/components/ui";
import { NxHead, NxRow2, NxHero, NxStat, NxTracks, NxTrack, NxAvs, NxTabsCard, NxFilters, NxPill, NxPanel, NxItem, NxEmpty, NxDHead, NxDNum, NxDText, NxWho, NxDCards, NxDFoot, NxBtn } from "@/components/nx";
import { RFM_SEGMENTS, rfmOf } from "@/lib/audience";
import { createRfmList } from "../acoes12";

export const dynamic = "force-dynamic";

export default async function Clientes({ searchParams }: { searchParams: Promise<{ s?: string; uf?: string; sel?: string; n?: string }> }) {
  const sp = await searchParams;
  const { s = "todos", uf = "" } = sp;
  const seg = (s in SEGMENTS ? s : "todos") as SegmentKey;
  let all: Customer[] = [];
  let error: unknown = null;
  try {
    all = await customers();
  } catch (e) {
    error = e;
  }
  const counts = Object.fromEntries(Object.keys(SEGMENTS).map((k) => [k, all.filter((c) => inSegment(c, k as SegmentKey)).length]));
  const list = all.filter((c) => inSegment(c, seg) && (!uf || c.state === uf)).sort((a, b) => b.spent - a.spent);
  const ltv = all.length ? all.reduce((a, c) => a + c.spent, 0) / all.length : 0;
  const repeat = all.length ? all.filter((c) => c.orders >= 2).length / all.length : 0;
  const byUf = new Map<string, number>();
  for (const c of all) if (c.state) byUf.set(c.state, (byUf.get(c.state) ?? 0) + 1);
  const ufs = [...byUf.entries()].sort((a, b) => b[1] - a[1]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });
  const sorted = [...all.map((c) => c.spent)].sort((x, y) => x - y);
  const mCut = [0.2, 0.4, 0.6, 0.8].map((p) => sorted[Math.floor(p * (sorted.length - 1))] ?? 0);
  const rfmCount = new Map<string, { n: number; spent: number }>();
  for (const c of all) { const k = rfmOf(c, mCut).seg; const x = rfmCount.get(k) ?? { n: 0, spent: 0 }; x.n++; x.spent += c.spent; rfmCount.set(k, x); }
  const q = (k: string, v: string) => `/clientes?s=${k === "s" ? v : seg}${(k === "uf" ? v : uf) ? `&uf=${k === "uf" ? v : uf}` : ""}`;

  return (
    <>
      <NxHead title="Clientes" back="/">
        <Link className="btn" href="/listas">Listas</Link>
        <Link className="btn pri" href="/disparos"><Send size={15} /> Disparar para clientes</Link>
      </NxHead>
      {error ? <ErrorNote error={error} /> : null}
      <NxRow2>
        <NxHero stats={<>
          <NxStat label="Clientes" value={all.length.toLocaleString("pt-BR")} sub={`${all.filter((c) => Date.now() - new Date(c.createdAt).getTime() < 30 * 864e5).length.toLocaleString("pt-BR")} novos em 30 dias`} tone="up" />
          <NxStat label="Compraram de novo" value={`${Math.round(repeat * 100)}%`} sub={`${all.filter((c) => c.orders >= 2).length.toLocaleString("pt-BR")} clientes`} />
          <NxStat label="Valor por cliente" pre="R$" value={Math.round(ltv).toLocaleString("pt-BR")} sub="média de tudo que gastou" />
        </>}>
          <NxTracks>
            {([["1 compra", (c: Customer) => c.orders <= 1], ["2 a 3 compras", (c: Customer) => c.orders >= 2 && c.orders <= 3], ["4 ou mais", (c: Customer) => c.orders >= 4]] as const).map(([l, fn]) => {
              const g = all.filter(fn).sort((x, y) => y.spent - x.spent);
              return <NxTrack key={l} l={l} r={g.length.toLocaleString("pt-BR")} pct={all.length ? (g.length / all.length) * 100 : 0}><NxAvs names={g.slice(0, 5).map((c) => c.name)} more={Math.max(0, g.length - 5)} /></NxTrack>;
            })}
          </NxTracks>
        </NxHero>
        {(() => {
          const since = (c: Customer) => (c.lastOrderAt ? (Date.now() - new Date(c.lastOrderAt).getTime()) / 864e5 : 9999);
          const gone = all.filter((c) => since(c) >= 60);
          return <NxTabsCard title="Sumidos há 60 dias ou mais" value={gone.length.toLocaleString("pt-BR")} chip={`gastaram ${brl(gone.reduce((x, c) => x + c.spent, 0), 0)}`}
            tabs={[{ top: all.filter((c) => since(c) >= 60 && since(c) < 90).length.toLocaleString("pt-BR"), label: "60 dias", on: true }, { top: all.filter((c) => since(c) >= 90 && since(c) < 180).length.toLocaleString("pt-BR"), label: "90 dias" }, { top: all.filter((c) => since(c) >= 180).length.toLocaleString("pt-BR"), label: "180 dias" }]}
            button={{ label: "Criar disparo", href: "/disparos" }} />;
        })()}
      </NxRow2>
      <NxFilters count={[seg !== "todos" ? seg : "", uf].filter(Boolean).length}>
        {Object.entries(SEGMENTS).map(([k, v]) => <NxPill key={k} href={q("s", k)} on={seg === k}>{v.label} {(counts[k] ?? 0).toLocaleString("pt-BR")}</NxPill>)}
        {uf && <NxPill href={q("uf", "")} on>{uf} ✕</NxPill>}
        {!uf && ufs.slice(0, 4).map(([k]) => <NxPill key={k} href={q("uf", k)}>{k}</NxPill>)}
      </NxFilters>
      {(() => {
        const lim = Math.min(200, Math.max(9, Number(sp.n) || 9));
        const cur = list.find((c) => c.id === sp.sel) ?? list[0];
        const link = (extra: string) => `${q("s", seg)}${extra}`;
        const tag = (c: Customer) => (c.orders >= 3 || c.spent >= 1000 ? "VIP" : c.orders >= 2 ? "Recorrente" : c.lastOrderAt && Date.now() - new Date(c.lastOrderAt).getTime() > 120 * 864e5 ? "Sumido" : "Novo");
        return (
          <NxPanel title={`${SEGMENTS[seg].label}${uf ? ` em ${uf}` : ""}`}
            tabs={[{ label: "Todos", href: q("s", "todos"), on: seg === "todos" }, { label: "Recorrentes", count: counts.recorrentes, href: q("s", "recorrentes"), on: seg === "recorrentes" }, { label: "Sumidos", count: counts.inativos, href: q("s", "inativos"), on: seg === "inativos" }]}
            list={list.length ? (<>
              {list.slice(0, lim).map((c) => <NxItem key={c.id} href={link(`&sel=${c.id}${lim > 9 ? `&n=${lim}` : ""}`)} name={c.name} title={c.name} sub={`${[c.city, c.state].filter(Boolean).join(" / ") || "–"} · ${c.orders} pedido(s)`} status={tag(c)} ok={tag(c) !== "Sumido"} value={brl(c.spent, 0)} on={cur?.id === c.id} />)}
              {list.length > lim && <Link href={link(`&n=${lim + 20}`)} className="nx-it" style={{ justifyContent: "center", color: "#555", fontSize: 12.5 }}>Mostrar mais ({(list.length - lim).toLocaleString("pt-BR")})</Link>}
            </>) : <NxEmpty>Ninguém neste grupo.</NxEmpty>}
            detail={cur ? (<>
              <NxDHead cols={[
                { label: "Cliente", node: <NxWho name={cur.name} sub={cur.phone ?? cur.email ?? ""} /> },
                { label: "Desde", node: <NxDText>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(cur.createdAt))}</NxDText> },
                { label: "Grupo", node: <NxDNum chip={tag(cur)}>{null}</NxDNum> },
              ]} />
              <NxDCards cols={3} items={[{ v: cur.orders, d: "Pedidos" }, { v: brl(cur.spent, 0), d: "Gastou na loja" }, { v: cur.lastOrderAt ? fmt.format(new Date(cur.lastOrderAt)) : "–", d: "Última compra" }]} />
              <NxDFoot vals={[{ l: "Ticket", v: cur.orders ? brl(cur.spent / cur.orders, 0) : "–" }, { l: "Cidade", v: [cur.city, cur.state].filter(Boolean).join(" / ") || "–" }]}>
                <NxBtn href={`/pedidos?q=${encodeURIComponent(cur.email ?? cur.name)}`}>↗</NxBtn>
                {cur.phone ? <NxBtn href={`https://wa.me/${cur.phone.replace(/\D/g, "")}`} target="_blank" lime>Chamar no WhatsApp</NxBtn> : <NxBtn href={`/pedidos?q=${encodeURIComponent(cur.email ?? cur.name)}`} lime>Ver pedidos</NxBtn>}
              </NxDFoot>
            </>) : <NxEmpty>Escolha um cliente da lista.</NxEmpty>} />
        );
      })()}
      <Panel title="Matriz RFM" sub="Clientes separados por quando compraram pela última vez, quantas vezes e quanto gastaram. Clique para virar lista ou campanha.">
        <div className="rfm">
          {RFM_SEGMENTS.map((sg) => {
            const x = rfmCount.get(sg.k) ?? { n: 0, spent: 0 };
            if (!x.n) return null;
            return (
              <div key={sg.k} className="rfm-t" style={{ flexGrow: x.n, background: sg.color }} title={`${sg.desc}. Sugestão: ${sg.action}`}>
                <b>{sg.label}</b>
                <span>{x.n.toLocaleString("pt-BR")} · {all.length ? ((x.n / all.length) * 100).toFixed(1).replace(".", ",") : 0}%</span>
                <small>{brl(x.spent, 0)} gastos</small>
                <div className="rfm-a">
                  <form action={createRfmList}><input type="hidden" name="seg" value={sg.k} /><button type="submit">Ver lista</button></form>
                  <Link href={`/campanhas-whatsapp?nova=1&rfm=${sg.k}`}>Campanha</Link>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr)", alignItems: "start" }}>
        <Panel title="Por estado" sub="Clique para filtrar">
          {uf && <Link className="chip c-k" href={q("uf", "")} style={{ marginBottom: 8 }}>ver todos os estados</Link>}
          {ufs.slice(0, 14).map(([k, n]) => (
            <Link key={k} href={q("uf", k)} className="lrow" style={{ color: "inherit", padding: "8px 0" }}>
              <b style={{ width: 28, color: uf === k ? "var(--sun)" : undefined }}>{k}</b>
              <div className="hbar" style={{ flex: 1 }}><i className={uf === k ? "s" : ""} style={{ width: `${(n / (ufs[0]?.[1] || 1)) * 100}%` }} /></div>
              <span className="mut end" style={{ width: 44 }}>{n}</span>
            </Link>
          ))}
        </Panel>
      </div>
      <div className="callout sun">
        Voucher de aniversário: a Shopify não guarda a data de nascimento. O formulário de leads já pede a data, e quem preencher entra na régua de aniversário quando a recuperação e o pós-venda forem ativados.
      </div>
    </>
  );
}
