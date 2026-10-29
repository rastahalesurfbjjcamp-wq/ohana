import Link from "next/link";
import { Plus, Send, Sparkles, X } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatPhone } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { brl } from "@/lib/time";
import { Header, Panel } from "@/components/ui";
import { NumberInput } from "@/components/NumberInput";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { genReferrals, invitePartner, saveReferral, sendReferralCodes, updatePartner } from "../acoes3";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { atleta: "Atleta", comunidade: "Comunidade", cliente: "Cliente" };

export default async function Indique({ searchParams }: { searchParams: Promise<{ ok?: string; gerados?: string; erro?: string; k?: string; convidar?: string; criado?: string; regras?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const all = await db.referral.findMany({ orderBy: [{ revenue: "desc" }, { uses: "desc" }, { createdAt: "desc" }] });
  const k = sp.k && KIND[sp.k] ? sp.k : "todos";
  const refs = (k === "todos" ? all : all.filter((r) => r.kind === k)).slice(0, 200);
  const uses = all.reduce((a, r) => a + r.uses, 0);
  const revenue = all.reduce((a, r) => a + r.revenue, 0);
  const clicks = all.reduce((a, r) => a + r.clicks, 0);
  const commission = revenue * (s.referral.commission / 100);
  const active = all.filter((r) => r.uses > 0 || r.clicks > 0);
  const linkBase = `${env.appUrl().replace(/\/$/, "")}/r/`;
  const sample = all[0]?.code ?? "CODIGO10";

  return (
    <>
      <Header title="Indique e ganhe" lede={`Comunidade, clientes e atletas indicando a ${env.storeName()}. Cada um com cupom e link próprios.`}>
        <Link className="btn" href={sp.regras ? "/indique" : "/indique?regras=1"}>Regras do programa</Link>
        <Link className="btn pri" href={sp.convidar ? "/indique" : "/indique?convidar=1"}><Plus size={16} /> Convidar parceiro</Link>
      </Header>
      {sp.ok && <div className="ok">Salvo.</div>}
      {sp.criado && <div className="ok">Parceiro criado com o cupom {sp.criado}. O link dele é {linkBase}{sp.criado}.</div>}
      {sp.gerados && <div className="ok">{sp.gerados} códigos criados na Shopify.</div>}
      {sp.erro && sp.erro !== "nome" && <div className="err">Não consegui criar o cupom: {sp.erro}. Confira se o app da Shopify tem a permissão de descontos.</div>}

      {sp.convidar && (
        <Panel title="Convidar parceiro" sub={`O cupom é criado na Shopify com ${s.referral.percent}% de desconto para quem compra.`} right={<Link className="menu-b" href="/indique" aria-label="Fechar"><X size={16} /></Link>}>
          <form action={invitePartner} className="row" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ flex: 1, minWidth: 180 }}><label>Nome</label><input className="in" name="name" required placeholder="Ex.: Pitbull" /></div>
            <div className="field" style={{ minWidth: 170 }}><label>WhatsApp (opcional)</label><input className="in" name="phone" placeholder="21 99999-9999" inputMode="tel" /></div>
            <div className="field" style={{ width: 160 }}><label>Cupom</label><input className="in" name="code" placeholder="PITBULL10" style={{ textTransform: "uppercase" }} /></div>
            <div className="field" style={{ width: 150 }}><label>Tipo</label><select className="in" name="kind" defaultValue="atleta"><option value="atleta">Atleta</option><option value="comunidade">Comunidade</option><option value="cliente">Cliente</option></select></div>
            <div className="field" style={{ width: 170 }}><label>Recebe por</label><select className="in" name="payout" defaultValue="pix"><option value="pix">Pix</option><option value="credito">Crédito na loja</option></select></div>
            <button className="btn pri" type="submit">Criar cupom</button>
          </form>
          {sp.erro === "nome" && <div className="err" style={{ marginTop: 10 }}>Coloque o nome do parceiro.</div>}
        </Panel>
      )}

      <div className="grid g4">
        <div className="pnl kpi hl"><small>Vendas por indicação</small><span className="num up" style={{ fontSize: 32 }}>{brl(revenue, 0)}</span><div className="sub">{uses} pedidos sem custo de anúncio · 120 dias</div></div>
        <div className="pnl kpi"><small>Comissão a pagar</small><span className="num" style={{ color: "var(--sun)" }}>{brl(commission, 0)}</span><div className="sub">{s.referral.commission}% · libera {s.referral.releaseDays} dias após entregue</div></div>
        <div className="pnl kpi"><small>Parceiros ativos</small><span className="num">{active.length}</span><div className="sub">{all.filter((r) => r.kind === "atleta").length} atletas · {all.filter((r) => r.kind === "comunidade").length} da comunidade · {all.filter((r) => r.kind === "cliente").length} clientes</div></div>
        <div className="pnl kpi"><small>Cliques nos links</small><span className="num">{clicks.toLocaleString("pt-BR")}</span><div className="sub">{clicks ? `conversão ${((uses / clicks) * 100).toFixed(1).replace(".", ",")}%` : "pelo link /r/cupom"}</div></div>
      </div>

      <div className="cols c-2-1" style={{ alignItems: "start" }}>
        <Panel title="Ranking de parceiros" body={false}
          right={<div className="chips">{[["todos", "Todos"], ["atleta", "Atletas"], ["comunidade", "Comunidade"], ["cliente", "Clientes"]].map(([kk, l]) => <Link key={kk} href={`/indique${kk === "todos" ? "" : `?k=${kk}`}`} className={k === kk ? "on" : ""}>{l}</Link>)}</div>}>
          {refs.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="tb">
                <thead><tr><th>#</th><th>Parceiro</th><th>Cupom</th><th className="r">Cliques</th><th className="r">Vendas</th><th className="r">Faturado</th><th className="r">Comissão</th><th>Forma</th></tr></thead>
                <tbody>
                  {refs.map((r, i) => (
                    <tr key={r.id}>
                      <td className={i < 3 && r.revenue > 0 ? "" : "dim"} style={i === 0 && r.revenue > 0 ? { color: "var(--sun)", fontWeight: 700 } : { fontWeight: 600 }}>{i + 1}</td>
                      <td><b style={{ fontWeight: 600 }}>{r.name ?? "Parceiro"}</b><div className="dim" style={{ fontSize: 12 }}>{KIND[r.kind] ?? r.kind}{r.phone.startsWith("sem-") ? "" : ` · ${formatPhone(r.phone)}`}</div></td>
                      <td><span className="trk" style={i === 0 && r.revenue > 0 ? { color: "var(--sun)" } : undefined}>{r.code}</span></td>
                      <td className="r">{r.clicks}</td>
                      <td className="r">{r.uses}</td>
                      <td className="r"><b>{brl(r.revenue, 0)}</b></td>
                      <td className="r up" style={{ fontWeight: 650 }}>{brl(r.revenue * (s.referral.commission / 100), 0)}</td>
                      <td>
                        <form action={updatePartner}>
                          <input type="hidden" name="id" value={r.id} />
                          <select className="mini-sel" name="payout" defaultValue={r.payout} aria-label="Forma de pagamento">
                            <option value="pix">Pix</option><option value="credito">Crédito na loja</option>
                          </select>
                          <button className="btn sm ghost" type="submit" title="Salvar">ok</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-art"><Sparkles size={26} className="dim" /><div>Nenhum parceiro ainda. Convide um atleta ou gere códigos para os clientes VIP.</div></div>}
        </Panel>

        <div className="stack">
          <Panel title="Como funciona" sub="Configuração do programa">
            <form action={saveReferral} className="stack" style={{ gap: 8 }}>
              <div className="cfg-row"><span>Desconto para quem compra</span><NumberInput size="sm" name="percent" defaultValue={s.referral.percent} suffix="%" min={1} max={50} /></div>
              <div className="cfg-row"><span>Comissão do parceiro</span><NumberInput size="sm" name="commission" defaultValue={s.referral.commission} suffix="%" max={50} /></div>
              <div className="cfg-row"><span>Libera a comissão</span><NumberInput size="sm" name="releaseDays" defaultValue={s.referral.releaseDays} suffix="dias" /></div>
              <div><button className="btn sm" type="submit">Salvar regras</button></div>
            </form>
            <div className="ib-sec">Link do parceiro</div>
            <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              <span className="trk" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "9px 10px" }}>{linkBase.replace(/^https?:\/\//, "")}{sample}</span>
              <CopyButton text={`${linkBase}${sample}`} className="btn sm" />
            </div>
            <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>O link conta o clique e abre a loja com o cupom já aplicado.</p>
          </Panel>
          <Panel title="Códigos para clientes">
            <form action={genReferrals} className="row" style={{ flexWrap: "nowrap" }}>
              <select className="in" name="segment" defaultValue="vip">
                <option value="vip">Clientes VIP</option>
                <option value="recorrentes">Clientes recorrentes</option>
                <option value="todos">Todos os clientes</option>
              </select>
              <button className="btn" type="submit">Gerar 50</button>
            </form>
            <form action={sendReferralCodes} style={{ marginTop: 10 }}>
              <ConfirmButton className="btn pri" disabled={!all.some((r) => r.uses === 0 && !r.phone.startsWith("sem-"))} message="Mandar o código de cada cliente no WhatsApp, aos poucos?"><Send size={15} /> Mandar os códigos no WhatsApp</ConfirmButton>
            </form>
          </Panel>
          {sp.regras && (
            <Panel title="Mensagem com o código" sub="{nome}, {codigo}, {percent} e {loja}">
              <form action={saveReferral} className="stack">
                <label className="check"><input type="checkbox" name="enabled" defaultChecked={s.referral.enabled} /> Programa ligado</label>
                <textarea className="in" name="shareText" defaultValue={s.referral.shareText} />
                <div><button className="btn" type="submit">Salvar</button></div>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
