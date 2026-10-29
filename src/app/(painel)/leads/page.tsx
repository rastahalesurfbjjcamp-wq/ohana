import Link from "next/link";
import { Download, Search, Send, Settings2 } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatPhone } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { customers } from "@/lib/store";
import { normalizePhone } from "@/lib/segments";
import { Header, Panel } from "@/components/ui";
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

function Ring({ value, color }: { value: number; color: string }) {
  const r = 21, c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#1f2523" strokeWidth="6" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * Math.min(1, value)} ${c}`} />
      </svg>
    </div>
  );
}

export default async function Leads({ searchParams }: { searchParams: Promise<{ erro?: string; f?: string; q?: string; o?: string; dias?: string; cfg?: string }> }) {
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
      <Header title="Leads" lede="Captados pela página do Grupo VIP e salvos direto no Hub.">
        <form className="srch" action="/leads">
          <Search size={15} className="dim" />
          <input name="q" defaultValue={sp.q} placeholder="Buscar nome, número ou e-mail" />
          {sp.f && <input type="hidden" name="f" value={sp.f} />}
        </form>
        <a className="btn" href="/api/export/leads"><Download size={16} /> Exportar</a>
        <Link className="btn pri" href="/disparos"><Send size={16} /> Novo disparo</Link>
      </Header>
      {sp.erro && <div className="err">WhatsApp inválido.</div>}
      <div className="grid g4">
        <div className="pnl kpi">
          <div className="row" style={{ justifyContent: "space-between" }}><small>Leads hoje</small>{vsY != null && <span className={`chip ${vsY >= 0 ? "c-l" : "c-c"}`}>{vsY >= 0 ? "+" : ""}{vsY}% vs ontem</span>}</div>
          <span className="num">{today}</span>
          <div className="sub">{all.length.toLocaleString("pt-BR")} no total</div>
        </div>
        <div className="pnl kpi row" style={{ justifyContent: "space-between" }}>
          <div><small>Entraram no grupo</small><span className="num">{Math.round(rateGroup * 100)}%</span></div>
          <Ring value={rateGroup} color="#34c26a" />
        </div>
        <div className="pnl kpi row" style={{ justifyContent: "space-between" }}>
          <div><small>Viraram clientes</small><span className="num">{Math.round(rateBuy * 100)}%</span></div>
          <Ring value={rateBuy} color="#f7c928" />
        </div>
        <div className="pnl kpi">
          <div className="row" style={{ justifyContent: "space-between" }}><small>Origem principal</small>{topOrigin && <span className="chip c-s">{Math.round((topOrigin[1] / Math.max(1, all.length)) * 100)}%</span>}</div>
          <span className="num" style={{ fontSize: 22, marginTop: 14 }}>{topOrigin?.[0] ?? "–"}</span>
        </div>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="chips">
          {([["todos", "Todos"], ["no_grupo", "No grupo"], ["nao_entrou", "Não entrou"], ["comprou", "Comprou"], ["saiu", "Saiu do grupo"]] as const).map(([k, l]) => (
            <Link key={k} href={href("f", k === "todos" ? undefined : k)} className={f === k ? "on" : ""}>{l}<b>{counts[k].toLocaleString("pt-BR")}</b></Link>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="seg">
            {[["", "Todas"], ...[...origins.keys()].slice(0, 4).map((o) => [o, o])].map(([k, l]) => <Link key={l} href={href("o", k || undefined)} className={(sp.o ?? "") === k ? "on" : ""}>{l}</Link>)}
          </div>
          <div className="seg">
            {[["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["todos", "Tudo"]].map(([k, l]) => <Link key={k} href={href("dias", k === "30" ? undefined : k)} className={dias === k ? "on" : ""}>{l}</Link>)}
          </div>
          <Link className={`btn${sp.cfg ? " on" : ""}`} href={sp.cfg ? href("cfg") : href("cfg", "1")}><Settings2 size={15} /> Configurar</Link>
        </div>
      </div>
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
        <LeadsTable rows={rows} action={leadsToBroadcast} />
        {list.length > 300 && <div className="dim" style={{ fontSize: 12.5, padding: "0 22px 16px" }}>Mostrando 300 de {list.length.toLocaleString("pt-BR")}. Use a busca ou os filtros.</div>}
      </section>
    </>
  );
}
