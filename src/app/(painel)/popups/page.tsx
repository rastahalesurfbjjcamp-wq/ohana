import Link from "next/link";
import { Copy, MessageCircle, Power, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { Header, Kpi, Panel } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";
import { POPUP_KINDS, cfgOf } from "@/lib/popups";
import { createPopup, deletePopup, duplicatePopup, saveWaButton, togglePopup } from "../acoes14";

export const dynamic = "force-dynamic";

const WHEN: Record<string, string> = { imediato: "Assim que abre", segundos: "Depois de alguns segundos", rolagem: "Ao rolar a página", saida: "Ao sair", inatividade: "Parado na página" };

export default async function Popups({ searchParams }: { searchParams: Promise<{ wa?: string }> }) {
  const sp = await searchParams;
  const [list, waS] = await Promise.all([
    db.popup.findMany({ orderBy: { createdAt: "desc" } }),
    db.setting.findUnique({ where: { key: "_popup_wa" } }).catch(() => null),
  ]);
  const wa = (waS?.value ?? {}) as { on?: boolean; phone?: string; text?: string; label?: string; pos?: string };
  const views = list.reduce((s, p) => s + p.views, 0);
  const leads = list.reduce((s, p) => s + p.leads, 0);
  const snippet = `<script src="${env.appUrl()}/api/popups/script.js" async></script>`;
  return (
    <>
      <Header title="Popups do site" lede="Capture o WhatsApp de quem visita a loja com cupom, roleta, raspadinha ou convite para o grupo." />
      {sp.wa && <div className="ok">Botão do WhatsApp salvo.</div>}
      <div className="grid g4">
        <Kpi label="Popups ligados" value={list.filter((p) => p.active).length} sub={`${list.length} no total`} tone="k" />
        <Kpi label="Exibições" value={views.toLocaleString("pt-BR")} tone="s" />
        <Kpi label="Cadastros" value={leads.toLocaleString("pt-BR")} tone="l" />
        <Kpi label="Conversão" value={views ? `${((leads / views) * 100).toFixed(1).replace(".", ",")}%` : "-"} sub="cadastros por exibição" tone="l" />
      </div>

      <Panel title="Criar popup" sub="Escolha um modelo. Dá para mudar tudo depois.">
        <div className="pu-gal">
          {POPUP_KINDS.map((k) => (
            <form key={k.k} action={createPopup}>
              <input type="hidden" name="kind" value={k.k} />
              <button type="submit" className={`pu-k pu-k-${k.k}`}>
                <span className="pu-thumb"><i /><em /><b /></span>
                <strong>{k.label}</strong>
                <small>{k.desc}</small>
              </button>
            </form>
          ))}
        </div>
      </Panel>

      <Panel title="Seus popups" body={false}>
        {list.length ? (
          <table className="tb">
            <thead><tr><th>Popup</th><th>Quando aparece</th><th style={{ textAlign: "right" }}>Exibições</th><th style={{ textAlign: "right" }}>Cadastros</th><th style={{ textAlign: "right" }}>Conversão</th><th /></tr></thead>
            <tbody>
              {list.map((p) => {
                const c = cfgOf(p);
                return (
                  <tr key={p.id}>
                    <td><Link href={`/popups/${p.id}`} className="row" style={{ gap: 10 }}><span className={`pu-dot${p.active ? " on" : ""}`} /><span><b>{p.name}</b><br /><small className="dim">{POPUP_KINDS.find((k) => k.k === p.kind)?.label ?? p.kind} · {p.active ? "Ligado" : "Desligado"}</small></span></Link></td>
                    <td className="dim">{c.layout === "barra" ? "Faixa no topo" : WHEN[c.trigger.when]}{c.trigger.when === "segundos" && c.layout !== "barra" ? ` (${c.trigger.seconds}s)` : ""}</td>
                    <td style={{ textAlign: "right" }}>{p.views.toLocaleString("pt-BR")}</td>
                    <td style={{ textAlign: "right" }}>{p.leads.toLocaleString("pt-BR")}</td>
                    <td style={{ textAlign: "right" }}>{p.views ? `${((p.leads / p.views) * 100).toFixed(1).replace(".", ",")}%` : "-"}</td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <form action={togglePopup}><input type="hidden" name="id" value={p.id} /><ConfirmButton className={`btn sm${p.active ? "" : " pri"}`} message={p.active ? "Desligar o popup no site?" : "Ligar o popup no site? Ele aparece para os visitantes assim que o script estiver no tema."}><Power size={13} /> {p.active ? "Desligar" : "Ligar"}</ConfirmButton></form>
                        <Link className="btn sm" href={`/popups/${p.id}`}>Editar</Link>
                        <form action={duplicatePopup}><input type="hidden" name="id" value={p.id} /><button className="btn sm ghost" title="Duplicar"><Copy size={13} /></button></form>
                        <form action={deletePopup}><input type="hidden" name="id" value={p.id} /><ConfirmButton className="btn sm ghost danger" message="Apagar este popup?"><Trash2 size={13} /></ConfirmButton></form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <div className="empty">Nenhum popup ainda. Escolha um modelo acima.</div>}
      </Panel>

      <div className="cols" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <Panel title="Instalar no site" sub="Uma vez só. Depois é só ligar e desligar por aqui.">
          <ol className="pu-steps">
            <li>Na Shopify, abra <b>Loja virtual &gt; Temas &gt; ... &gt; Editar código</b>.</li>
            <li>Abra o arquivo <b>theme.liquid</b>.</li>
            <li>Cole o código abaixo logo antes de <code>&lt;/body&gt;</code> e salve.</li>
          </ol>
          <pre className="pu-code">{snippet}</pre>
          <CopyButton text={snippet} label="Copiar código" className="btn sm" />
          <small className="dim" style={{ display: "block", marginTop: 10 }}>Os popups não aparecem no checkout nem no carrinho por padrão. Quem já se cadastrou não vê de novo.</small>
        </Panel>
        <Panel title="Botão do WhatsApp" sub="Botão verde flutuante em todas as páginas da loja">
          <form action={saveWaButton} className="stack" style={{ gap: 10 }}>
            <label className="row" style={{ gap: 8 }}><input type="checkbox" name="on" value="1" defaultChecked={!!wa.on} /> Mostrar o botão no site</label>
            <label className="cv-field">Número (com DDD)<input className="in" name="phone" defaultValue={wa.phone ?? ""} placeholder="5521999999999" inputMode="tel" /></label>
            <label className="cv-field">Mensagem que já vem escrita<input className="in" name="text" defaultValue={wa.text ?? "Oi! Vim pelo site e tenho uma dúvida."} /></label>
            <div className="row" style={{ gap: 10 }}>
              <label className="cv-field" style={{ flex: 1 }}>Texto do botão (opcional)<input className="in" name="label" defaultValue={wa.label ?? ""} placeholder="Fale com a gente" /></label>
              <label className="cv-field">Lado<select className="in" name="pos" defaultValue={wa.pos ?? "direita"}><option value="direita">Direita</option><option value="esquerda">Esquerda</option></select></label>
            </div>
            <div><button className="btn sm" type="submit"><MessageCircle size={14} /> Salvar</button></div>
          </form>
        </Panel>
      </div>
    </>
  );
}
