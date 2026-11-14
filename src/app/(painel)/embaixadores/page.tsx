import { Award, Clock, Users, Wallet } from "lucide-react";
import { Header, Kpi, Panel } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { db } from "@/lib/db";
import { ambProgram, eligibleFor, levelOf, orders90 } from "@/lib/ambassador";
import { brlc } from "@/lib/ledger";
import { waLink } from "@/lib/partners";
import { aprovarEmbaixador, mudarNivel, recusarEmbaixador, salvarNiveis } from "../acoes17";

export const dynamic = "force-dynamic";

const age = (d: Date | null) => { if (!d) return null; const n = new Date(); let a = n.getUTCFullYear() - d.getUTCFullYear(); if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--; return a; };
const bday = (d: Date | null) => (d ? `${d.toISOString().slice(8, 10)}/${d.toISOString().slice(5, 7)}` : "");
const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function Embaixadores({ searchParams }: { searchParams: Promise<{ aprovado?: string; salvo?: string; erro?: string }> }) {
  const sp = await searchParams;
  const [p, list] = await Promise.all([ambProgram(), db.referral.findMany({ where: { kind: "embaixador" }, orderBy: { createdAt: "desc" } })]);
  const pending = list.filter((r) => r.pendingAt);
  const active = list.filter((r) => !r.pendingAt);
  const sums = active.length ? await db.partnerEarning.groupBy({ by: ["referralId"], where: { referralId: { in: active.map((r) => r.id) } }, _sum: { amountCents: true }, _count: { orderId: true } }).catch(() => []) : [];
  const earned = new Map(sums.map((s) => [s.referralId, s._sum.amountCents ?? 0]));
  const orders = new Map(sums.map((s) => [s.referralId, s._count.orderId ?? 0]));
  const o90 = await orders90(active.map((r) => r.id));
  const canUp = active.map((r) => ({ r, to: eligibleFor(p, levelOf(p, r.level), o90.get(r.id) ?? 0) })).filter((x) => x.to);
  const lvName = (k: string | null) => p.levels.find((l) => l.key === k)?.name ?? "Bronze";
  const approved = sp.aprovado ? list.find((r) => r.id === sp.aprovado) : null;
  const link = "https://embaixador.rastahale.tech";

  return (
    <>
      <Header title="Embaixadores" lede="Pessoas que indicam a loja pelo programa de embaixadores. Cadastro em embaixador.rastahale.tech, com aprovação aqui.">
        <CopyButton text={link} label="Copiar link da página" className="btn" />
      </Header>
      {sp.erro === "admin" && <div className="err">Só o administrador pode aprovar e mudar as regras.</div>}
      {sp.salvo && <div className="ok">Regras salvas.</div>}
      {approved && (
        <div className="ok row" style={{ justifyContent: "space-between", gap: 10 }}>
          <span>{approved.name} aprovado no nível {lvName(approved.level)}, com o cupom {approved.code}.</span>
          <a className="btn sm" target="_blank" rel="noreferrer" href={waLink(approved.phone, `Oi, ${(approved.name ?? "").split(" ")[0]}! Seu cadastro de embaixador Rasta Hale foi aprovado. Seu cupom é ${approved.code} e o seu painel fica em ${link}. Entre com o seu e-mail e senha.`)}>Avisar no WhatsApp</a>
        </div>
      )}

      <div className="grid g4">
        <Kpi label="Pedidos para aprovar" value={pending.length} icon={<Clock size={15} />} tone="s" />
        <Kpi label="Embaixadores ativos" value={active.filter((r) => r.active).length} icon={<Users size={15} />} tone="l" />
        <Kpi label="Comissão gerada" value={brlc([...earned.values()].reduce((a, b) => a + b, 0))} icon={<Wallet size={15} />} tone="c" />
        <Kpi label="Bateram a meta para subir" value={canUp.length} sub="esperando sua aprovação" icon={<Award size={15} />} tone="p" />
      </div>

      <Panel title="Pedidos de cadastro" sub={pending.length ? "Confira o @ antes de aprovar. Ao aprovar, o cupom é criado na Shopify." : "Nenhum pedido esperando."} body={!pending.length}>
        {pending.length ? (
          <table className="tb" data-nosort>
            <thead><tr><th>Pessoa</th><th>Instagram</th><th>Faixa</th><th>Idade</th><th>Pedido</th><th>Aprovar no nível</th><th /></tr></thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b><br /><small className="dim">{r.email} · {r.phone}</small></td>
                  <td><a className="pt-g" href={`https://instagram.com/${(r.instagram ?? "").replace(/^@/, "")}`} target="_blank" rel="noreferrer">{r.instagram}</a></td>
                  <td>{r.belt}{r.teacher ? " · professor" : ""}</td>
                  <td>{r.birthDate ? <>{age(r.birthDate)} anos<br /><small className="dim">aniversário {bday(r.birthDate)}</small></> : "-"}</td>
                  <td className="dim" style={{ fontSize: 12.5 }}>{fmt(r.pendingAt!)}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <form action={aprovarEmbaixador} className="row" style={{ gap: 6 }}>
                        <input type="hidden" name="id" value={r.id} />
                        <select className="in" name="level" defaultValue={r.level ?? "bronze"} style={{ height: 32, width: 130 }} title="Sugestão pela faixa e se é professor">
                          {p.levels.filter((l) => !l.invite).map((l) => <option key={l.key} value={l.key}>{l.name} · {l.pct}%</option>)}
                        </select>
                        <button className="btn sm pri" type="submit">Aprovar</button>
                      </form>
                      <form action={recusarEmbaixador}><input type="hidden" name="id" value={r.id} /><ConfirmButton className="btn sm ghost danger" message={`Recusar o pedido de ${r.name}?`}>Recusar</ConfirmButton></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="mut">Quando alguém se cadastrar, aparece aqui.</div>}
      </Panel>

      <Panel title="Embaixadores" sub={`${active.length} aprovados`} body={!active.length}>
        {active.length ? (
          <table className="tb">
            <thead><tr><th>Pessoa</th><th>Cupom</th><th>Faixa</th><th>Aniversário</th><th>Pedidos (3 meses)</th><th>Comissão</th><th>Nível</th></tr></thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b><br /><small className="dim">{r.instagram}</small></td>
                  <td><code>{r.code}</code></td>
                  <td>{r.belt}{r.teacher ? " · professor" : ""}</td>
                  <td>{r.birthDate ? `${bday(r.birthDate)} · ${age(r.birthDate)} anos` : "-"}</td>
                  <td>{o90.get(r.id) ?? 0}<br /><small className="dim">{orders.get(r.id) ?? 0} no total</small>{(() => { const to = canUp.find((x) => x.r.id === r.id)?.to; return to ? <><br /><span className={`chip lvl-${to.key}`}>Pode subir para {to.name}</span></> : null; })()}</td>
                  <td>{brlc(earned.get(r.id) ?? 0)}</td>
                  <td>
                    <form action={mudarNivel} className="row" style={{ gap: 6 }}>
                      <input type="hidden" name="id" value={r.id} />
                      <select className="in" name="level" defaultValue={r.level ?? "bronze"} style={{ height: 32, width: 140 }}>
                        {p.levels.map((l) => <option key={l.key} value={l.key}>{l.key === "team" ? "Pro Team" : l.name} · {l.pct}%</option>)}
                      </select>
                      <button className="btn sm ghost" type="submit">Mudar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="mut">Nenhum embaixador aprovado ainda.</div>}
      </Panel>

      <Panel title="Níveis e regras" sub="Vale para todos os embaixadores. Mude os números e textos e salve.">
        <form action={salvarNiveis} className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ width: 200 }}><label>Desconto do cliente (R$)</label><input className="in" name="off" defaultValue={p.clientOff} inputMode="decimal" /></div>
            <div className="field" style={{ width: 200 }}><label>Saque mínimo (R$)</label><input className="in" name="min" defaultValue={p.minWithdrawCents / 100} inputMode="decimal" /></div>
          </div>
          <table className="tb" data-nosort>
            <thead><tr><th>Nível</th><th>Comissão %</th><th>Meta: pedidos em 3 meses</th><th>Como entrar pelos requisitos</th><th>Desconto no site %</th><th>Outros benefícios</th></tr></thead>
            <tbody>
              {p.levels.map((l, i) => (
                <tr key={l.key}>
                  <td><span className={`chip lvl-${l.key}`}>{l.name}</span></td>
                  <td><input className="in" name={`pct_${l.key}`} defaultValue={l.pct} inputMode="decimal" style={{ width: 70, height: 32 }} /></td>
                  <td>{l.invite ? <span className="dim">só convite</span> : i === 0 ? <span className="dim">ao ser aprovado</span> : <input className="in" name={`orders_${l.key}`} defaultValue={l.orders ?? ""} inputMode="numeric" style={{ width: 80, height: 32 }} />}</td>
                  <td><input className="in" name={`how_${l.key}`} defaultValue={l.how} style={{ height: 32, minWidth: 260 }} /></td>
                  <td><input className="in" name={`site_${l.key}`} defaultValue={l.siteOff || ""} placeholder="0" inputMode="decimal" style={{ width: 70, height: 32 }} /></td>
                  <td><input className="in" name={`perks_${l.key}`} defaultValue={l.perks} placeholder="Ex.: 2 conjuntos grátis por drop" style={{ height: 32 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.5 }}>A pessoa sobe cumprindo os requisitos ou batendo a meta. O sistema nunca sobe sozinho: quem bate a meta aparece com “Pode subir” e você confirma no Nível. No cadastro, faixa preta já chega sugerido no Prata e professor no Ouro, e você decide ao aprovar.</p>
          <div><button className="btn pri" type="submit">Salvar regras</button></div>
        </form>
      </Panel>
    </>
  );
}
