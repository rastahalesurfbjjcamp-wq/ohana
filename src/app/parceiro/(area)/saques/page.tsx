import { Header, Kpi, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { brlc } from "@/lib/ledger";
import { pedirSaque } from "../../acoes";
import { fmtDay, partnerArea } from "../data";

export const dynamic = "force-dynamic";

export default async function Saques({ searchParams }: { searchParams: Promise<{ saque?: string; msg?: string }> }) {
  const sp = await searchParams;
  const { p, b, prog } = await partnerArea();
  const wds = await db.partnerWithdrawal.findMany({ where: { referralId: p.id, OR: [{ legacy: false }, ...(p.portalAt ? [{ requestedAt: { gte: p.portalAt } }] : [])] }, orderBy: { requestedAt: "desc" }, take: 30 });
  const open = wds.find((w) => w.status === "solicitado");
  const canWithdraw = !open && b.availableCents >= prog.minWithdrawCents;
  return (
    <>
      <Header title="Saques" lede={`Saque quando quiser, a partir de ${brlc(prog.minWithdrawCents)}. Se preferir, deixe acumular e peça tudo de uma vez.`} />
      {sp.saque === "ok" && <div className="ok">Pedido de saque enviado. A equipe confere e paga no Pix informado.</div>}
      {sp.saque === "erro" && <div className="err">{sp.msg ?? "Não deu certo, tente de novo."}</div>}
      <div className="grid g4">
        <Kpi label="Saldo disponível" value={brlc(Math.max(0, b.availableCents))} tone="k" />
        <Kpi label="Em análise" value={brlc(b.requestedCents)} tone="s" />
        <Kpi label="A liberar" value={brlc(b.pendingCents)} tone="l" />
        <Kpi label="Já recebido" value={brlc(b.paidCents)} tone="p" />
      </div>
      <Panel title="Pedir saque" sub="O valor cai no seu Pix depois que a equipe confere">
        <form action={pedirSaque} className="pt-form">
          <div className="field"><label>Valor</label><input className="in" name="amount" inputMode="decimal" defaultValue={b.availableCents > 0 ? (b.availableCents / 100).toFixed(2).replace(".", ",") : ""} disabled={!canWithdraw} /></div>
          <div className="field"><label>Chave Pix</label><input className="in" name="pix" defaultValue={p.pixKey ?? ""} placeholder="CPF, e-mail, telefone ou aleatória" disabled={!canWithdraw} /></div>
          <button className="btn pri" type="submit" disabled={!canWithdraw} style={{ height: 42, justifyContent: "center" }}>Pedir saque</button>
        </form>
        {!canWithdraw && <p className="dim" style={{ fontSize: 12.5, marginTop: 10 }}>{open ? "Você já tem um saque em análise. Assim que ele for pago, pode pedir outro." : `Saldo abaixo do mínimo de ${brlc(prog.minWithdrawCents)}.`}</p>}
      </Panel>
      <Panel title="Seus saques" body={false}>
        {wds.length ? (
          <table className="tb" data-nosort>
            <thead><tr><th>Pedido em</th><th>Chave Pix</th><th>Situação</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
            <tbody>{wds.map((w) => (
              <tr key={w.id}>
                <td>{fmtDay(w.requestedAt)}</td>
                <td className="dim">{w.pixKey ?? "-"}</td>
                <td>{w.status === "pago" ? <span className="chip pt-ok">Pago{w.paidAt ? ` em ${fmtDay(w.paidAt)}` : ""}</span> : w.status === "recusado" ? <span className="chip pt-no">Não aprovado</span> : <span className="chip pt-wait">Em análise</span>}{w.status === "recusado" && w.note && !w.legacy ? <span className="dim" style={{ fontSize: 12, marginLeft: 8 }}>{w.note}</span> : null}</td>
                <td style={{ textAlign: "right" }}><b>{brlc(w.amountCents)}</b></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className="pb mut">Nenhum saque ainda.</div>}
      </Panel>
    </>
  );
}
