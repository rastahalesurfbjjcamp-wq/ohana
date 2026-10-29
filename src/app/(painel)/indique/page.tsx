import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { brl } from "@/lib/time";
import { Header, Kpi, Panel } from "@/components/ui";
import { genReferrals, saveReferral, sendReferralCodes } from "../acoes3";

export const dynamic = "force-dynamic";

export default async function Indique({ searchParams }: { searchParams: Promise<{ ok?: string; gerados?: string; erro?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const refs = await db.referral.findMany({ orderBy: [{ uses: "desc" }, { createdAt: "desc" }], take: 200 });
  const uses = refs.reduce((a, r) => a + r.uses, 0);
  const revenue = refs.reduce((a, r) => a + r.revenue, 0);
  return (
    <>
      <Header title="Indique e ganhe" lede={`Cada cliente ganha um cupom com o próprio nome. Quem usa ganha ${s.referral.percent}% de desconto, e você vê quem mais indica.`} />
      {sp.ok && <div className="ok">Salvo.</div>}
      {sp.gerados && <div className="ok">{sp.gerados} códigos criados na Shopify.</div>}
      {sp.erro && <div className="err">Não consegui criar os cupons: {sp.erro}. Confira se o token da Shopify tem a permissão write_discounts.</div>}
      <div className="grid g4">
        <Kpi label="Clientes com código" value={refs.length} />
        <Kpi label="Usos dos cupons" value={uses} sub="atualiza a cada 6 horas" />
        <Kpi label="Vendas por indicação" value={brl(revenue, 0)} />
        <Kpi label="Desconto" value={`${s.referral.percent}%`} />
      </div>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Quem mais indica" body={false}>
          {refs.length ? (
            <table className="tb">
              <thead><tr><th>Cliente</th><th>Código</th><th className="r">Usos</th><th className="r">Vendas</th></tr></thead>
              <tbody>
                {refs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name ?? "Cliente"}<div className="dim" style={{ fontSize: 12 }}>{formatPhone(r.phone)}</div></td>
                    <td><span className="chip c-k">{r.code}</span></td>
                    <td className="r">{r.uses}</td>
                    <td className="r">{brl(r.revenue, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty">Nenhum código ainda. Gere ao lado.</div>}
        </Panel>
        <div className="stack">
          <Panel title="Gerar códigos">
            <form action={genReferrals} className="row">
              <select className="in" name="segment" defaultValue="vip" style={{ width: 200 }}>
                <option value="vip">Clientes VIP</option>
                <option value="recorrentes">Clientes recorrentes</option>
                <option value="todos">Todos os clientes</option>
              </select>
              <button className="btn pri" type="submit">Gerar (até 50 por vez)</button>
            </form>
            <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>Os cupons são criados na Shopify com a etiqueta indique-e-ganhe.</p>
          </Panel>
          <Panel title="Mensagem com o código">
            <form action={saveReferral} className="stack">
              <label className="check"><input type="checkbox" name="enabled" defaultChecked={s.referral.enabled} /> Programa ligado</label>
              <div className="row"><span className="mut" style={{ fontSize: 13 }}>Desconto de</span><input className="in" name="percent" defaultValue={s.referral.percent} style={{ width: 70, height: 32 }} /><span className="mut" style={{ fontSize: 13 }}>%</span></div>
              <textarea className="in" name="shareText" defaultValue={s.referral.shareText} />
              <div><button className="btn" type="submit">Salvar</button></div>
            </form>
            <form action={sendReferralCodes} style={{ marginTop: 12 }}>
              <button className="btn pri" type="submit" disabled={!refs.length}>Mandar os códigos no WhatsApp</button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
