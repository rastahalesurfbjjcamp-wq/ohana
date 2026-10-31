// Rasta Hale Club no Hub: níveis, brindes, Close Friends, aniversários, sorteio, eventos, top compradores e indicação.
import Link from "next/link";
import { CalendarDays, Cake, Gift, Instagram, Plus, Trophy, Users, X } from "lucide-react";
import type { ClubMember } from "@prisma/client";
import { db } from "@/lib/db";
import type { Settings } from "@/lib/settings";
import { brl } from "@/lib/time";
import { swr } from "@/lib/cache";
import { Panel } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { isActiveAt } from "@/lib/club";
import { affiliateRows, monthKey, monthsIn, parsePrizes, tierName, tierOf, tierPerks, topBuyers } from "@/lib/clubPlus";
import { courtesyNow, createMeet, markCloseFriends, payAffiliates, perkSent, raffleNow, retryPerks, savePerkAddress, toggleMeet } from "../acoes8";

type Club = Settings["club"];
const fmtD = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const PILL: Record<number, string> = { 0: "c-k", 3: "c-l", 6: "c-s", 12: "c-p" };
const TAG: Record<number, string> = { 0: "0 a 2 meses", 3: "Brinde", 6: "Cashback maior", 12: "Peça exclusiva" };
const PERK: Record<string, string> = { pendente: "criando o pedido", criado: "pedido criado", sem_endereco: "sem endereço", erro: "erro", enviado: "enviado" };

export async function ClubPlus({ all, c, evento, endereco }: { all: ClubMember[]; c: Club; evento?: string; endereco?: string }) {
  const month = monthKey();
  const now = new Date();
  const active = all.filter((m) => isActiveAt(m, now, c.graceDays));
  const byTier = new Map<number, number>();
  for (const m of active) { const t = tierOf(monthsIn(m)); byTier.set(t, (byTier.get(t) ?? 0) + 1); }
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const [perks, meets, raffle, bdayRewards, aff, prevAff, top] = await Promise.all([
    db.clubPerk.findMany({ where: { status: { not: "enviado" } }, include: { member: { select: { id: true, name: true, shirtSize: true } } }, orderBy: { createdAt: "asc" }, take: 60 }),
    db.clubMeet.findMany({ where: { date: { gte: new Date(Date.now() - 7 * 864e5) } }, orderBy: { date: "asc" }, take: 8, include: { _count: { select: { tickets: true } } } }),
    db.clubRaffle.findUnique({ where: { month } }),
    db.clubReward.findMany({ where: { kind: "aniversario", createdAt: { gte: yearStart } }, select: { memberId: true, usedAt: true, createdAt: true } }),
    affiliateRows(month),
    affiliateRows(new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 7)),
    swr("club:top", 3600_000, () => topBuyers(5)).catch(() => null),
  ]);
  const bdays = active.filter((m) => m.birthDate && m.birthDate.getUTCMonth() === now.getMonth());
  const bdayThis = bdayRewards.filter((r) => r.createdAt.getMonth() === now.getMonth());
  const cfAdd = active.filter((m) => m.instagram && !m.closeFriends);
  const cfDel = all.filter((m) => m.closeFriends && !isActiveAt(m, now, c.graceDays));
  const usesTotal = active.reduce((a, m) => a + (m.usesMonth === month ? m.monthUses : 0), 0);
  const kits = perks.filter((p) => p.kind === "kit");
  const gifts = perks.filter((p) => p.kind !== "kit");
  const noAddr = perks.filter((p) => p.status === "sem_endereco");
  const errs = perks.filter((p) => p.status === "erro");
  const memberIds = new Set(all.filter((m) => m.status !== "cancelado").map((m) => m.customerId).filter(Boolean));
  const courtesyIds = new Set(all.filter((m) => m.courtesy).map((m) => m.customerId).filter(Boolean));
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 7);
  const prevDue = prevAff.filter((r) => !r.paidAt && r.amount > 0);
  const winners = (raffle?.winners ?? []) as { prize: string; memberId: string; name: string }[];
  const editAddr = endereco ? all.find((m) => m.id === endereco) : null;
  const ea = (editAddr?.address ?? {}) as Record<string, string>;

  return (
    <>
      <div className="kstrip" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div className="ks"><small><Gift size={14} /> Kits para enviar</small><b>{kits.filter((p) => p.status === "criado").length}</b><span>{kits.length ? `camiseta + patch${noAddr.length ? ` · ${noAddr.length} sem endereço` : ""}` : "nenhum agora"}</span></div>
        <div className="ks"><small><Cake size={14} /> Aniversariantes do mês</small><b>{bdays.length}</b><span>{bdayThis.length} cupom(ns) de {c.birthdayPct}% · {bdayThis.filter((r) => r.usedAt).length} usado(s)</span></div>
        <div className="ks"><small>Descontos usados no mês</small><b>{usesTotal.toLocaleString("pt-BR")}</b><span>{c.usesPerMonth ? `de ${(active.length * c.usesPerMonth).toLocaleString("pt-BR")} disponíveis` : "sem limite por mês"}</span></div>
        <div className="ks"><small><Users size={14} /> Indicações ativas</small><b>{aff.reduce((a, r) => a + r.count, 0)}</b><span>{brl(aff.reduce((a, r) => a + r.amount, 0))} por mês em comissão</span></div>
      </div>

      <Panel title="Níveis por tempo de club" sub="Quanto mais tempo assinando, mais benefícios. Ajuda a segurar o cancelamento." right={<Link className="btn sm" href="/clube?regras=1#plus">Editar níveis</Link>}>
        <div className="lv">
          {[0, 3, 6, 12].map((t) => (
            <div className="lvc" key={t}>
              <h4>{tierName(t)} <span className={`chip ${PILL[t]}`}>{TAG[t]}</span></h4>
              <div className="m">{t === 0 ? "entrou agora" : "tudo do anterior +"}</div>
              <ul>{tierPerks(t, c).map((p) => <li key={p}>{p}</li>)}</ul>
              <div className="n"><span>Membros em dia</span><b>{byTier.get(t) ?? 0}</b></div>
            </div>
          ))}
        </div>
        <p className="dim" style={{ fontSize: 12.5, marginTop: 12 }}>Quando alguém completa 3 ou 12 meses, o Hub cria o pedido do brinde (R$ 0 na Shopify){c.msgTier ? " e manda no WhatsApp o link da coleção exclusiva" : ""}. {(!c.t3Link || !c.t6Link || !c.t12Link) && "Coloque os links das coleções exclusivas em Regras."}</p>
      </Panel>

      <div className="cols" style={{ gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)" }}>
        <Panel title="Para fazer agora" sub="O Hub cria os pedidos dos brindes. A equipe embala e marca como enviado.">
          {editAddr && (
            <form action={savePerkAddress} className="stack" style={{ gap: 8, marginBottom: 14, padding: 14, border: "1px solid var(--line)", borderRadius: 14 }}>
              <div className="row" style={{ justifyContent: "space-between" }}><b>Endereço de {editAddr.name}</b><Link className="menu-b" href="/clube" aria-label="Fechar"><X size={15} /></Link></div>
              <input type="hidden" name="memberId" value={editAddr.id} />
              <div className="row" style={{ gap: 8 }}>
                <input className="in" name="zip" placeholder="CEP" defaultValue={ea.zip ?? ""} style={{ width: 120 }} required />
                <input className="in" name="street" placeholder="Rua" defaultValue={ea.street ?? ""} style={{ flex: 1, minWidth: 160 }} required />
                <input className="in" name="number" placeholder="Nº" defaultValue={ea.number ?? ""} style={{ width: 80 }} required />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input className="in" name="extra" placeholder="Complemento" defaultValue={ea.extra ?? ""} style={{ flex: 1 }} />
                <input className="in" name="district" placeholder="Bairro" defaultValue={ea.district ?? ""} style={{ flex: 1 }} />
                <input className="in" name="city" placeholder="Cidade" defaultValue={ea.city ?? ""} style={{ flex: 1 }} required />
                <input className="in" name="state" placeholder="UF" defaultValue={ea.state ?? ""} style={{ width: 60 }} required />
                <select className="in" name="size" defaultValue={editAddr.shirtSize ?? ""} style={{ width: 90 }}><option value="">Tam.</option>{["P", "M", "G", "GG", "XG"].map((s) => <option key={s}>{s}</option>)}</select>
              </div>
              <div><button className="btn pri sm" type="submit">Salvar e criar o pedido</button></div>
            </form>
          )}
          <div className="lrow">
            <span className="tile sm t-l"><Gift size={16} /></span>
            <div><div className="t">{kits.length} kit(s) de boas-vindas</div><div className="s">{kits.length ? kits.slice(0, 4).map((p) => `${p.member.name.split(" ")[0]}${p.member.shirtSize ? ` (${p.member.shirtSize})` : ""} · ${p.orderName ?? PERK[p.status]}`).join(" · ") + (kits.length > 4 ? ` +${kits.length - 4}` : "") : "Camiseta do club + patch. Nada pendente."}</div></div>
          </div>
          <div className="lrow">
            <span className="tile sm t-s"><Trophy size={16} /></span>
            <div><div className="t">{gifts.length} brinde(s) de nível</div><div className="s">{gifts.length ? gifts.slice(0, 4).map((p) => `${p.member.name.split(" ")[0]} (${p.kind === "nivel3" ? "3 meses" : "12 meses"}) · ${p.orderName ?? PERK[p.status]}`).join(" · ") : "Nenhum agora."}</div></div>
          </div>
          {perks.filter((p) => p.status === "criado").length > 0 && (
            <div style={{ overflowX: "auto", margin: "6px 0 4px" }}>
              <table className="tb" data-nosort>
                <thead><tr><th>Membro</th><th>Brinde</th><th>Pedido</th><th /></tr></thead>
                <tbody>{perks.filter((p) => p.status === "criado").slice(0, 12).map((p) => (
                  <tr key={p.id}><td>{p.member.name}</td><td style={{ fontSize: 12.5 }}>{p.title}{p.kind === "kit" && p.member.shirtSize ? ` · ${p.member.shirtSize}` : ""}</td><td>{p.orderName}</td>
                    <td className="r"><form action={perkSent}><input type="hidden" name="id" value={p.id} /><button className="btn sm ghost" type="submit">Marcar enviado</button></form></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {(noAddr.length > 0 || errs.length > 0) && (
            <div className="note" style={{ margin: "8px 0" }}>
              {noAddr.length > 0 && <div>Sem endereço: {noAddr.map((p, i) => <span key={p.id}>{i ? ", " : ""}<Link href={`/clube?endereco=${p.member.id}`} style={{ textDecoration: "underline" }}>{p.member.name.split(" ")[0]}</Link></span>)}. Clique no nome para completar.</div>}
              {errs.length > 0 && <div>{errs[0].error}{errs.length > 1 ? ` (${errs.length} brindes)` : ""}</div>}
              <form action={retryPerks} style={{ marginTop: 8 }}><button className="btn sm" type="submit">Tentar de novo</button></form>
            </div>
          )}
          <div className="lrow">
            <span className="tile sm t-p"><Instagram size={16} /></span>
            <div><div className="t">{cfAdd.length} para adicionar no Close Friends</div><div className="s">{cfAdd.length ? cfAdd.slice(0, 5).map((m) => `@${m.instagram}`).join(", ") + (cfAdd.length > 5 ? ` +${cfAdd.length - 5}` : "") : "Ninguém novo."} O Instagram não deixa adicionar por sistema.</div></div>
            {cfAdd.length > 0 && <span className="end row" style={{ gap: 6, justifyContent: "flex-end" }}><CopyButton className="btn sm" text={cfAdd.map((m) => `@${m.instagram}`).join("\n")} label="Copiar" /><form action={markCloseFriends}><input type="hidden" name="ids" value={cfAdd.map((m) => m.id).join(",")} /><input type="hidden" name="on" value="1" /><button className="btn sm" type="submit">Já adicionei</button></form></span>}
          </div>
          {cfDel.length > 0 && (
            <div className="lrow">
              <span className="tile sm t-c"><Instagram size={16} /></span>
              <div><div className="t">{cfDel.length} para tirar do Close Friends</div><div className="s">{cfDel.slice(0, 5).map((m) => `@${m.instagram}`).join(", ")} · saíram do club ou atrasaram</div></div>
              <span className="end row" style={{ gap: 6, justifyContent: "flex-end" }}><CopyButton className="btn sm" text={cfDel.map((m) => `@${m.instagram}`).join("\n")} label="Copiar" /><form action={markCloseFriends}><input type="hidden" name="ids" value={cfDel.map((m) => m.id).join(",")} /><input type="hidden" name="on" value="0" /><button className="btn sm" type="submit">Já tirei</button></form></span>
            </div>
          )}
          <div className="lrow">
            <span className="tile sm t-k"><Cake size={16} /></span>
            <div><div className="t">{bdays.length} aniversariante(s) em {now.toLocaleDateString("pt-BR", { month: "long" })}</div><div className="s">Cupom de {c.birthdayPct}% criado sozinho no dia 1 (ou quando a pessoa entra){c.msgBirthday ? " e enviado no WhatsApp" : ". O envio no WhatsApp está desligado em Mensagens"}.</div></div>
            <span className="end"><span className="chip c-l">automático</span></span>
          </div>
        </Panel>

        <Panel title={`Sorteio de ${now.toLocaleDateString("pt-BR", { month: "long" })}`} sub="Entre todos os membros em dia" right={!raffle && <form action={raffleNow}><ConfirmButton className="btn sm gold" message={`Sortear agora entre ${active.length} membros em dia? Só dá para sortear uma vez por mês.`}>Sortear agora</ConfirmButton></form>}>
          {parsePrizes(c.rafflePrizes).map((p) => (
            <div className="lrow" key={p.title}><div><div className="t">{p.title}</div>{winners.length > 0 && <div className="s">{winners.filter((w) => w.prize === p.title).map((w) => w.name).join(", ")}</div>}</div><span className="end"><span className="chip c-l">{p.n} ganhador{p.n > 1 ? "es" : ""}</span></span></div>
          ))}
          <p className="dim" style={{ fontSize: 12.5, marginTop: 10 }}>{raffle ? `Sorteado em ${fmtD.format(raffle.drawnAt)}. Avise os ganhadores no WhatsApp.` : "Os prêmios você muda em Regras."}</p>
        </Panel>
      </div>

      <div className="cols" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <Panel title="Eventos com pontos" sub="Entrada trocando pontos, pela página do membro" right={<Link className="btn sm" href={evento ? "/clube" : "/clube?evento=1"}><Plus size={14} /> Evento</Link>}>
          {evento && (
            <form action={createMeet} className="stack" style={{ gap: 8, marginBottom: 12 }}>
              <input className="in" name="title" placeholder="Ex.: Open mat Rasta Hale" required />
              <div className="row" style={{ gap: 8 }}><input className="in" type="date" name="date" required style={{ flex: 1 }} /><input className="in" type="time" name="time" defaultValue="10:00" style={{ width: 110 }} /></div>
              <div className="row" style={{ gap: 8 }}><input className="in" name="points" inputMode="numeric" placeholder="Pontos" required style={{ flex: 1 }} /><input className="in" name="slots" inputMode="numeric" placeholder="Vagas" required style={{ flex: 1 }} /></div>
              <input className="in" name="place" placeholder="Local (opcional)" />
              <div><button className="btn pri sm" type="submit">Criar evento</button></div>
            </form>
          )}
          {meets.length ? meets.map((e) => (
            <div className="lrow" key={e.id} style={!e.active ? { opacity: 0.5 } : undefined}>
              <div style={{ flex: 1 }}><div className="t">{e.title}</div><div className="s">{fmtD.format(e.date)} · {e.points} pts{e.place ? ` · ${e.place}` : ""}</div><div className="bar" style={{ marginTop: 6, maxWidth: 180 }}><i style={{ width: `${Math.min(100, (e._count.tickets / e.slots) * 100)}%` }} /></div></div>
              <span className="end"><b>{e._count.tickets}</b><div className="s">de {e.slots} vagas</div><form action={toggleMeet}><input type="hidden" name="id" value={e.id} /><button className="btn sm ghost" type="submit" style={{ height: 24, padding: "0 6px" }}>{e.active ? "Fechar" : "Abrir"}</button></form></span>
            </div>
          )) : <div className="empty" style={{ padding: 16 }}><CalendarDays size={18} className="dim" /> Nenhum evento. Crie o primeiro.</div>}
        </Panel>

        <Panel title="Top 5 compradores" sub="Quem mais gastou na loja · ganham o club de graça por 1 ano">
          {top === null ? <div className="dim" style={{ fontSize: 13 }}>Não consegui ler os clientes da Shopify agora.</div> : top.map((b) => (
            <div className="lrow" key={b.id}>
              <div><div className="t">{b.name}</div><div className="s">{b.orders} pedido(s)</div></div>
              <span className="end"><b>{brl(b.spent, 0)}</b><div className="s" style={{ marginTop: 4 }}>{courtesyIds.has(b.id) ? <span className="chip c-l">já é cortesia</span> : memberIds.has(b.id) ? <span className="chip c-k">já é membro</span> : <form action={courtesyNow}><input type="hidden" name="id" value={b.id} /><ConfirmButton className="btn sm" message={`Dar 1 ano de club grátis para ${b.name}? O Hub cria o cupom, a marcação e o pedido do kit.`}>Dar club grátis</ConfirmButton></form>}</div></span>
            </div>
          ))}
        </Panel>

        <Panel title="Indicação do club" sub="Todo membro tem um link para indicar o club">
          <p className="dim" style={{ fontSize: 13 }}>Paga <b style={{ color: "#fff" }}>{c.affiliatePct}%</b> da mensalidade ({brl((c.fee * c.affiliatePct) / 100)}) por indicado, todo mês enquanto ele continuar assinando.</p>
          {aff.length ? aff.slice(0, 6).map((r) => (
            <div className="lrow" key={r.id}><div><div className="t">{r.name}</div><div className="s">{r.count} indicado(s) ativo(s) · /club/{r.refCode}</div></div><span className="end"><b>{brl(r.amount)}</b><div className="s">por mês</div></span></div>
          )) : <div className="dim" style={{ fontSize: 13, marginTop: 10 }}>Ninguém assinou por indicação ainda. O link aparece na página de cada membro.</div>}
          {prevDue.length > 0 && (
            <form action={payAffiliates} className="note" style={{ marginTop: 10 }}>
              <input type="hidden" name="month" value={prevMonth} />
              {prevDue.length} pessoa(s) para receber de {prevMonth.slice(5)}/{prevMonth.slice(0, 4)}: {brl(prevDue.reduce((a, r) => a + r.amount, 0))} no total. {prevDue.slice(0, 3).map((r) => `${r.name.split(" ")[0]} ${brl(r.amount)}`).join(", ")}
              <div style={{ marginTop: 8 }}><ConfirmButton className="btn sm" message="Marcar as comissões do mês passado como pagas?">Marcar como pago</ConfirmButton></div>
            </form>
          )}
        </Panel>
      </div>
    </>
  );
}
