import { Award, Clock, Users, Wallet } from "lucide-react";
import { Header, Kpi, Panel } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { db } from "@/lib/db";
import { ambProgram } from "@/lib/ambassador";
import { brlc } from "@/lib/ledger";
import { waLink } from "@/lib/partners";
import { aprovarEmbaixador, mudarNivel, recusarEmbaixador, salvarNiveis } from "../acoes17";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function Embaixadores({ searchParams }: { searchParams: Promise<{ aprovado?: string; salvo?: string; erro?: string }> }) {
  const sp = await searchParams;
  const [p, list] = await Promise.all([ambProgram(), db.referral.findMany({ where: { kind: "embaixador" }, orderBy: { createdAt: "desc" } })]);
  const pending = list.filter((r) => r.pendingAt);
  const active = list.filter((r) => !r.pendingAt);
  const sums = active.length ? await db.partnerEarning.groupBy({ by: ["referralId"], where: { referralId: { in: active.map((r) => r.id) } }, _sum: { amountCents: true }, _count: { orderId: true } }).catch(() => []) : [];
  const earned = new Map(sums.map((s) => [s.referralId, s._sum.amountCents ?? 0]));
  const orders = new Map(sums.map((s) => [s.referralId, s._count.orderId ?? 0]));
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
        <Kpi label="No nível Prata ou acima" value={active.filter((r) => r.level && r.level !== "bronze").length} icon={<Award size={15} />} tone="p" />
      </div>

      <Panel title="Pedidos de cadastro" sub={pending.length ? "Confira o @ antes de aprovar. Ao aprovar, o cupom é criado na Shopify." : "Nenhum pedido esperando."} body={!pending.length}>
        {pending.length ? (
          <table className="tb" data-nosort>
            <thead><tr><th>Pessoa</th><th>Instagram</th><th>Faixa</th><th>Começa em</th><th>Pedido</th><th /></tr></thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b><br /><small className="dim">{r.email} · {r.phone}</small></td>
                  <td><a className="pt-g" href={`https://instagram.com/${(r.instagram ?? "").replace(/^@/, "")}`} target="_blank" rel="noreferrer">{r.instagram}</a></td>
                  <td>{r.belt}{r.teacher ? " · professor" : ""}</td>
                  <td><span className={`chip lvl-${r.level ?? "bronze"}`}>{lvName(r.level)}</span></td>
                  <td className="dim" style={{ fontSize: 12.5 }}>{fmt(r.pendingAt!)}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <form action={aprovarEmbaixador}><input type="hidden" name="id" value={r.id} /><button className="btn sm pri" type="submit">Aprovar</button></form>
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
            <thead><tr><th>Pessoa</th><th>Cupom</th><th>Faixa</th><th>Pedidos</th><th>Comissão</th><th>Nível</th></tr></thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b><br /><small className="dim">{r.instagram}</small></td>
                  <td><code>{r.code}</code></td>
                  <td>{r.belt}{r.teacher ? " · professor" : ""}</td>
                  <td>{orders.get(r.id) ?? 0}</td>
                  <td>{brlc(earned.get(r.id) ?? 0)}</td>
                  <td>
                    <form action={mudarNivel} className="row" style={{ gap: 6 }}>
                      <input type="hidden" name="id" value={r.id} />
                      <select className="in" name="level" defaultValue={r.level ?? "bronze"} style={{ height: 32, width: 120 }}>
                        {p.levels.filter((l) => !l.soon).map((l) => <option key={l.key} value={l.key}>{l.name} · {l.pct}%</option>)}
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

      <Panel title="Níveis e regras" sub="Vale para todos os embaixadores. Marque Em breve nos níveis que ainda não têm regra.">
        <form action={salvarNiveis} className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ width: 200 }}><label>Desconto do cliente (R$)</label><input className="in" name="off" defaultValue={p.clientOff} inputMode="decimal" /></div>
            <div className="field" style={{ width: 200 }}><label>Saque mínimo (R$)</label><input className="in" name="min" defaultValue={p.minWithdrawCents / 100} inputMode="decimal" /></div>
          </div>
          <table className="tb" data-nosort>
            <thead><tr><th>Nível</th><th>Comissão %</th><th>Sobe ao acumular (R$)</th><th>Benefícios</th><th>Em breve</th></tr></thead>
            <tbody>
              {p.levels.map((l, i) => (
                <tr key={l.key}>
                  <td><span className={`chip lvl-${l.key}`}>{l.name}</span></td>
                  <td><input className="in" name={`pct_${l.key}`} defaultValue={l.pct} inputMode="decimal" style={{ width: 80, height: 32 }} /></td>
                  <td>{i === 0 ? <span className="dim">ao ser aprovado</span> : <input className="in" name={`reach_${l.key}`} defaultValue={l.reachCents != null ? l.reachCents / 100 : ""} inputMode="decimal" style={{ width: 110, height: 32 }} />}</td>
                  <td><input className="in" name={`perks_${l.key}`} defaultValue={l.perks} placeholder="Ex.: peça grátis por coleção" style={{ height: 32 }} /></td>
                  <td>{i === 0 ? null : <input type="checkbox" name={`soon_${l.key}`} defaultChecked={!!l.soon} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.5 }}>Faixa preta que é professor entra direto no Prata. Essa regra não aparece no formulário. O nível sobe sozinho quando a comissão acumulada passa do valor, e nunca desce.</p>
          <div><button className="btn pri" type="submit">Salvar regras</button></div>
        </form>
      </Panel>
    </>
  );
}
