import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, MessageCircle, RefreshCcw, Send, X } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { balanceOf, brlc, cents, monthLabel, program, syncLedger } from "@/lib/ledger";
import { Header, Kpi, Panel } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { addAdjustment, invitePartner, manualPayout, payWithdrawal, refuseWithdrawal, revokePartner, savePartnerAccess, saveProgramForm, syncNowLedger } from "../../acoes16";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = { email: "E-mail inválido.", emailuso: "Esse e-mail já está em outro parceiro.", semEmail: "Coloque o e-mail do parceiro antes de gerar o acesso.", valor: "Valor inválido.", ajuste: "Informe o valor e o motivo do ajuste.", admin: "Só o administrador mexe em saques e acordos." };
const fmtDay = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });
const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default async function PortalParceiros({ searchParams }: { searchParams: Promise<{ convite?: string; erro?: string; salvo?: string; pago?: string; sync?: string; p?: string }> }) {
  const sp = await searchParams;
  await syncLedger().catch(() => null);
  const [prog, s, partners, pend] = await Promise.all([
    program(),
    getSettings(),
    db.referral.findMany({ where: { kind: { in: ["atleta", "influenciador"] } }, orderBy: { createdAt: "asc" } }),
    db.partnerWithdrawal.findMany({ where: { status: "solicitado" }, orderBy: { requestedAt: "asc" } }),
  ]);
  const bal = new Map(await Promise.all(partners.map(async (p) => [p.id, await balanceOf(p.id)] as const)));
  const name = new Map(partners.map((p) => [p.id, p.name ?? p.code]));
  const base = env.appUrl().replace(/\/$/, "");
  const inv = sp.convite ? partners.find((p) => p.id === sp.convite) : undefined;
  const invLink = inv?.inviteToken ? `${base}/parceiro/convite/${inv.inviteToken}` : "";
  const invText = inv ? `Fala, ${(inv.name ?? "").split(" ")[0]}! Sua área de parceiro da Rasta Hale está pronta. Lá você vê sua comissão, seu link de indicação e pede saque.\n\nCrie sua senha aqui: ${invLink}\n\nSeu login é ${inv.email}. O link vale por 7 dias. Depois é só entrar em ${base}/parceiro` : "";
  const tot = { avail: 0, pend: 0, month: 0, paid: 0 };
  for (const b of bal.values()) { tot.avail += Math.max(0, b.availableCents); tot.pend += b.pendingCents; tot.month += b.monthCents; tot.paid += b.paidCents; }
  const sel = sp.p ? partners.find((p) => p.id === sp.p) : undefined;
  const selEntries = sel ? await db.partnerEarning.findMany({ where: { referralId: sel.id }, orderBy: { createdAt: "desc" }, take: 80 }) : [];
  const selWds = sel ? await db.partnerWithdrawal.findMany({ where: { referralId: sel.id }, orderBy: { requestedAt: "desc" } }) : [];
  const tiers = [...prog.tiers, { minCents: 0, bonusCents: 0 }, { minCents: 0, bonusCents: 0 }].slice(0, Math.max(3, prog.tiers.length + 1));
  const miles = [...prog.milestones, { minCents: 0, prizeCents: 0 }].slice(0, Math.max(2, prog.milestones.length + 1));

  return (
    <>
      <Header title="Portal dos parceiros" lede={`Comissão, saldo e saques de cada atleta e influenciador. A comissão conta a partir do cadastro de cada um no portal. O acordo padrão é ${s.referral.commission}%.`}>
        <Link className="btn" href="/atletas"><ArrowLeft size={15} /> Atletas</Link>
        <CopyButton text={`${base}/parceiro/cadastro`} label="Copiar link de cadastro" className="btn" />
        <a className="btn" href="/parceiro/entrar" target="_blank" rel="noopener"><ExternalLink size={15} /> Ver o portal</a>
        <form action={syncNowLedger}><button className="btn" type="submit"><RefreshCcw size={15} /> Atualizar vendas</button></form>
      </Header>
      {sp.erro && <div className="err">{ERR[sp.erro] ?? "Confira os dados."}</div>}
      {sp.salvo && <div className="ok">Salvo.</div>}
      {sp.pago && <div className="ok">Pagamento registrado. O saldo do parceiro já foi atualizado.</div>}
      {sp.sync && <div className="ok">Vendas atualizadas.</div>}
      {inv && invLink && (
        <div className="eq-inv">
          <b>Acesso de {inv.name}</b>
          <p className="mut">Mande para o parceiro. Ele cria a senha e já entra na área dele.</p>
          <div className="eq-link"><code>{invLink}</code><CopyButton text={invText} label="Copiar mensagem" className="btn sm" />{!inv.phone.startsWith("sem-") && <a className="btn sm pri" href={`https://wa.me/${inv.phone.replace(/\D/g, "")}?text=${encodeURIComponent(invText)}`} target="_blank" rel="noopener"><MessageCircle size={14} /> Mandar no WhatsApp</a>}</div>
        </div>
      )}

      <div className="grid g4">
        <Kpi label="Saques pedidos" value={pend.length} sub={pend.length ? brlc(pend.reduce((a, w) => a + w.amountCents, 0)) : "nenhum agora"} tone={pend.length ? "s" : "n"} />
        <Kpi label="Saldo disponível" value={brlc(tot.avail)} sub="soma de todos os parceiros" tone="k" />
        <Kpi label="A liberar" value={brlc(tot.pend)} sub={`entra no saldo dia ${prog.releaseDay}`} tone="l" />
        <Kpi label="Já pago" value={brlc(tot.paid)} sub={`desde ${fmtDay(new Date(`${prog.startDate}T12:00:00Z`))}`} tone="l" />
      </div>

      {pend.length > 0 && (
        <Panel title="Saques para pagar" sub="Confira a chave Pix, pague pelo banco e marque como pago" body={false}>
          <table className="tb">
            <thead><tr><th>Parceiro</th><th>Pedido em</th><th>Chave Pix</th><th style={{ textAlign: "right" }}>Valor</th><th /></tr></thead>
            <tbody>
              {pend.map((w) => (
                <tr key={w.id}>
                  <td><b>{name.get(w.referralId)}</b></td>
                  <td className="dim">{fmtDay(w.requestedAt)}</td>
                  <td><div className="row" style={{ gap: 6 }}><code style={{ fontSize: 12.5 }}>{w.pixKey}</code>{w.pixKey && <CopyButton text={w.pixKey} label="" className="btn sm ghost" />}</div></td>
                  <td style={{ textAlign: "right" }}><b>{brlc(w.amountCents)}</b></td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <form action={payWithdrawal}><input type="hidden" name="id" value={w.id} /><ConfirmButton className="btn sm pri" message={`Confirmar que você já pagou ${brlc(w.amountCents)} para ${name.get(w.referralId)}?`}><Check size={13} /> Paguei</ConfirmButton></form>
                      <form action={refuseWithdrawal} className="row" style={{ gap: 6 }}><input type="hidden" name="id" value={w.id} /><input className="in" name="note" placeholder="Motivo (aparece para ele)" style={{ height: 32, width: 180 }} /><ConfirmButton className="btn sm ghost danger" message="Recusar esse saque? O valor volta para o saldo dele."><X size={13} /> Recusar</ConfirmButton></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel title="Parceiros" sub="Acordo, acesso ao portal e saldo de cada um" body={false}>
        <div style={{ overflowX: "auto" }}>
        <table className="tb pt-tb">
          <thead><tr><th>Parceiro</th><th>Acordo (comissão, fixo, mínimo) e e-mail</th><th>Portal</th><th style={{ textAlign: "right" }}>Mês atual</th><th style={{ textAlign: "right" }}>A liberar</th><th style={{ textAlign: "right" }}>Disponível</th><th style={{ textAlign: "right" }}>Pago</th><th /></tr></thead>
          <tbody>
            {partners.map((p) => {
              const b = bal.get(p.id)!;
              return (
                <tr key={p.id}>
                  <td><b>{p.name ?? p.code}</b><br /><small className="dim">{p.code}{p.active ? "" : " · inativo"}</small></td>
                  <td>
                    <form action={savePartnerAccess} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <input type="hidden" name="id" value={p.id} />
                      <span className="row" style={{ gap: 4, flexWrap: "nowrap", whiteSpace: "nowrap" }}><input className="in" name="pct" defaultValue={p.commissionPct ?? ""} placeholder={String(s.referral.commission)} style={{ width: 62, height: 32 }} inputMode="decimal" />%</span>
                      <span className="row" style={{ gap: 4, flexWrap: "nowrap", whiteSpace: "nowrap" }} title="Fixo mensal">Fixo<input className="in" name="fixed" defaultValue={p.fixedMonthly ? reais(cents(p.fixedMonthly)) : ""} placeholder="0" style={{ width: 82, height: 32 }} inputMode="decimal" /></span>
                      <span className="row" style={{ gap: 4, flexWrap: "nowrap", whiteSpace: "nowrap" }} title="Mínimo garantido no mês: recebe o maior entre o mínimo e fixo + comissão">Mín.<input className="in" name="min" defaultValue={p.minMonthly ? reais(cents(p.minMonthly)) : ""} placeholder="0" style={{ width: 82, height: 32 }} inputMode="decimal" /></span>
                      <input className="in" name="email" defaultValue={p.email ?? ""} placeholder="email@do.parceiro" style={{ width: 170, height: 32 }} />
                      <button className="btn sm" type="submit">Salvar</button>
                    </form>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{p.passwordHash ? <span className="chip c-l" title="Comissão conta a partir do cadastro">Cadastrado{p.portalAt ? ` · ${fmtDay(p.portalAt)}` : ""}</span> : p.inviteToken ? <span className="chip c-s">Convite enviado</span> : <span className="chip c-n">Sem acesso</span>}</td>
                  <td style={{ textAlign: "right" }}>{brlc(b.monthCents)}</td>
                  <td style={{ textAlign: "right" }}>{brlc(b.pendingCents)}</td>
                  <td style={{ textAlign: "right" }}><b className={b.availableCents < 0 ? "dn" : ""}>{brlc(b.availableCents)}</b></td>
                  <td style={{ textAlign: "right" }} className="dim">{brlc(b.paidCents)}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <form action={invitePartner}><input type="hidden" name="id" value={p.id} /><button className="btn sm" type="submit" title={p.passwordHash ? "Gerar link para criar uma nova senha" : "Gerar link de acesso"}><Send size={13} /> {p.passwordHash ? "Nova senha" : "Dar acesso"}</button></form>
                      {p.passwordHash && <form action={revokePartner}><input type="hidden" name="id" value={p.id} /><ConfirmButton className="btn sm ghost" message={`Tirar o acesso de ${p.name} ao portal?`}>Tirar acesso</ConfirmButton></form>}
                      <Link className="btn sm ghost" href={`/atletas/portal?p=${p.id}#extrato`}>Extrato</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Panel>

      {sel && (
        <div id="extrato">
          <Panel title={`Extrato de ${sel.name ?? sel.code}`} sub="Cada venda, estorno, bônus, ajuste e saque" right={<Link className="menu-b" href="/atletas/portal"><X size={16} /></Link>}>
            <div className="cols" style={{ gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <form action={addAdjustment} className="row" style={{ gap: 6 }}>
                <input type="hidden" name="id" value={sel.id} />
                <input className="in" name="amount" placeholder="Ajuste (ex.: 50 ou -20)" style={{ width: 170 }} />
                <input className="in" name="note" placeholder="Motivo (aparece para ele)" style={{ flex: 1 }} />
                <ConfirmButton className="btn sm" message="Lançar esse ajuste no saldo do parceiro?">Lançar ajuste</ConfirmButton>
              </form>
              <form action={manualPayout} className="row" style={{ gap: 6 }}>
                <input type="hidden" name="id" value={sel.id} />
                <input className="in" name="amount" placeholder="Pago por fora (R$)" style={{ width: 170 }} />
                <input className="in" name="note" placeholder="Observação" style={{ flex: 1 }} />
                <ConfirmButton className="btn sm" message="Registrar esse pagamento? Ele desconta do saldo do parceiro.">Registrar pagamento</ConfirmButton>
              </form>
            </div>
            <table className="tb">
              <thead><tr><th>Data</th><th>Lançamento</th><th>Base</th><th>Libera</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {[...selEntries.map((e) => ({ at: e.orderAt ?? e.createdAt, key: e.id, txt: e.kind === "venda" ? `Venda ${e.orderName} · ${e.pct}%` : e.kind === "estorno" ? `${e.note} ${e.orderName ?? ""}` : e.kind === "bonus" ? `Bônus de ${monthLabel(e.month)}` : `Ajuste: ${e.note}${e.createdBy ? ` (${e.createdBy})` : ""}`, base: e.baseCents ? brlc(e.baseCents) : "", rel: fmtDay(e.availableAt), v: e.amountCents })),
                  ...selWds.map((w) => ({ at: w.requestedAt, key: w.id, txt: `Saque ${w.status}${w.paidBy ? ` · ${w.paidBy}` : ""}${w.legacy ? " (tela antiga)" : ""}${w.note && !w.legacy ? ` · ${w.note}` : ""}`, base: w.pixKey ?? "", rel: w.paidAt ? fmtDay(w.paidAt) : "", v: w.status === "recusado" ? 0 : -w.amountCents }))]
                  .sort((a, b) => b.at.getTime() - a.at.getTime())
                  .map((r) => <tr key={r.key}><td className="dim">{fmtDay(r.at)}</td><td>{r.txt}</td><td className="dim">{r.base}</td><td className="dim">{r.rel}</td><td style={{ textAlign: "right" }} className={r.v < 0 ? "dn" : ""}>{brlc(r.v)}</td></tr>)}
              </tbody>
            </table>
          </Panel>
        </div>
      )}

      <Panel title="Regras do programa" sub="Valem para todos os parceiros">
        <form action={saveProgramForm} className="stack" style={{ gap: 14 }}>
          <div className="eq-row">
            <label className="cv-field">O saldo conta vendas a partir de<input className="in" type="date" name="startDate" defaultValue={prog.startDate} /><small className="dim">Antes disso, o que foi pago ficou na tela antiga.</small></label>
            <label className="cv-field">Comissão do mês libera no dia<input className="in" name="releaseDay" defaultValue={prog.releaseDay} inputMode="numeric" /><small className="dim">do mês seguinte (vale para as vendas novas)</small></label>
            <label className="cv-field">Saque mínimo (R$)<input className="in" name="minWithdraw" defaultValue={reais(prog.minWithdrawCents)} inputMode="decimal" /></label>
          </div>
          <div className="cv-field">Bônus por meta no mês <small className="dim">Quem passar do valor em comissão no mês ganha o bônus da maior faixa atingida, no dia da liberação.</small></div>
          <div className="stack" style={{ gap: 6 }}>
            {tiers.map((t, i) => (
              <div key={i} className="row" style={{ gap: 8 }}>
                <span className="dim" style={{ fontSize: 13, width: 140 }}>Comissão a partir de</span>
                <input className="in" name="tmin" defaultValue={t.minCents ? reais(t.minCents) : ""} placeholder="1.000,00" style={{ width: 130 }} />
                <span className="dim" style={{ fontSize: 13 }}>ganha</span>
                <input className="in" name="tbonus" defaultValue={t.bonusCents ? reais(t.bonusCents) : ""} placeholder="300,00" style={{ width: 130 }} />
              </div>
            ))}
          </div>
          <div className="cv-field">Premiação em dinheiro por total ganho <small className="dim">Quando o parceiro passa do valor ganho com a loja, entra o prêmio no saldo dele, uma vez só.</small></div>
          <div className="stack" style={{ gap: 6 }}>
            {miles.map((m, i) => (
              <div key={i} className="row" style={{ gap: 8 }}>
                <span className="dim" style={{ fontSize: 13, width: 140 }}>Ao chegar em</span>
                <input className="in" name="mmin" defaultValue={m.minCents ? reais(m.minCents) : ""} placeholder="10.000,00" style={{ width: 130 }} />
                <span className="dim" style={{ fontSize: 13 }}>ganha</span>
                <input className="in" name="mprize" defaultValue={m.prizeCents ? reais(m.prizeCents) : ""} placeholder="1.000,00" style={{ width: 130 }} />
              </div>
            ))}
          </div>
          <div><button className="btn pri" type="submit">Salvar regras</button></div>
        </form>
      </Panel>
    </>
  );
}
