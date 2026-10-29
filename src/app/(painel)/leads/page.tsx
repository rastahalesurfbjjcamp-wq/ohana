import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatPhone } from "@/lib/phone";
import { redirectLink } from "@/lib/redirect";
import { getSettings } from "@/lib/settings";
import { Header, Kpi, Panel } from "@/components/ui";
import { addLeadManual, saveLeadSettings } from "../acoes2";

export const dynamic = "force-dynamic";

const STATUS = { novo: ["novo", "c-k"], no_grupo: ["no grupo", "c-l"], cliente: ["cliente", "c-l"], descadastrado: ["saiu da lista", "c-n"] } as const;

export default async function Leads({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  const [leads, total, week, s] = await Promise.all([
    db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    db.lead.count(),
    db.lead.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
    getSettings(),
  ]);
  const inGroup = new Set(
    (await db.contact.findMany({ where: { phone: { in: leads.map((l) => l.phone) }, memberships: { some: { leftAt: null, group: { isCommunity: true } } } }, select: { phone: true } })).map((c) => c.phone),
  );
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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
  ["utm_source","utm_medium","utm_campaign"].forEach(function (k) { if (u.get(k)) d[k] = u.get(k); });
  var r = await fetch("${api}", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
  var j = await r.json();
  if (j.ok) location.href = j.link; else alert(j.error || "Confira seu WhatsApp");
});
</script>`;

  return (
    <>
      <Header title="Leads" lede="Quem se cadastrou na página do Grupo VIP. A pessoa recebe a mensagem de boas-vindas no WhatsApp e vai direto para o grupo com vaga." />
      {sp.erro && <div className="err">WhatsApp inválido.</div>}
      <div className="grid g4">
        <Kpi label="Leads" value={total.toLocaleString("pt-BR")} />
        <Kpi label="Últimos 7 dias" value={week} />
        <Kpi label="Já estão no grupo" value={inGroup.size} sub="dos 200 mais recentes" />
        <Kpi label="Link dos grupos" value={<a href={redirectLink()} target="_blank" rel="noreferrer" style={{ fontSize: 15 }}>{redirectLink().replace(/^https?:\/\//, "")}</a>} sub="manda para o grupo com vaga" />
      </div>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Últimos cadastros" body={false}>
          {leads.length ? (
            <table className="tb">
              <tbody>
                {leads.map((l) => {
                  const st = inGroup.has(l.phone) ? STATUS.no_grupo : STATUS[(l.status as keyof typeof STATUS) ?? "novo"] ?? STATUS.novo;
                  return (
                    <tr key={l.id}>
                      <td>
                        {l.name ?? "Sem nome"}
                        <div className="dim" style={{ fontSize: 12 }}>{formatPhone(l.phone)}{l.email ? ` · ${l.email}` : ""}</div>
                      </td>
                      <td className="mut" style={{ fontSize: 12.5 }}>{l.utmSource ? `${l.utmSource}${l.utmCampaign ? " / " + l.utmCampaign : ""}` : l.source}</td>
                      <td><span className={`chip ${st[1]}`}>{st[0]}</span></td>
                      <td className="r dim">{fmt.format(l.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum lead ainda. Coloque o formulário ao lado na página do Grupo VIP.</div>
          )}
        </Panel>
        <div className="stack">
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
      </div>
    </>
  );
}
