import { Header, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { brlc, countable, monthLabel } from "@/lib/ledger";
import { fmtDay, partnerArea } from "../data";

export const dynamic = "force-dynamic";

export default async function Extrato() {
  const { p, b } = await partnerArea();
  const now = new Date();
  const all = await db.partnerEarning.findMany({ where: { referralId: p.id }, orderBy: [{ createdAt: "desc" }], take: 400 });
  const entries = all.filter((e) => countable(e, p.portalAt)).sort((x, y) => (y.orderAt ?? y.createdAt).getTime() - (x.orderAt ?? x.createdAt).getTime());
  return (
    <>
      <Header title="Extrato" lede={`Cada venda com o seu cupom, bônus e premiações. Total ganho: ${brlc(b.lifetimeCents)}.`} />
      <Panel title="Lançamentos" sub={`${entries.length} lançamentos`} body={false}>
        {entries.length ? (
          <table className="tb" data-nosort>
            <thead><tr><th>Data</th><th>Lançamento</th><th>Situação</th><th style={{ textAlign: "right" }}>Comissão</th></tr></thead>
            <tbody>{entries.map((e) => (
              <tr key={e.id}>
                <td>{fmtDay(e.orderAt ?? e.createdAt)}</td>
                <td>{e.kind === "venda" ? `Venda ${e.orderName ?? ""}` : e.kind === "estorno" ? `${e.note ?? "Estorno"} ${e.orderName ?? ""}` : e.key.startsWith("premio:") ? (e.note ?? "Premiação") : e.kind === "bonus" ? `Bônus de ${monthLabel(e.month)}` : e.note ?? "Ajuste"}</td>
                <td>{e.availableAt <= now ? <span className="chip pt-ok">No saldo</span> : <span className="chip pt-wait">Libera {fmtDay(e.availableAt)}</span>}</td>
                <td style={{ textAlign: "right", color: e.amountCents < 0 ? "var(--coral)" : undefined }}><b>{brlc(e.amountCents)}</b></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className="pb mut">Ainda não tem venda com o seu cupom. Assim que sair a primeira, ela aparece aqui.</div>}
      </Panel>
    </>
  );
}
