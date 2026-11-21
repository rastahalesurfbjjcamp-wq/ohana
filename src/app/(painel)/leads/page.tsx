import Link from "next/link";
import { Download, Search, Send, Settings2 } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatPhone } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { customers } from "@/lib/store";
import { normalizePhone } from "@/lib/segments";
import { Panel } from "@/components/ui";
import { NxHead, NxRow2, NxHero, NxStat, NxTracks, NxTrack, NxAvs, NxNote, NxTabsCard, NxFilters, NxPill, NxPanel, NxItem, NxEmpty, NxDHead, NxDNum, NxDText, NxWho, NxDCards, NxDFoot, NxBtn } from "@/components/nx";
import { LeadsTable, type LeadRow } from "@/components/LeadsTable";
import { addLeadManual, leadsToBroadcast, saveLeadSettings } from "../acoes2";

export const dynamic = "force-dynamic";

const PAID = /^(facebook|fb|instagram|ig|meta)/i;
function originOf(l: { source: string; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null }): [string, string] {
  const src = (l.utmSource ?? "").toLowerCase();
  if (src && PAID.test(src) && /(paid|cpc|ads?|anuncio)/i.test(l.utmMedium ?? "paid")) return ["Anúncio Meta", l.utmCampaign ?? "sem campanha"];
  if (/bio|linktree/i.test(`${src} ${l.utmMedium ?? ""} ${l.source}`)) return ["Instagram bio", "link na bio"];
  if (/manychat/i.test(`${src} ${l.source}`)) return ["ManyChat", l.utmCampaign ?? "automação"];
  if (src) return [src[0].toUpperCase() + src.slice(1), l.utmCampaign ?? l.utmMedium ?? "direto"];
  if (l.source === "manual") return ["Manual", "adicionado no painel"];
  return ["Página Grupo VIP", "direto"];
}

export default async function Leads({ searchParams }: { searchParams: Promise<{ erro?: string; f?: string; q?: string; o?: string; dias?: string; cfg?: string; sel?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const all = await db.lead.findMany({ orderBy: { createdAt: "desc" } });
  const phones = all.map((l) => l.phone);
  const [active, left, shop] = await Promise.all([
    db.contact.findMany({ where: { phone: { in: phones }, memberships: { some: { leftAt: null, group: { isCommunity: true } } } }, select: { phone: true } }),
    db.contact.findMany({ where: { phone: { in: phones }, memberships: { some: { leftAt: { not: null } } } }, select: { phone: true } }),
    customers().catch(() => []),
  ]);
  const inG = new Set(active.map((c) => c.phone));
  const leftG = new Set(left.map((c) => c.phone));
  const buyers = new Map<string, { spent: number; orders: number }>();
  for (const c of shop) { const p = normalizePhone(c.phone); if (p) buyers.set(p, { spent: c.spent, orders: c.orders }); }
  const groupOf = (p: string): LeadRow["group"] => (inG.has(p) ? "no_grupo" : leftG.has(p) ? "saiu" : "nao_entrou");

  const startToday = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) + "T03:00:00Z");
  const today = all.filter((l) => l.createdAt >= startToday).length;
  const yesterday = all.filter((l) => l.createdAt >= new Date(startToday.getTime() - 864e5) && l.createdAt < startToday).length;
  const vsY = yesterday ? Math.round(((today - yesterday) / yesterday) * 100) : null;
  const rateGroup = all.length ? all.filter((l) => inG.has(l.phone)).length / all.length : 0;
  const rateBuy = all.length ? all.filter((l) => buyers.has(l.phone)).length / all.length : 0;
  const origins = new Map<string, number>();
  for (const l of all) { const o = originOf(l)[0]; origins.set(o, (origins.get(o) ?? 0) + 1); }
  const topOrigin = [...origins.entries()].sort((a, b) => b[1] - a[1])[0];

  const dias = sp.dias === "7" || sp.dias === "90" || sp.dias === "todos" ? sp.dias : "30";
  const since = dias === "todos" ? new Date(0) : new Date(Date.now() - Number(dias) * 864e5);
  const q = (sp.q ?? "").trim().toLowerCase();
  const base = all.filter((l) => l.createdAt >= since && (!sp.o || originOf(l)[0] === sp.o) && (!q || `${l.name ?? ""} ${l.phone} ${l.email ?? ""}`.toLowerCase().includes(q.replace(/\D/g, "") || q)));
  const counts = {
    todos: base.length,
    no_grupo: base.filter((l) => inG.has(l.phone)).length,
    nao_entrou: base.filter((l) => groupOf(l.phone) === "nao_entrou").length,
    comprou: base.filter((l) => buyers.has(l.phone)).length,
    saiu: base.filter((l) => groupOf(l.phone) === "saiu").length,
  };
  const f = (sp.f ?? "todos") as keyof typeof counts;
  const list = base.filter((l) => f === "todos" || (f === "comprou" ? buyers.has(l.phone) : groupOf(l.phone) === f));
  const fmtD = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const when = (d: Date) => {
    const m = Math.round((Date.now() - d.getTime()) / 60000);
    return m < 60 ? `há ${Math.max(1, m)} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : fmtD.format(d);
  };
  const rows: LeadRow[] = list.slice(0, 300).map((l) => {
    const [o, os] = originOf(l);
    const b = buyers.get(l.phone);
    return { id: l.id, name: l.name ?? "Sem nome", phone: l.phone, phoneFmt: formatPhone(l.phone), email: l.email, origin: o, originSub: os, when: when(l.createdAt), group: groupOf(l.phone), spent: b?.spent ?? 0, orders: b?.orders ?? 0 };
  });
  const cur = list.find((l) => l.id === sp.sel) ?? list[0];
  const href = (k: string, v?: string) => {
    const p = new URLSearchParams();
    const vals: Record<string, string | undefined> = { f: sp.f, q: sp.q, o: sp.o, dias: sp.dias, [k]: v };
    for (const [kk, vv] of Object.entries(vals)) if (vv) p.set(kk, vv);
    return `/leads${p.toString() ? `?${p}` : ""}`;
  };
  const api = `${env.appUrl().replace(/\/$/, "")}/api/leads`;
  const snippet = `<form id="hub-vip">
  <input name="name" placeholder="Seu nome" required>
  <input name="phone" placeholder="WhatsApp com DDD" required>
  <input name="email" type="email" placeholder="E-mail (opcional)">
  <input name="birthday" placeholder="Aniversário (dd/mm)">
  <input name="website" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">Quero entrar no Grupo VIP</button>
</form>
<script>
document.getElementById("hub-vip").addEventListener("submit", async function (e) {
  e.preventDefault();
  var d = Object.fromEntries(new FormData(this));
  var u = new URLSearchParams(location.search);
  ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function (k) { if (u.get(k)) d[k] = u.get(k); });
  var r = await fetch("${api}", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
  var j = await r.json();
  if (j.ok) location.href = j.link; else alert(j.error || "Confira seu WhatsApp");
});
</script>`;

  return (
    <>
      <NxHead title="Leads" back="/">
        <a className="btn" href="/api/export/leads"><Download size={16} /> Exportar</a>
        <Link className={`btn${sp.cfg ? " on" : ""}`} href={sp.cfg ? href("cfg") : href("cfg", "1")}><Settings2 size={15} /> Configurar</Link>
        <Link className="btn pri" href="/disparos"><Send size={16} /> Novo disparo</Link>
      </NxHead>
      {sp.erro && <div className="err">WhatsApp inválido.</div>}
      <NxRow2>
        <NxHero stats={<>
          <NxStat label="Leads hoje" value={today} sub={vsY == null ? `${all.length.toLocaleString("pt-BR")} no total` : `${vsY >= 0 ? "↑" : "↓"} ${Math.abs(vsY)}% vs ontem`} tone={vsY == null ? "mut" : vsY >= 0 ? "up" : "dn"} />
          <NxStat label="Entraram no grupo" value={`${Math.round(rateGroup * 100)}%`} sub={`${all.filter((l) => inG.has(l.phone)).length.toLocaleString("pt-BR")} de ${all.length.toLocaleString("pt-BR")}`} />
          <NxStat label="Viraram clientes" value={`${Math.round(rateBuy * 100)}%`} sub={`${all.filter((l) => buyers.has(l.phone)).length.toLocaleString("pt-BR")} compraram`} />
        </>}>
          <NxTracks>
            <NxTrack l="Formulário" r="Grupo" pct={rateGroup * 100}><NxAvs names={all.filter((l) => inG.has(l.phone)).slice(0, 5).map((l) => l.name ?? l.phone)} /></NxTrack>
            <NxTrack l="Grupo" r="Compra" pct={rateBuy * 100}><NxAvs names={all.filter((l) => buyers.has(l.phone)).slice(0, 4).map((l) => l.name ?? l.phone)} /></NxTrack>
            <NxTrack l="Leads em 30 dias" r={all.filter((l) => l.createdAt >= new Date(Date.now() - 30 * 864e5)).length.toLocaleString("pt-BR")} pct={all.length ? (all.filter((l) => l.createdAt >= new Date(Date.now() - 30 * 864e5)).length / all.length) * 100 : 0}><NxNote>{all.length.toLocaleString("pt-BR")} no total</NxNote></NxTrack>
          </NxTracks>
        </NxHero>
        <NxTabsCard title="Origem principal" value={topOrigin?.[0] ?? "–"} chip={topOrigin ? `${Math.round((topOrigin[1] / Math.max(1, all.length)) * 100)}%` : ""}
          tabs={[...origins.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([o, n]) => ({ top: n.toLocaleString("pt-BR"), label: o, href: href("o", sp.o === o ? undefined : o), on: sp.o === o }))}
          button={{ label: "Ver campanhas", href: "/campanhas" }} />
      </NxRow2>
      <NxFilters count={[sp.o, sp.q, sp.dias].filter(Boolean).length}>
        {[["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["todos", "Tudo"]].map(([k, l]) => <NxPill key={k} href={href("dias", k === "30" ? undefined : k)} on={dias === k}>{l}</NxPill>)}
        <NxPill href={href("o", undefined)} on={!sp.o}>Todas as origens</NxPill>
        <form action="/leads" className="row" style={{ flex: 1, minWidth: 220, gap: 8 }}>
          {sp.f && <input type="hidden" name="f" value={sp.f} />}
          <input className="in" name="q" defaultValue={sp.q} placeholder="Buscar nome, número ou e-mail" style={{ flex: 1 }} />
          <button className="nx-ic" type="submit" aria-label="Buscar"><Search size={16} /></button>
        </form>
      </NxFilters>
      <NxPanel title="Leads"
        tabs={([["todos", "Todos"], ["nao_entrou", "Não entrou"], ["no_grupo", "No grupo"], ["comprou", "Compraram"]] as const).map(([k, l]) => ({ label: l, count: k === "todos" ? undefined : counts[k], href: href("f", k === "todos" ? undefined : k), on: f === k }))}
        list={list.length ? list.slice(0, 9).map((l) => {
          const [o] = originOf(l);
          const g = groupOf(l.phone);
          const b = buyers.get(l.phone);
          return <NxItem key={l.id} href={`${href("sel", l.id)}`} name={l.name ?? l.phone} title={l.name ?? "Sem nome"} sub={`${o} · ${when(l.createdAt)}`} status={b ? "Comprou" : g === "no_grupo" ? "No grupo" : g === "saiu" ? "Saiu do grupo" : "Não entrou"} ok={!!b || g === "no_grupo"} on={cur?.id === l.id} />;
        }) : <NxEmpty>Nenhum lead aqui.</NxEmpty>}
        detail={cur ? (() => {
          const [o, os] = originOf(cur);
          const g = groupOf(cur.phone);
          const b = buyers.get(cur.phone);
          return (<>
            <NxDHead cols={[
              { label: "Lead", node: <NxWho name={cur.name ?? cur.phone} sub={formatPhone(cur.phone)} /> },
              { label: "Origem", node: <NxDText>{o} · {os}</NxDText> },
              { label: "Situação", node: <NxDNum chip={b ? "Comprou" : g === "no_grupo" ? "No grupo" : g === "saiu" ? "Saiu do grupo" : "Não entrou no grupo"}>{null}</NxDNum> },
            ]} />
            <NxDCards cols={3} items={[{ v: cur.email ?? "–", d: "E-mail" }, { v: cur.birthday ?? "–", d: "Aniversário" }, { v: cur.source, d: "Página do cadastro" }]} />
            <NxDFoot vals={[{ l: "Captado", v: fmtD.format(cur.createdAt) }, { l: "Compras", v: b?.orders ?? 0 }, { l: "Gastou", v: b ? `R$ ${Math.round(b.spent).toLocaleString("pt-BR")}` : "R$ 0" }]}>
              <NxBtn href={`/atendimento?tel=${cur.phone}`}>↗</NxBtn>
              <NxBtn href={`https://wa.me/${cur.phone}`} target="_blank" lime>Chamar no WhatsApp</NxBtn>
            </NxDFoot>
          </>);
        })() : <NxEmpty>Escolha um lead da lista.</NxEmpty>} />
      {sp.cfg && (
        <div className="cols c-1-1-1" style={{ alignItems: "start" }}>
          <Panel title="Mensagem de boas-vindas">
            <form action={saveLeadSettings} className="stack">
              <label className="check"><input type="checkbox" name="welcomeEnabled" defaultChecked={s.leads.welcomeEnabled} /> Mandar no WhatsApp assim que a pessoa se cadastrar</label>
              <textarea className="in" name="welcomeText" defaultValue={s.leads.welcomeText} />
              <span className="dim" style={{ fontSize: 12 }}>{"{nome}"} = primeiro nome, {"{link}"} = link do grupo com vaga, {"{loja}"} = nome da loja.</span>
              <div><button className="btn pri" type="submit">Salvar</button></div>
            </form>
          </Panel>
          <Panel title="Formulário para a página do Grupo VIP" sub="Substitui o formulário do Klaviyo. Na Shopify, adicione um bloco “HTML personalizado” na página e cole o código.">
            <div className="code">{snippet}</div>
          </Panel>
          <Panel title="Adicionar lead na mão">
            <form action={addLeadManual} className="row">
              <input className="in" name="name" placeholder="Nome" style={{ flex: 1 }} />
              <input className="in" name="phone" placeholder="WhatsApp com DDD" required style={{ flex: 1 }} />
              <button className="btn" type="submit">Adicionar</button>
            </form>
          </Panel>
        </div>
      )}
      <section className="pnl" style={{ paddingTop: 6 }}>
        <div className="ph"><h3>Selecionar leads para um disparo</h3></div>
        <LeadsTable rows={rows} action={leadsToBroadcast} />
        {list.length > 300 && <div className="dim" style={{ fontSize: 12.5, padding: "0 22px 16px" }}>Mostrando 300 de {list.length.toLocaleString("pt-BR")}. Use a busca ou os filtros.</div>}
      </section>
    </>
  );
}
