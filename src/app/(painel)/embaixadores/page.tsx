import { MessageCircle } from "lucide-react";
import { Panel } from "@/components/ui";
import { NxHead, NxRow2, NxHero, NxStat, NxTracks, NxTrack, NxAvs, NxTabsCard, NxFilters, NxPill, NxPanel, NxItem, NxEmpty, NxDHead, NxDNum, NxWho, NxDCards, NxDFoot, NxBtn } from "@/components/nx";
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

export default async function Embaixadores({ searchParams }: { searchParams: Promise<{ aprovado?: string; salvo?: string; erro?: string; v?: string; sel?: string }> }) {
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
      <NxHead title="Embaixadores" back="/">
        <CopyButton text={link} label="Copiar link da página" className="btn" />
        <a className="btn pri" href="#regras">Regras</a>
      </NxHead>
      {sp.erro === "admin" && <div className="err">Só o administrador pode aprovar e mudar as regras.</div>}
      {sp.salvo && <div className="ok">Regras salvas.</div>}
      {approved && (
        <div className="ok row" style={{ justifyContent: "space-between", gap: 10 }}>
          <span>{approved.name} aprovado no nível {lvName(approved.level)}, com o cupom {approved.code}.</span>
          <a className="btn sm" target="_blank" rel="noreferrer" href={waLink(approved.phone, `Oi, ${(approved.name ?? "").split(" ")[0]}! Seu cadastro de embaixador Rasta Hale foi aprovado. Seu cupom é ${approved.code} e o seu painel fica em ${link}. Entre com o seu e-mail e senha.`)}>Avisar no WhatsApp</a>
        </div>
      )}

      <NxRow2>
        <NxHero stats={<>
          <NxStat label="Embaixadores ativos" value={active.filter((r) => r.active).length} sub={`${active.filter((r) => r.createdAt.getTime() > Date.now() - 30 * 864e5).length} novo(s) em 30 dias`} tone="up" />
          <NxStat label="Pedidos por indicação" value={[...orders.values()].reduce((x, y) => x + y, 0).toLocaleString("pt-BR")} sub={`${[...o90.values()].reduce((x, y) => x + y, 0)} nos últimos 3 meses`} />
          <NxStat label="Comissão gerada" pre="R$" value={Math.round([...earned.values()].reduce((x, y) => x + y, 0) / 100).toLocaleString("pt-BR")} sub="desde o começo" />
        </>}>
          <NxTracks>
            {[[p.levels.slice(0, 2), "Bronze e Prata"], [p.levels.slice(2, 4), "Ouro e Premium"], [p.levels.slice(4), "Professional Team"]].map(([lv, l]) => {
              const keys = (lv as typeof p.levels).map((x) => x.key);
              const g = active.filter((r) => keys.includes(levelOf(p, r.level).key));
              return <NxTrack key={l as string} l={l as string} r={g.length} pct={active.length ? (g.length / active.length) * 100 : 0}><NxAvs names={g.slice(0, 4).map((r) => r.name ?? "?")} more={Math.max(0, g.length - 4)} /></NxTrack>;
            })}
          </NxTracks>
        </NxHero>
        <NxTabsCard title="Esperando sua aprovação" value={pending.length + canUp.length} chip={pending.length ? `${pending.length} cadastro(s)` : ""}
          tabs={p.levels.slice(1, 4).map((l, i) => ({ top: canUp.filter((x) => x.to?.key === l.key).length, label: l.name, on: i === 1 }))}
          button={{ label: "Revisar", href: pending.length ? "#cadastros" : "/embaixadores?v=subir" }} />
      </NxRow2>
      <NxFilters>
        <NxPill href="/embaixadores" on={!sp.v}>Todos {active.length}</NxPill>
        <NxPill href="/embaixadores?v=subir" on={sp.v === "subir"}>Pode subir {canUp.length}</NxPill>
        <NxPill href="#cadastros">Cadastros {pending.length}</NxPill>
        {p.levels.map((l) => <NxPill key={l.key} href={`/embaixadores?v=${l.key}`} on={sp.v === l.key}>{l.key === "team" ? "Pro Team" : l.name}</NxPill>)}
      </NxFilters>
      {(() => {
        const v = sp.v ?? "";
        const plist = active.filter((r) => !v || (v === "subir" ? canUp.some((x) => x.r.id === r.id) : levelOf(p, r.level).key === v)).sort((x, y) => (o90.get(y.id) ?? 0) - (o90.get(x.id) ?? 0));
        const cur = plist.find((r) => r.id === sp.sel) ?? plist[0];
        const to = cur ? canUp.find((x) => x.r.id === cur.id)?.to : null;
        const lv = cur ? levelOf(p, cur.level) : null;
        return (
          <NxPanel title="Embaixadores"
            tabs={[{ label: "Todos", href: "/embaixadores", on: !v }, { label: "Pode subir", count: canUp.length, href: "/embaixadores?v=subir", on: v === "subir" }, { label: "Cadastros", count: pending.length, href: "#cadastros" }]}
            list={plist.length ? plist.slice(0, 9).map((r) => {
              const t2 = canUp.find((x) => x.r.id === r.id)?.to;
              return <NxItem key={r.id} href={`/embaixadores?${v ? `v=${v}&` : ""}sel=${r.id}`} name={r.name ?? "?"} title={r.name} sub={`${r.teacher ? "Professor" : r.belt ?? "Aluno"} · ${o90.get(r.id) ?? 0} pedidos em 3 meses`} status={t2 ? `Pode subir para ${t2.name}` : lvName(r.level)} ok={!!t2} on={cur?.id === r.id} />;
            }) : <NxEmpty>Ninguém aqui.</NxEmpty>}
            detail={cur && lv ? (<>
              <NxDHead cols={[
                { label: "Embaixador", node: <NxWho name={cur.name ?? "?"} sub={`${cur.instagram ?? ""}${cur.teacher ? " · professor" : ""}`} /> },
                { label: "Nível hoje", node: <NxDNum>{lv.key === "team" ? "Pro Team" : lv.name}</NxDNum> },
                { label: to ? "Pode subir para" : "Comissão", node: <NxDNum chip={to ? to.name : `${lv.pct}%`}>{null}</NxDNum> },
              ]} />
              <NxDCards cols={3} items={[{ v: o90.get(cur.id) ?? 0, d: "Pedidos em 3 meses" }, { v: orders.get(cur.id) ?? 0, d: "Pedidos no total" }, { v: brlc(earned.get(cur.id) ?? 0), d: "Comissão" }]} />
              <NxDFoot vals={[{ l: "Cupom", v: cur.code ?? "–" }, { l: "Aniversário", v: cur.birthDate ? bday(cur.birthDate) : "–" }]}>
                {cur.phone && <NxBtn href={waLink(cur.phone, `Oi, ${(cur.name ?? "").split(" ")[0]}!`)} target="_blank"><MessageCircle size={15} /></NxBtn>}
                {to ? (
                  <form action={mudarNivel}><input type="hidden" name="id" value={cur.id} /><input type="hidden" name="level" value={to.key} /><button className="nx-lime" type="submit">Aprovar subida</button></form>
                ) : <NxBtn href="#lista" lime>Mudar nível</NxBtn>}
              </NxDFoot>
            </>) : <NxEmpty>Escolha um embaixador da lista.</NxEmpty>} />
        );
      })()}

      <div id="cadastros" />
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

      <div id="lista" />
      <Panel title="Todos os embaixadores" sub={`${active.length} aprovados`} body={!active.length}>
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

      <div id="regras" />
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
