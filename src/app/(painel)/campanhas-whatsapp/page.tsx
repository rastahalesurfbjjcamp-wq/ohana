import Link from "next/link";
import { Megaphone, Plus, X } from "lucide-react";
import { db } from "@/lib/db";
import { brl } from "@/lib/time";
import { Header, Panel } from "@/components/ui";
import { RFM_SEGMENTS } from "@/lib/audience";
import { createCampaign, type CampaignCfg } from "../acoes12";
import { CAMP_STATE as STATE, fmtAt } from "@/lib/campaignUi";

export const dynamic = "force-dynamic";

export default async function Campanhas({ searchParams }: { searchParams: Promise<{ nova?: string; rfm?: string; lista?: string }> }) {
  const sp = await searchParams;
  const all = (await db.automation.findMany({ where: { trigger: "manual" }, orderBy: { createdAt: "desc" } })).filter((a) => (a.config as CampaignCfg | null)?.campaign);
  const ids = all.map((a) => a.id);
  const [lists, templates, runs, msgs] = await Promise.all([
    db.contactList.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { members: true } } } }),
    db.messageTemplate.findMany({ orderBy: [{ folder: "asc" }, { name: "asc" }], select: { id: true, name: true, folder: true } }),
    db.automationRun.groupBy({ by: ["automationId"], where: { automationId: { in: ids } }, _count: true, _sum: { value: true } }),
    db.autoMsg.groupBy({ by: ["automationId", "status"], where: { automationId: { in: ids } }, _count: true }),
  ]);
  const clicks = await db.automationRun.groupBy({ by: ["automationId"], where: { automationId: { in: ids }, clicks: { gt: 0 } }, _count: true });
  const conv = await db.automationRun.groupBy({ by: ["automationId"], where: { automationId: { in: ids }, convertedAt: { not: null } }, _count: true });
  const listName = new Map(lists.map((l) => [l.id, `${l.name} (${l._count.members})`]));
  const folders = [...new Set(templates.map((t) => t.folder))];
  const tomorrow = new Date(Date.now() + 21 * 3600_000).toISOString().slice(0, 11) + "10:00";
  return (
    <>
      <Header title="Campanhas de WhatsApp" lede="Uma mensagem (ou sequência) para uma lista ou segmento, numa data marcada. Sai aos poucos, com a proteção do número, e mede leitura, clique e venda.">
        <Link className="btn pri" href="/campanhas-whatsapp?nova=1"><Plus size={16} /> Nova campanha</Link>
      </Header>
      {sp.nova && (
        <Panel title="Nova campanha" sub="Você confere tudo e agenda na próxima tela. Nada é enviado agora." right={<Link className="menu-b" href="/campanhas-whatsapp" aria-label="Fechar"><X size={16} /></Link>}>
          <form action={createCampaign} className="cp-form">
            <label className="cv-field">Nome<input className="in" name="name" placeholder="Ex.: Lançamento verão" required /></label>
            <label className="cv-field">Para quem
              <select className="in" name="rfm" defaultValue={sp.rfm ?? ""}>
                <option value="">Escolher uma lista abaixo</option>
                <optgroup label="Segmentos (matriz RFM)">{RFM_SEGMENTS.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}</optgroup>
              </select>
            </label>
            <label className="cv-field">Ou uma lista
              <select className="in" name="listId" defaultValue={sp.lista ?? ""}>
                <option value="">Nenhuma</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l._count.members}){l.dynamic ? " · por regra" : ""}</option>)}
              </select>
            </label>
            <label className="cv-field">Mensagem
              <select className="in" name="messageId">
                <option value="">Escrever depois</option>
                {folders.map((f) => <optgroup key={f || "_"} label={f || "Sem pasta"}>{templates.filter((t) => t.folder === f).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}
              </select>
              <small className="dim">Ou crie antes em <Link href="/mensagens/nova?pasta=Campanhas" style={{ textDecoration: "underline" }}>Mensagens</Link>.</small>
            </label>
            <label className="cv-field">Quando (horário de Brasília)<input className="in" type="datetime-local" name="at" defaultValue={tomorrow} /></label>
            <div><button className="btn pri" type="submit">Continuar</button></div>
          </form>
        </Panel>
      )}
      {all.length ? (
        <section className="pnl" style={{ padding: 0 }}>
          <table className="tb">
            <thead><tr><th>Campanha</th><th>Status</th><th>Para</th><th>Quando</th><th className="r">Envios</th><th className="r">Leitura</th><th className="r">Clique</th><th className="r">Vendas</th></tr></thead>
            <tbody>
              {all.map((a) => {
                const cfg = a.config as CampaignCfg;
                const r = runs.find((x) => x.automationId === a.id);
                const m = msgs.filter((x) => x.automationId === a.id);
                const sent = m.reduce((s, x) => s + x._count, 0);
                const read = m.filter((x) => x.status === "lida").reduce((s, x) => s + x._count, 0);
                const ck = clicks.find((x) => x.automationId === a.id)?._count ?? 0;
                const cv = conv.find((x) => x.automationId === a.id)?._count ?? 0;
                const st = STATE[cfg.state] ?? STATE.rascunho;
                return (
                  <tr key={a.id}>
                    <td><Link href={`/campanhas-whatsapp/${a.id}`} style={{ fontWeight: 600 }}>{a.name}</Link></td>
                    <td><span className={`chip ${st.cls}`}>{st.label}</span></td>
                    <td className="dim" style={{ fontSize: 12.5 }}>{cfg.listId ? listName.get(cfg.listId) ?? "Lista apagada" : "-"}</td>
                    <td className="dim">{fmtAt(cfg.at)}</td>
                    <td className="r">{sent.toLocaleString("pt-BR")}</td>
                    <td className="r">{sent ? `${Math.round((read / sent) * 100)}%` : "-"}</td>
                    <td className="r">{r?._count ? `${((ck / r._count) * 100).toFixed(1).replace(".", ",")}%` : "-"}</td>
                    <td className="r"><b style={cv ? { color: "var(--lagoon)" } : undefined}>{brl(r?._sum.value ?? 0, 0)}</b> <small className="dim">{cv}</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : !sp.nova && <div className="empty-art"><Megaphone size={26} className="dim" /><div>Nenhuma campanha ainda. Crie a primeira: escolha o público (um segmento da matriz RFM ou uma lista), a mensagem e a data.</div></div>}
    </>
  );
}
