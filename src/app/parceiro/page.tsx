import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentPartner } from "@/lib/partnerAuth";
import { balanceOf, brlc, monthLabel, monthOf, program, releaseOf, syncLedger } from "@/lib/ledger";
import { partnerLink } from "@/lib/partners";
import { CopyButton } from "@/components/CopyButton";
import { pedirSaque, sairParceiro } from "./acoes";

export const dynamic = "force-dynamic";

const fmtDay = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });
const shortMonth = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");

export default async function Parceiro({ searchParams }: { searchParams: Promise<{ saque?: string; msg?: string; bemvindo?: string }> }) {
  const p = await currentPartner();
  if (!p) redirect("/parceiro/entrar");
  const sp = await searchParams;
  await syncLedger().catch(() => null);
  const [b, prog, s, entries, wds] = await Promise.all([
    balanceOf(p.id),
    program(),
    getSettings(),
    db.partnerEarning.findMany({ where: { referralId: p.id }, orderBy: [{ orderAt: "desc" }, { createdAt: "desc" }], take: 40 }),
    db.partnerWithdrawal.findMany({ where: { referralId: p.id }, orderBy: { requestedAt: "desc" }, take: 20 }),
  ]);
  const pct = p.commissionPct ?? s.referral.commission;
  const now = new Date();
  const cur = monthOf(now);
  const nextRelease = releaseOf(cur, prog.releaseDay);
  const link = s.postsale.storeUrl ? partnerLink(s.postsale.storeUrl, p.code) : "";
  const tiers = [...prog.tiers].filter((t) => t.minCents > 0).sort((a, b) => a.minCents - b.minCents);
  const reached = [...tiers].reverse().find((t) => b.monthCents >= t.minCents);
  const next = tiers.find((t) => b.monthCents < t.minCents);
  const goal = next ?? tiers[tiers.length - 1];
  const miles = [...prog.milestones].filter((m) => m.minCents > 0).sort((a, b) => a.minCents - b.minCents);
  const mile = miles.find((m) => b.lifetimeCents < m.minCents);
  const open = wds.find((w) => w.status === "solicitado");
  const canWithdraw = !open && b.availableCents >= prog.minWithdrawCents;
  // últimos 6 meses
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15)); months.push(d.toISOString().slice(0, 7)); }
  const mv = months.map((m) => ({ m, ...(b.months.find((x) => x.month === m) ?? { cents: 0, bonusCents: 0 }) }));
  const max = Math.max(1, ...mv.map((x) => x.cents + x.bonusCents));
  const first = (p.name ?? "").split(" ")[0] || p.code;
  const share = `Usa meu cupom ${p.code} na Rasta Hale${link ? `: ${link}` : ""}`;

  return (
    <>
      <div className="pp-top"><div className="in">
        <a className="pp-brand" href="/parceiro">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lion.png" alt="" />
          <span><b>RASTA HALE</b><small>PARCEIROS</small><span className="pp-stripe"><i /><i /><i /></span></span>
        </a>
        <form action={sairParceiro}><button className="pp-out" type="submit">Sair</button></form>
      </div></div>

      <main className="pp-main">
        {sp.bemvindo && <div className="pp-msg ok">Senha criada. Esta é a sua área: aqui você acompanha sua comissão e pede seus saques.</div>}
        <div className="pp-hi">
          <div>
            <h1 className="tw">Fala, {first}</h1>
            <p>Seu acordo: <b>{pct.toLocaleString("pt-BR")}% de comissão</b> sobre o valor dos produtos de cada venda com o seu cupom. Frete não entra e pedido cancelado não conta.</p>
          </div>
        </div>

        <div className="pp-grid">
          <div className="pp-card dark">
            <small>Saldo disponível</small>
            <b className="v">{brlc(Math.max(0, b.availableCents))}</b>
            <span className="s">{open ? `Saque de ${brlc(open.amountCents)} em análise` : "Pronto para sacar"}</span>
          </div>
          <div className="pp-card">
            <small>A liberar</small>
            <b className="v">{brlc(b.pendingCents)}</b>
            <span className="s">Comissão do mês em andamento. Entra no saldo em {fmtDay(nextRelease)}.</span>
          </div>
          <div className="pp-card">
            <small>Comissão em {monthLabel(cur).split(" ")[0]}</small>
            <b className="v">{brlc(b.monthCents)}</b>
            <span className="s">{reached ? `Meta batida: +${brlc(reached.bonusCents)} de bônus` : next ? `Faltam ${brlc(next.minCents - b.monthCents)} para o bônus` : "Siga divulgando"}</span>
          </div>
          <div className="pp-card">
            <small>Já recebido</small>
            <b className="v">{brlc(b.paidCents)}</b>
            <span className="s">Total ganho com a Rasta: {brlc(b.lifetimeCents)}</span>
          </div>
        </div>

        <div className="pp-two pp-sec">
          <div className="pp-card">
            <small>Meta do mês</small>
            {goal ? (
              <>
                <div style={{ fontSize: 15, marginTop: 8 }}>{next ? <>Chegue a <b>{brlc(next.minCents)}</b> de comissão em {monthLabel(cur).split(" ")[0]} e ganhe <b>+{brlc(next.bonusCents)}</b> de bônus.</> : <>Você bateu a maior meta do mês. Bônus de <b>{brlc(reached!.bonusCents)}</b> garantido.</>}</div>
                <div className="pp-bar"><i className="y" style={{ width: `${Math.min(100, (b.monthCents / goal.minCents) * 100)}%` }} /></div>
                <div style={{ fontSize: 12.5, color: "#666" }}>{brlc(b.monthCents)} de {brlc(goal.minCents)}</div>
                {tiers.length > 1 && <div className="pp-tiers">{tiers.map((t) => <div key={t.minCents} className={`pp-tier${b.monthCents >= t.minCents ? " on" : ""}`}><span>{brlc(t.minCents)} em comissão</span><span>+{brlc(t.bonusCents)}</span></div>)}</div>}
                <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>O bônus entra no saldo junto com a comissão do mês, em {fmtDay(nextRelease)}.</div>
              </>
            ) : <div style={{ fontSize: 14, marginTop: 8, color: "#666" }}>Sem meta de bônus no momento.</div>}
            {mile && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #ecebe6" }}>
                <small>Próxima premiação</small>
                <div style={{ fontSize: 14.5, marginTop: 8 }}>Ao chegar em <b>{brlc(mile.minCents)}</b> ganhos com a Rasta: <b>{mile.prize}</b></div>
                <div className="pp-bar"><i style={{ width: `${Math.min(100, (b.lifetimeCents / mile.minCents) * 100)}%` }} /></div>
                <div style={{ fontSize: 12.5, color: "#666" }}>{brlc(b.lifetimeCents)} de {brlc(mile.minCents)}</div>
              </div>
            )}
          </div>
          <div className="pp-card">
            <small>Seu cupom</small>
            <div className="pp-code">{p.code}</div>
            {link && (
              <>
                <small style={{ marginTop: 16 }}>Seu link de indicação</small>
                <div className="pp-link"><input readOnly value={link} /><CopyButton text={link} label="Copiar" className="pp-btn line" /></div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <a className="pp-btn" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener">Mandar no WhatsApp</a>
                  <CopyButton text={share} label="Copiar texto" className="pp-btn line" />
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 10, lineHeight: 1.5 }}>O link já abre a loja com o seu cupom aplicado. Deixe na bio e use nos stories.</div>
              </>
            )}
          </div>
        </div>

        <div className="pp-sec pp-card">
          <small>Comissão por mês</small>
          <div className="pp-months">
            {mv.map((x) => (
              <div key={x.m}>
                <em>{x.cents + x.bonusCents ? brlc(x.cents + x.bonusCents).replace(",00", "") : ""}</em>
                <i style={{ height: `${(x.cents / max) * 100}%` }} />
                {x.bonusCents > 0 && <i className="b" style={{ height: `${(x.bonusCents / max) * 100}%`, marginTop: -6 }} />}
                <span>{shortMonth(x.m)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pp-sec" id="saque">
          <h2 className="tw">Saque</h2>
          {sp.saque === "ok" && <div className="pp-msg ok">Pedido de saque enviado. A equipe confere e paga no Pix informado.</div>}
          {sp.saque === "erro" && <div className="pp-msg err">{sp.msg ?? "Não deu certo, tente de novo."}</div>}
          <div className="pp-card">
            <div style={{ fontSize: 14 }}>Você pode sacar o saldo disponível quando quiser, a partir de {brlc(prog.minWithdrawCents)}. Se preferir, deixe acumular e peça tudo de uma vez.</div>
            <form action={pedirSaque} className="pp-form">
              <label>Valor<input name="amount" inputMode="decimal" defaultValue={b.availableCents > 0 ? (b.availableCents / 100).toFixed(2).replace(".", ",") : ""} disabled={!canWithdraw} /></label>
              <label>Chave Pix<input name="pix" defaultValue={p.pixKey ?? ""} placeholder="CPF, e-mail, telefone ou aleatória" disabled={!canWithdraw} /></label>
              <button className="pp-btn" type="submit" disabled={!canWithdraw}>Pedir saque</button>
            </form>
            {!canWithdraw && <div style={{ fontSize: 12.5, color: "#888", marginTop: 8 }}>{open ? "Você já tem um saque em análise." : `Saldo abaixo do mínimo de ${brlc(prog.minWithdrawCents)}.`}</div>}
          </div>
          {wds.length > 0 && (
            <table className="pp-tb" style={{ marginTop: 12 }}>
              <thead><tr><th>Pedido em</th><th>Situação</th><th className="r">Valor</th></tr></thead>
              <tbody>{wds.map((w) => <tr key={w.id}><td>{fmtDay(w.requestedAt)}</td><td>{w.status === "pago" ? <span className="pp-tag ok">Pago {w.paidAt ? `em ${fmtDay(w.paidAt)}` : ""}</span> : w.status === "recusado" ? <span className="pp-tag no">Não aprovado</span> : <span className="pp-tag wait">Em análise</span>}{w.note && !w.legacy && w.status === "recusado" ? <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>{w.note}</span> : null}</td><td className="r">{brlc(w.amountCents)}</td></tr>)}</tbody>
            </table>
          )}
        </div>

        <div className="pp-sec">
          <h2 className="tw">Extrato</h2>
          {entries.length ? (
            <table className="pp-tb">
              <thead><tr><th>Data</th><th>Lançamento</th><th>Situação</th><th className="r">Comissão</th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDay(e.orderAt ?? e.createdAt)}</td>
                    <td>{e.kind === "venda" ? `Venda ${e.orderName ?? ""}` : e.kind === "estorno" ? `${e.note ?? "Estorno"} ${e.orderName ?? ""}` : e.kind === "bonus" ? `Bônus de ${monthLabel(e.month)}` : e.note ?? "Ajuste"}</td>
                    <td>{e.availableAt <= now ? <span className="pp-tag ok">No saldo</span> : <span className="pp-tag wait">Libera {fmtDay(e.availableAt)}</span>}</td>
                    <td className={`r${e.amountCents < 0 ? " pp-neg" : ""}`}>{brlc(e.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="pp-card" style={{ fontSize: 14, color: "#666" }}>Ainda não tem venda com o seu cupom. Assim que sair a primeira, ela aparece aqui.</div>}
        </div>
      </main>
    </>
  );
}
