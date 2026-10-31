import Link from "next/link";
import { BadgeCheck, CalendarCheck, Crown, Gift, MessageCircle, Plus, RefreshCw, Search, Settings2, Ticket, UserPlus, X } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { brl } from "@/lib/time";
import { formatPhone } from "@/lib/phone";
import { Header, Panel } from "@/components/ui";
import { NumberInput } from "@/components/NumberInput";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { clubMessage, digits, findMembers, findShopifyCustomer, fmtCpf, maskCpf, memberState } from "@/lib/club";
import { waLink } from "@/lib/partners";
import { normalizePhone } from "@/lib/segments";
import { addMember, adjustPoints, cancelMember, cancelSubscription, eventCheckin, launchClubMsg, payMember, redeemPoints, redeemPrize, saveClubRules, savePrize, scanClubNow, toggleClubMsg, togglePrize, updateMember } from "../acoes6";
import { AutoToggle } from "@/components/AutoToggle";
import { LAUNCH_DEFAULT, clubText } from "@/lib/clubMsg";
import { env } from "@/lib/env";
import { hasAppmax } from "@/lib/appmax";
import { products } from "@/lib/store";
import { ClubPlus } from "./ClubPlus";
import { saveClubPlus } from "../acoes8";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = { compra: "Compra", estorno: "Estorno", mensalidade: "Mensalidade", resgate: "Resgate", evento: "Evento", ajuste: "Ajuste", bonus: "Bônus" };
const OK: Record<string, string> = { cancelado: "Assinatura cancelada. O cupom de membro foi desligado.", pago: "Mensalidade registrada. O cupom de membro está ligado.", entrada: "Entrada no evento registrada.", ajuste: "Pontos ajustados.", regras: "Regras salvas.", aviso: "Aviso de lançamento na fila. As mensagens saem aos poucos, com a proteção do número.", evento: "Evento criado. Ele já aparece na página dos membros.", sorteio: "Sorteio feito. Os ganhadores estão no painel do sorteio.", cortesia: "Club de cortesia liberado. O kit entra na lista de envio.", cf: "Close Friends atualizado.", brindes: "Brindes enviados para a Shopify de novo.", afiliados: "Comissões marcadas como pagas.", "1": "Salvo." };

export default async function Clube({ searchParams }: { searchParams: Promise<{ premios?: string; q?: string; novo?: string; erro?: string; ok?: string; cupom?: string; criado?: string; regras?: string; somados?: string; f?: string; editar?: string; msgs?: string; n?: string; pg?: string; evento?: string; endereco?: string }> }) {
  const sp = await searchParams;
  const { club: c, postsale } = await getSettings();
  const store = postsale.storeUrl;
  const q = (sp.q ?? "").trim();
  const all = await db.clubMember.findMany({ orderBy: [{ points: "desc" }, { joinedAt: "desc" }] });
  const st = (m: (typeof all)[number]) => memberState(m, c.graceDays);
  const active = all.filter((m) => ["em_dia", "vencendo"].includes(st(m).k));
  const late = all.filter((m) => st(m).k === "atrasado" || st(m).k === "pendente");
  const pts = all.filter((m) => m.status !== "cancelado").reduce((a, m) => a + m.points, 0);
  const found = q ? await findMembers(q) : [];
  const member = found.length === 1 ? found[0] : null;
  const detail = member ? await db.clubMember.findUnique({ where: { id: member.id }, include: { entries: { orderBy: { createdAt: "desc" }, take: 12 }, rewards: { orderBy: { createdAt: "desc" }, take: 6 } } }) : null;
  // não é membro: procura na loja para já cadastrar com os dados certos
  const d = digits(q);
  const shop = q && !found.length ? await findShopifyCustomer({ cpf: d.length === 11 ? d : null, phone: normalizePhone(q), email: q.includes("@") ? q : null }).catch(() => null) : null;
  const filter = sp.f ?? "";
  const list = all.filter((m) => !filter || (filter === "ativos" ? active.includes(m) : filter === "atraso" ? late.includes(m) : m.status === "cancelado"));
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });
  const fmtH = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const money = (p: number) => brl((p / 100) * c.valuePer100);
  const redeemMax = detail ? Math.floor(detail.points / c.minRedeem) * c.minRedeem : 0;
  const newCoupon = sp.cupom && detail ? detail.rewards.find((r) => r.code === sp.cupom) : null;
  const [prizes, events, appmaxOn, pendingCk, prods] = await Promise.all([
    db.clubPrize.findMany({ orderBy: { points: "asc" } }),
    db.clubEvent.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { member: { select: { name: true, cpf: true, phone: true, email: true } } } }),
    hasAppmax(),
    db.clubCheckout.count({ where: { status: "pendente", createdAt: { gte: new Date(Date.now() - 864e5) } } }),
    sp.premios ? products().catch(() => []) : Promise.resolve([]),
  ]);
  const subs = all.filter((m) => m.subscriptionId || m.provider === "appmax");
  // tabelas longas: mostra por páginas para a tela abrir rápido
  const SUBS_SHOW = 30, PER = 100;
  const subsView = [...subs].sort((a, b) => (b.lastChargeAt?.getTime() ?? 0) - (a.lastChargeAt?.getTime() ?? 0)).slice(0, SUBS_SHOW);
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const pg = Math.min(pages, Math.max(1, Number(sp.pg) || 1));
  const listView = list.slice((pg - 1) * PER, pg * PER);
  const pgHref = (n: number) => `/clube?${new URLSearchParams({ ...(filter ? { f: filter } : {}), ...(n > 1 ? { pg: String(n) } : {}) }).toString()}`;
  const subLink = `${env.appUrl().replace(/\/$/, "")}/assinar`;
  const pixN = subs.filter((m) => m.status !== "cancelado" && m.payMethod === "pix").length;
  const cardN = subs.filter((m) => m.status !== "cancelado" && m.payMethod === "cartao").length;
  const in7 = subs.filter((m) => m.status !== "cancelado" && m.nextChargeAt && m.nextChargeAt.getTime() < Date.now() + 7 * 864e5);
  const canceledMonth = all.filter((m) => m.canceledAt && m.canceledAt.getTime() > Date.now() - 30 * 864e5).length;
  const EVK: Record<string, string> = { assinou: "t-l", pagou: "t-l", falhou: "t-s", cancelou: "t-c", pausou: "t-n", voltou: "t-k", resgate: "t-p" };

  return (
    <>
      <Header title={c.name} lede={`${brl(c.fee)} por mês. ${c.usesPerMonth ? `${c.discountPct}% em ${c.usesPerMonth} compras por mês` : `${c.discountPct}% em toda compra`}, pontos, níveis por tempo de club, eventos e brindes.`}>
        <form action={scanClubNow}><button className="btn" type="submit" title="Puxa as compras dos últimos 30 dias e soma os pontos"><RefreshCw size={15} /> Atualizar pontos</button></form>
        <Link className="btn" href={sp.premios ? "/clube" : "/clube?premios=1"}><Gift size={15} /> Recompensas</Link>
        <Link className="btn" href={sp.msgs ? "/clube" : "/clube?msgs=1"}><MessageCircle size={15} /> Mensagens</Link>
        <Link className="btn" href={sp.regras ? "/clube" : "/clube?regras=1"}><Settings2 size={15} /> Regras</Link>
        <Link className="btn pri" href={sp.novo ? "/clube" : "/clube?novo=1"}><Plus size={16} /> Novo membro</Link>
      </Header>
      {sp.ok && <div className="ok">{OK[sp.ok] ?? "Salvo."}</div>}
      {sp.somados && <div className="ok">{Number(sp.somados) ? `${sp.somados} pontos somados das compras.` : "Nenhuma compra nova de membro para somar."}</div>}
      {sp.erro && sp.erro !== "nome" && <div className="err">{sp.erro}</div>}

      {sp.msgs && <MsgPanel all={all} c={c} n={sp.n} />}

      {sp.regras && (
        <Panel title="Regras do clube" sub="Valem para todos os membros" right={<Link className="menu-b" href="/clube" aria-label="Fechar"><X size={16} /></Link>}>
          <form action={saveClubRules} className="stack" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Nome do clube</label><input className="in" name="name" defaultValue={c.name} /></div>
              <label className="check" style={{ alignSelf: "flex-end", paddingBottom: 10 }}><input type="checkbox" name="enabled" defaultChecked={c.enabled} /> Somar pontos automaticamente</label>
            </div>
            <div className="rule-grid">
              <div className="rule"><span>Mensalidade</span><NumberInput name="fee" defaultValue={c.fee} prefix="R$" decimals={2} step={1} /><small>quanto o membro paga por mês</small></div>
              <div className="rule"><span>Desconto do membro</span><NumberInput name="discountPct" defaultValue={c.discountPct} suffix="%" max={50} /><small>{c.usesPerMonth ? `nas ${c.usesPerMonth} compras do mês` : "em toda compra na loja"}</small></div>
              <div className="rule"><span>Pontos por R$ 1 gasto</span><NumberInput name="pointsPerReal" defaultValue={c.pointsPerReal} decimals={1} step={0.5} /><small>R$ 200 em compras = {Math.round(200 * c.pointsPerReal)} pontos</small></div>
              <div className="rule"><span>Valor de 100 pontos</span><NumberInput name="valuePer100" defaultValue={c.valuePer100} prefix="R$" decimals={2} step={1} /><small>desconto que o membro ganha ao trocar</small></div>
              <div className="rule"><span>Pontos por mensalidade paga</span><NumberInput name="monthlyPoints" defaultValue={c.monthlyPoints} step={10} suffix="pts" /><small>bônus a cada mês em dia</small></div>
              <div className="rule"><span>Mínimo para resgatar</span><NumberInput name="minRedeem" defaultValue={c.minRedeem} step={50} suffix="pts" /><small>vale {brl((c.minRedeem / 100) * c.valuePer100)} de desconto</small></div>
              <div className="rule"><span>Entrada em evento</span><NumberInput name="eventPoints" defaultValue={c.eventPoints} step={50} suffix="pts" /><small>0 = grátis para membro em dia</small></div>
              <div className="rule"><span>Tolerância no atraso</span><NumberInput name="graceDays" defaultValue={c.graceDays} suffix="dias" /><small>depois disso o cupom desliga</small></div>
              <div className="rule"><span>Acesso antecipado</span><NumberInput name="earlyHours" defaultValue={c.earlyHours ?? 48} step={12} suffix="horas" /><small>antes de abrir para todo mundo</small></div>
            </div>
            <p className="dim" style={{ fontSize: 12.5 }}>Passou da tolerância, o cupom de membro é desligado sozinho e volta quando a mensalidade for registrada. Mudar o desconto vale para os próximos membros.</p>
            <div><button className="btn pri sm" type="submit">Salvar regras</button></div>
          </form>
          <form action={saveClubPlus} id="plus" className="stack" style={{ gap: 8, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line2)" }}>
            <b>Níveis, brindes e benefícios</b>
            <div className="rule-grid">
              <div className="rule"><span>Compras com desconto por mês</span><NumberInput name="usesPerMonth" defaultValue={c.usesPerMonth} suffix="compras" /><small>0 = em toda compra · renova dia 1</small></div>
              <div className="rule"><span>Cupom de aniversário</span><NumberInput name="birthdayPct" defaultValue={c.birthdayPct} suffix="%" max={90} /><small>uma compra no mês do aniversário</small></div>
              <div className="rule"><span>Comissão por indicação</span><NumberInput name="affiliatePct" defaultValue={c.affiliatePct} suffix="%" max={100} /><small>{brl((c.fee * c.affiliatePct) / 100)} por indicado, todo mês</small></div>
              <div className="rule"><span>Pontos por R$ 1 com 6 meses</span><NumberInput name="t6Points" defaultValue={c.t6Points} decimals={1} step={0.5} /><small>cashback maior do nível 6 meses</small></div>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 220 }}><label>Kit de boas-vindas</label><input className="in" name="kitTitle" defaultValue={c.kitTitle} /></div>
              <div className="field" style={{ flex: 1, minWidth: 220 }}><label>Brinde de 3 meses</label><input className="in" name="t3Gift" defaultValue={c.t3Gift} /></div>
              <div className="field" style={{ flex: 1, minWidth: 220 }}><label>Peça de 12 meses</label><input className="in" name="t12Gift" defaultValue={c.t12Gift} /></div>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Link da coleção do acesso antecipado</label><input className="in" name="earlyLink" defaultValue={c.earlyLink} placeholder="https://rastahale.com.br/collections/..." /></div>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Coleção exclusiva 3 meses</label><input className="in" name="t3Link" defaultValue={c.t3Link} placeholder="link fora do menu da loja" /></div>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Coleção exclusiva 6 meses</label><input className="in" name="t6Link" defaultValue={c.t6Link} /></div>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Coleção exclusiva 12 meses</label><input className="in" name="t12Link" defaultValue={c.t12Link} /></div>
            </div>
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <div className="field" style={{ flex: 2, minWidth: 260 }}><label>Prêmios do sorteio do mês (um por linha: prêmio|ganhadores)</label><textarea className="in" name="rafflePrizes" rows={3} defaultValue={c.rafflePrizes} /></div>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>@ do Instagram do Close Friends</label><input className="in" name="instagram" defaultValue={c.instagram} placeholder="rastahale" /></div>
            </div>
            <p className="dim" style={{ fontSize: 12.5 }}>Os brindes viram pedido de R$ 0 na Shopify com o endereço do membro. As coleções exclusivas são links de coleções que ficam fora do menu da loja.</p>
            <div><button className="btn pri sm" type="submit">Salvar níveis e benefícios</button></div>
          </form>
        </Panel>
      )}

      {sp.novo && (
        <Panel title="Novo membro" sub="Cria o cupom de membro na Shopify, preso à conta da pessoa" right={<Link className="menu-b" href="/clube" aria-label="Fechar"><X size={16} /></Link>}>
          <form action={addMember} className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 1, minWidth: 180 }}><label>Nome</label><input className="in" name="name" required defaultValue={shop?.name ?? ""} /></div>
              <div className="field" style={{ width: 160 }}><label>CPF</label><input className="in" name="cpf" inputMode="numeric" placeholder="000.000.000-00" defaultValue={d.length === 11 ? fmtCpf(d) : ""} /></div>
              <div className="field" style={{ width: 170 }}><label>WhatsApp</label><input className="in" name="phone" inputMode="tel" placeholder="21 99999-9999" defaultValue={shop?.phone ?? (normalizePhone(q) ? q : "")} /></div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}><label>E-mail da conta na loja</label><input className="in" name="email" type="email" defaultValue={shop?.email ?? (q.includes("@") ? q : "")} /></div>
              {shop && <input type="hidden" name="customerId" value={shop.id} />}<div style={{ display: "none" }}></div>
            </div>
            <div className="row" style={{ alignItems: "center", gap: 16 }}>
              <label className="check"><input type="checkbox" name="paid" defaultChecked /> Já pagou a mensalidade</label>
              <span className="row" style={{ gap: 6 }}><span className="dim" style={{ fontSize: 13 }}>meses</span><NumberInput size="sm" name="months" defaultValue={1} min={1} max={12} /></span>
              <span className="row" style={{ gap: 6 }}><span className="dim" style={{ fontSize: 13 }}>bônus de entrada</span><NumberInput size="sm" name="bonus" defaultValue={0} suffix="pts" /></span>
              <button className="btn pri" type="submit" style={{ marginLeft: "auto" }}><UserPlus size={15} /> Cadastrar</button>
            </div>
            {sp.erro === "nome" && <div className="err">Coloque o nome.</div>}
            <p className="dim" style={{ fontSize: 12.5 }}>O sistema acha a pessoa na Shopify pelo e-mail, telefone ou pelo CPF dos pedidos. Assim o cupom só funciona na conta dela e as compras somam pontos sozinhas.</p>
          </form>
        </Panel>
      )}

      <div className="grid g4">
        <div className="pnl kpi hl"><small><Crown size={14} /> Membros em dia</small><span className="num up">{active.length}</span><div className="sub">{all.length} no total</div></div>
        <div className="pnl kpi"><small>Receita por mês</small><span className="num">{brl(active.reduce((a, m) => a + (m.courtesy ? 0 : m.fee || c.fee), 0), 0)}</span><div className="sub">mensalidades dos membros em dia</div></div>
        <div className={`pnl kpi ${late.length ? "warnk" : ""}`}><small>Em atraso</small><span className="num" style={late.length ? { color: "var(--sun)" } : undefined}>{late.length}</span><div className="sub">cupom desligado depois de {c.graceDays} dias</div></div>
        <div className="pnl kpi"><small>Pontos em aberto</small><span className="num">{pts.toLocaleString("pt-BR")}</span><div className="sub">valem {money(pts)} em desconto</div></div>
      </div>

      <ClubPlus all={all} c={c} evento={sp.evento} endereco={sp.endereco} />

      {sp.premios && (
        <Panel title="Recompensas" sub="Peças que o membro troca por pontos. Ao trocar, sai um cupom de 100% só para aquela peça, de uso único." right={<Link className="menu-b" href="/clube" aria-label="Fechar"><X size={16} /></Link>}>
          <form action={savePrize} className="row" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Peça da loja</label>
              <select className="in" name="productId" defaultValue="">
                <option value="">Escolha o produto</option>
                {prods.filter((p) => p.status === "ACTIVE").map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 180 }}><label>Nome que aparece</label><input className="in" name="title" placeholder="Ex.: Rashguard Original Rasta" required /></div>
            <div className="field" style={{ width: 150 }}><label>Pontos</label><input className="in" name="points" inputMode="numeric" placeholder="4600" required /></div>
            <button className="btn pri" type="submit"><Plus size={15} /> Adicionar</button>
          </form>
          <p className="dim" style={{ fontSize: 12.5, margin: "10px 0 4px" }}>Referência: com {c.pointsPerReal === 1 ? "1 ponto" : `${c.pointsPerReal} pontos`} por real e 100 pontos valendo {brl(c.valuePer100)}, uma peça de R$ 200 equivale a {Math.round((200 / c.valuePer100) * 100).toLocaleString("pt-BR")} pontos. Pode colocar menos para a peça sair mais fácil.</p>
          {prizes.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table className="tb">
                <thead><tr><th>Recompensa</th><th className="r">Pontos</th><th>Situação</th><th /></tr></thead>
                <tbody>{prizes.map((p) => (
                  <tr key={p.id} style={!p.active ? { opacity: 0.5 } : undefined}>
                    <td><b style={{ fontWeight: 600 }}>{p.title}</b>{!p.productId && <div style={{ fontSize: 12, color: "var(--sun)" }}>sem produto ligado</div>}</td>
                    <td className="r">{p.points.toLocaleString("pt-BR")}</td>
                    <td>{p.active ? "No catálogo" : "Escondida"}</td>
                    <td><form action={togglePrize}><input type="hidden" name="id" value={p.id} /><button className="btn sm ghost" type="submit">{p.active ? "Esconder" : "Mostrar"}</button></form></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <div className="cols c-2-1" style={{ alignItems: "start" }}>
        <Panel title="Assinaturas pela página" sub={appmaxOn ? `Cobrança automática pela Appmax${pendingCk ? ` · ${pendingCk} pagamento(s) esperando agora` : ""}` : "Conecte a Appmax em Integrações para receber pela página"} body={false}
          right={<span className="row" style={{ gap: 6 }}><CopyButton text={subLink} className="btn sm" label="Copiar link" /><a className="btn sm ghost" href="/assinar" target="_blank" rel="noreferrer">Abrir página</a></span>}>
          <div className="kstrip" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", padding: "0 18px 14px" }}>
            <div className="ks"><small>Pix x cartão</small><b style={{ fontSize: 20 }}>{pixN} / {cardN}</b><span>assinantes ativos</span></div>
            <div className="ks"><small>Próximos 7 dias</small><b style={{ fontSize: 20 }}>{brl(in7.reduce((a, m) => a + (m.fee || c.fee), 0), 0)}</b><span>{in7.length} cobrança(s)</span></div>
            <div className={`ks${subs.some((m) => m.lastChargeStatus === "falhou" && m.status !== "cancelado") ? " warn" : ""}`}><small>Cobrança recusada</small><b style={{ fontSize: 20 }}>{subs.filter((m) => m.lastChargeStatus === "falhou" && m.status !== "cancelado").length}</b><span>tentando de novo</span></div>
            <div className="ks"><small>Cancelaram</small><b style={{ fontSize: 20 }}>{canceledMonth}</b><span>nos últimos 30 dias</span></div>
          </div>
          {subs.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="tb">
                <thead><tr><th>Membro</th><th>Situação</th><th>Pagamento</th><th>Próxima cobrança</th><th>Última</th><th /></tr></thead>
                <tbody>{subsView.map((m) => {
                  const s2 = st(m);
                  const tone = m.status === "cancelado" ? "c-n" : m.lastChargeStatus === "falhou" ? "c-s" : s2.tone === "l" ? "c-l" : s2.tone === "c" ? "c-c" : "c-s";
                  const label = m.status === "cancelado" ? "Cancelada" : m.lastChargeStatus === "falhou" ? "Cobrança recusada" : s2.label;
                  return (
                    <tr key={m.id}>
                      <td><Link href={`/clube?q=${encodeURIComponent(m.cpf ?? m.phone ?? m.email ?? m.name)}`} style={{ color: "inherit", fontWeight: 600 }}>{m.name}</Link><div className="dim" style={{ fontSize: 12 }}>{m.phone ? formatPhone(m.phone) : m.email}</div></td>
                      <td><span className={`chip ${tone}`}>{label}</span></td>
                      <td>{m.payMethod === "cartao" ? `Cartão ${m.cardLast4 ? `•• ${m.cardLast4}` : ""}` : m.payMethod === "pix" ? "Pix" : "Manual"}{m.failReason && m.lastChargeStatus === "falhou" && <div className="dim" style={{ fontSize: 12 }}>{m.failReason}</div>}</td>
                      <td>{m.status === "cancelado" ? `cancelou ${m.canceledAt ? fmt.format(m.canceledAt) : ""}` : m.nextChargeAt ? fmt.format(m.nextChargeAt) : m.paidUntil ? fmt.format(m.paidUntil) : "–"}</td>
                      <td>{m.lastChargeAt ? fmtH.format(m.lastChargeAt) : "–"}</td>
                      <td>{m.status !== "cancelado" && m.subscriptionId && <form action={cancelSubscription}><input type="hidden" name="id" value={m.id} /><ConfirmButton className="btn sm ghost" message={`Cancelar a assinatura de ${m.name.split(" ")[0]} na Appmax? Ela para de ser cobrada e o cupom desliga.`}>Cancelar</ConfirmButton></form>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
              {subs.length > SUBS_SHOW && <div className="dim" style={{ padding: "12px 20px", fontSize: 13 }}>Mostrando as {SUBS_SHOW} cobranças mais recentes de {subs.length.toLocaleString("pt-BR")} assinaturas.</div>}
            </div>
          ) : <div className="empty" style={{ padding: 20 }}>Ninguém assinou pela página ainda. Mande o link no grupo e no Instagram.</div>}
        </Panel>
        <Panel title="Acontecendo agora" body={false}>
          {events.length ? events.map((e) => (
            <Link key={e.id} href={`/clube?q=${encodeURIComponent(e.member.cpf ?? e.member.phone ?? e.member.email ?? e.member.name)}`} className="lrow" style={{ color: "inherit", padding: "11px 18px" }}>
              <span className={`tile sm ${EVK[e.kind] ?? "t-n"}`}><Crown size={14} /></span>
              <div style={{ minWidth: 0, flex: 1 }}><div className="t" style={{ fontSize: 13.5 }}>{e.member.name.split(" ")[0]}: {e.text}</div><div className="s">{fmtH.format(e.createdAt)}{e.value ? ` · ${brl(e.value)}` : ""}</div></div>
            </Link>
          )) : <div className="empty" style={{ padding: 20 }}>Os pagamentos, recusas e cancelamentos aparecem aqui.</div>}
        </Panel>
      </div>

      <section className="pnl" style={{ padding: 22 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Consultar e resgatar</h3>
        <form className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} className="dim" style={{ position: "absolute", left: 14, top: 14 }} />
            <input className="in" name="q" defaultValue={q} autoFocus={!sp.novo} placeholder="CPF, WhatsApp, e-mail ou nome" style={{ paddingLeft: 40, height: 46, fontSize: 15 }} />
          </div>
          <button className="btn pri" type="submit" style={{ height: 46 }}>Buscar</button>
        </form>

        {q && found.length > 1 && (
          <div style={{ marginTop: 12 }}>
            {found.map((m) => <Link key={m.id} href={`/clube?q=${encodeURIComponent(m.cpf ?? m.phone ?? m.email ?? m.name)}`} className="lrow" style={{ color: "inherit" }}><span className="tile sm t-s"><Crown size={15} /></span><div><div className="t">{m.name}</div><div className="s">{maskCpf(m.cpf)} {m.phone ? `· ${formatPhone(m.phone)}` : ""}</div></div><span className="end">{m.points} pts</span></Link>)}
          </div>
        )}

        {q && !found.length && (
          <div className="callout lagoon" style={{ marginTop: 14, alignItems: "center" }}>
            {shop ? (
              <>
                <div><b>{shop.name} ainda não é do clube.</b><div className="dim" style={{ fontSize: 13 }}>Cliente da loja · {shop.orders} pedido(s) · {brl(shop.spent, 0)}{shop.email ? ` · ${shop.email}` : ""}</div></div>
                <Link className="act" href={`/clube?novo=1&q=${encodeURIComponent(q)}`}>Cadastrar no clube</Link>
              </>
            ) : <div><b>Ninguém encontrado com “{q}”.</b> <span className="dim">Nem no clube nem nos pedidos da loja.</span></div>}
          </div>
        )}

        {detail && (() => {
          const state = st(detail);
          const msgTxt = clubMessage(detail, c, store);
          return (
            <div className="cols c-2-1" style={{ marginTop: 16, alignItems: "start" }}>
              <div className="stack">
                <div className="pnl" style={{ padding: 18, background: "linear-gradient(160deg, rgba(247,201,40,.10), var(--sf) 60%)" }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div className="row" style={{ gap: 8 }}><Crown size={18} style={{ color: "var(--sun)" }} /><b style={{ fontSize: 19 }}>{detail.name}</b><span className={`chip t-${state.tone}`} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 99 }}>{state.label}</span></div>
                      <div className="dim" style={{ fontSize: 13, marginTop: 6 }}>
                        {detail.cpf ? `CPF ${fmtCpf(detail.cpf)}` : "sem CPF"}{detail.phone ? ` · ${formatPhone(detail.phone)}` : ""}{detail.email ? ` · ${detail.email}` : ""}
                      </div>
                      <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>
                        Membro desde {fmt.format(detail.joinedAt)} · {detail.paidUntil ? `pago até ${fmt.format(detail.paidUntil)}` : "nenhuma mensalidade registrada"}{detail.customerId ? " · conta na loja ligada" : " · sem conta na loja"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="hero-num" style={{ fontSize: 40 }}>{detail.points.toLocaleString("pt-BR")}</div>
                      <div className="dim" style={{ fontSize: 13 }}>pontos · {money(detail.points)}</div>
                    </div>
                  </div>
                  {detail.code && (
                    <div className="row" style={{ marginTop: 14, gap: 8 }}>
                      <span className="trk" style={{ color: detail.codeActive ? "var(--lagoon)" : "var(--ink3)" }}><BadgeCheck size={13} /> {detail.code}</span>
                      <span className="dim" style={{ fontSize: 12.5 }}>{detail.codeActive ? `${c.discountPct}% em toda compra` : "desligado até pagar a mensalidade"}</span>
                      <CopyButton text={`${store.replace(/\/$/, "")}/discount/${detail.code}`} className="btn sm ghost" label="Link do cupom" />
                    </div>
                  )}
                </div>

                {newCoupon && (
                  <div className="callout lagoon" style={{ alignItems: "center" }}>
                    <Gift size={18} />
                    <div style={{ flex: 1 }}><b>Cupom {newCoupon.code} de {brl(newCoupon.value)} criado.</b><div className="dim" style={{ fontSize: 13 }}>Uso único, só na conta dela. No site é só digitar ou abrir o link.</div></div>
                    <CopyButton text={newCoupon.code} className="btn sm" label="Copiar cupom" />
                    <a className="btn sm" target="_blank" rel="noreferrer" href={waLink(detail.phone ?? "sem-", `Oi, ${detail.name.split(" ")[0]}! Seu cupom de ${brl(newCoupon.value)} pelos pontos do ${c.name}: ${newCoupon.code}\nLink que já aplica: ${store.replace(/\/$/, "")}/discount/${newCoupon.code}`)}><MessageCircle size={14} /> WhatsApp</a>
                  </div>
                )}

                <div className="grid g3" style={{ gap: 10 }}>
                  <form action={redeemPoints} className="pnl" style={{ padding: 16 }}>
                    <input type="hidden" name="id" value={detail.id} /><input type="hidden" name="q" value={q} />
                    <div className="row" style={{ gap: 8, marginBottom: 8 }}><span className="tile sm t-l"><Ticket size={15} /></span><b>Trocar por cupom</b></div>
                    {redeemMax >= c.minRedeem ? (
                      <>
                        <NumberInput size="sm" name="points" defaultValue={redeemMax} min={c.minRedeem} max={redeemMax} suffix="pts" />
                        <div className="dim" style={{ fontSize: 12, margin: "6px 0 10px" }}>{c.minRedeem} pts = {money(c.minRedeem)}</div>
                        <ConfirmButton className="btn pri sm" message="Criar o cupom e descontar os pontos?">Gerar cupom</ConfirmButton>
                      </>
                    ) : <div className="dim" style={{ fontSize: 13 }}>Faltam {c.minRedeem - detail.points} pontos para o primeiro resgate.</div>}
                  </form>
                  <form action={eventCheckin} className="pnl" style={{ padding: 16 }}>
                    <input type="hidden" name="id" value={detail.id} /><input type="hidden" name="q" value={q} />
                    <div className="row" style={{ gap: 8, marginBottom: 8 }}><span className="tile sm t-k"><CalendarCheck size={15} /></span><b>Entrada no evento</b></div>
                    <input className="in" name="event" placeholder="Ex.: Open Mat" style={{ height: 34, marginBottom: 8 }} />
                    <div className="dim" style={{ fontSize: 12, marginBottom: 10 }}>{c.eventPoints ? `usa ${c.eventPoints} pontos` : state.k === "em_dia" || state.k === "vencendo" ? "grátis para membro em dia" : "mensalidade em atraso"}</div>
                    <button className="btn sm" type="submit" disabled={!c.eventPoints && !(state.k === "em_dia" || state.k === "vencendo")}>Registrar entrada</button>
                  </form>
                  {prizes.some((p) => p.active) && (
                    <form action={redeemPrize} className="pnl" style={{ padding: 16 }}>
                      <input type="hidden" name="id" value={detail.id} /><input type="hidden" name="q" value={q} />
                      <div className="row" style={{ gap: 8, marginBottom: 8 }}><span className="tile sm t-p"><Gift size={15} /></span><b>Trocar por peça</b></div>
                      <select className="in" name="prize" style={{ height: 36, marginBottom: 10 }}>
                        {prizes.filter((p) => p.active).map((p) => <option key={p.id} value={p.id} disabled={p.points > detail.points}>{p.title} · {p.points.toLocaleString("pt-BR")} pts{p.points > detail.points ? " (faltam pontos)" : ""}</option>)}
                      </select>
                      <ConfirmButton className="btn sm" message="Gerar o cupom da peça e descontar os pontos?">Gerar cupom da peça</ConfirmButton>
                    </form>
                  )}
                  <form action={payMember} className="pnl" style={{ padding: 16 }}>
                    <input type="hidden" name="id" value={detail.id} /><input type="hidden" name="q" value={q} />
                    <div className="row" style={{ gap: 8, marginBottom: 8 }}><span className="tile sm t-s"><Crown size={15} /></span><b>Mensalidade</b></div>
                    <NumberInput size="sm" name="months" defaultValue={1} min={1} max={12} suffix="mês" />
                    <div className="dim" style={{ fontSize: 12, margin: "6px 0 10px" }}>+{c.monthlyPoints} pts por mês pago</div>
                    <ConfirmButton className="btn sm" message="Registrar a mensalidade como paga?">Registrar pagamento</ConfirmButton>
                  </form>
                </div>
              </div>

              <div className="stack">
                <Panel title="Extrato de pontos" body={false}>
                  {detail.entries.length ? detail.entries.map((e) => (
                    <div className="lrow" key={e.id} style={{ padding: "10px 16px" }}>
                      <div style={{ minWidth: 0, flex: 1 }}><div className="t" style={{ fontSize: 13.5 }}>{REASON[e.reason] ?? e.reason}</div><div className="s">{e.note ?? ""} · {fmtH.format(e.createdAt)}</div></div>
                      <b className={e.delta < 0 ? "dn" : "up"}>{e.delta > 0 ? "+" : ""}{e.delta}</b>
                    </div>
                  )) : <div className="empty" style={{ padding: 16 }}>Nada ainda.</div>}
                </Panel>
                {detail.rewards.length > 0 && (
                  <Panel title="Cupons de resgate" body={false}>
                    {detail.rewards.map((r) => (
                      <div className="lrow" key={r.id} style={{ padding: "10px 16px" }}>
                        <span className="trk">{r.code}</span>
                        <div className="s" style={{ flex: 1 }}>{brl(r.value)} · {r.usedAt ? `usado no ${r.orderName}` : "ainda não usado"}</div>
                        {!r.usedAt && <CopyButton text={r.code} className="btn sm ghost" label="Copiar" />}
                      </div>
                    ))}
                  </Panel>
                )}
                <Panel title="Mensagem de boas-vindas">
                  <div className="code" style={{ fontSize: 12.5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{msgTxt}</div>
                  <div className="row" style={{ marginTop: 10, gap: 6 }}>
                    <CopyButton text={msgTxt} className="btn sm" label="Copiar" />
                    <a className="btn sm ghost" target="_blank" rel="noreferrer" href={waLink(detail.phone ?? "sem-", msgTxt)}><MessageCircle size={14} /> Abrir no WhatsApp</a>
                  </div>
                </Panel>
                <details className="pnl" style={{ padding: 16 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>Editar dados, ajustar pontos ou cancelar</summary>
                  <form action={updateMember} className="stack" style={{ gap: 8, marginTop: 12 }}>
                    <input type="hidden" name="id" value={detail.id} /><input type="hidden" name="q" value={q} />
                    <input className="in" name="name" defaultValue={detail.name} />
                    <input className="in" name="cpf" defaultValue={fmtCpf(detail.cpf)} placeholder="CPF" />
                    <input className="in" name="phone" defaultValue={detail.phone ?? ""} placeholder="WhatsApp" />
                    <input className="in" name="email" defaultValue={detail.email ?? ""} placeholder="E-mail" />
                    <div><button className="btn sm" type="submit">Salvar dados</button></div>
                  </form>
                  <form action={adjustPoints} className="row" style={{ gap: 6, marginTop: 12 }}>
                    <input type="hidden" name="id" value={detail.id} /><input type="hidden" name="q" value={q} />
                    <input className="in" name="delta" placeholder="+50 ou -20" style={{ width: 110, height: 34 }} />
                    <input className="in" name="note" placeholder="Motivo" style={{ flex: 1, height: 34 }} />
                    <button className="btn sm" type="submit">Ajustar</button>
                  </form>
                  <form action={cancelMember} style={{ marginTop: 12 }}>
                    <input type="hidden" name="id" value={detail.id} /><input type="hidden" name="q" value={q} />
                    <ConfirmButton className="btn sm ghost" message={detail.status === "cancelado" ? "Reativar este membro?" : "Cancelar o clube desta pessoa? O cupom de membro é desligado."}>{detail.status === "cancelado" ? "Reativar membro" : "Cancelar assinatura"}</ConfirmButton>
                  </form>
                </details>
              </div>
            </div>
          );
        })()}
      </section>

      <Panel title="Membros" body={false}
        right={<div className="chips">{[["", "Todos"], ["ativos", "Em dia"], ["atraso", "Em atraso"], ["cancelados", "Cancelados"]].map(([k, l]) => <Link key={l} href={k ? `/clube?f=${k}` : "/clube"} className={filter === k ? "on" : ""}>{l}</Link>)}</div>}>
        {list.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="tb">
              <thead><tr><th>Membro</th><th>CPF</th><th>Situação</th><th>Pago até</th><th>Cupom</th><th className="r">Pontos</th><th className="r">Vale</th></tr></thead>
              <tbody>
                {listView.map((m) => {
                  const s = st(m);
                  return (
                    <tr key={m.id}>
                      <td><Link href={`/clube?q=${encodeURIComponent(m.cpf ?? m.phone ?? m.email ?? m.name)}`} style={{ color: "inherit", fontWeight: 600 }}>{m.name}</Link><div className="dim" style={{ fontSize: 12 }}>{m.phone ? formatPhone(m.phone) : m.email ?? ""}</div></td>
                      <td className="dim">{maskCpf(m.cpf)}</td>
                      <td><span style={{ color: s.tone === "l" ? "var(--lagoon)" : s.tone === "c" ? "var(--coral)" : s.tone === "s" ? "var(--sun)" : "var(--ink3)", fontWeight: 600, fontSize: 13 }}>{s.label}</span></td>
                      <td>{m.paidUntil ? fmt.format(m.paidUntil) : "–"}</td>
                      <td>{m.code ? <span className="trk" style={{ opacity: m.codeActive ? 1 : 0.5 }}>{m.code}</span> : "–"}</td>
                      <td className="r"><b>{m.points.toLocaleString("pt-BR")}</b></td>
                      <td className="r">{money(m.points)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "12px 20px", fontSize: 13 }}>
                <span className="dim">{((pg - 1) * PER + 1).toLocaleString("pt-BR")} a {Math.min(pg * PER, list.length).toLocaleString("pt-BR")} de {list.length.toLocaleString("pt-BR")} membros</span>
                <div className="row" style={{ gap: 8 }}>
                  {pg > 1 && <Link className="btn sm ghost" href={pgHref(pg - 1)}>Anteriores</Link>}
                  {pg < pages && <Link className="btn sm ghost" href={pgHref(pg + 1)}>Próximos</Link>}
                </div>
              </div>
            )}
          </div>
        ) : <div className="empty-art"><Crown size={26} className="dim" /><div>Nenhum membro ainda. Clique em Novo membro para cadastrar o primeiro.</div></div>}
      </Panel>
    </>
  );
}

type Mem = { id: string; phone: string | null; status: string; paidUntil: Date | null };
async function MsgPanel({ all, c, n }: { all: Mem[]; c: Awaited<ReturnType<typeof getSettings>>["club"]; n?: string }) {
        const sample = all.find((m) => m.phone && m.status !== "cancelado");
        const [pw, pp] = sample ? await Promise.all([clubText(sample.id, "boasvindas"), clubText(sample.id, "pontos", { pts: 120, order: "#4400" })]) : [null, null];
        const emDia = all.filter((m) => m.status !== "cancelado" && m.phone && m.paidUntil && m.paidUntil.getTime() + c.graceDays * 864e5 >= Date.now()).length;
        return (
          <Panel title="Mensagens para os membros" sub="Saem pelo número do WhatsApp conectado, com a proteção de envio" right={<Link className="menu-b" href="/clube" aria-label="Fechar"><X size={16} /></Link>}>
            {n && <div className="ok" style={{ marginBottom: 12 }}>{n} membros vão receber o aviso.</div>}
            <div className="cols c-1-1" style={{ gap: 14 }}>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between" }}><b>Boas-vindas ao assinar</b><AutoToggle action={toggleClubMsg} k="msgWelcome" on={c.msgWelcome} label="Os novos membros" /></div>
                <p className="dim" style={{ fontSize: 12.5 }}>Um minuto depois do pagamento: regras, como usar o desconto, cupom e link dos pontos.</p>
                {pw && <pre className="msgprev">{pw}</pre>}
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between" }}><b>Cupom de aniversário</b><AutoToggle action={toggleClubMsg} k="msgBirthday" on={c.msgBirthday} label="Os aniversariantes" /></div>
                <p className="dim" style={{ fontSize: 12.5 }}>No dia 1 do mês do aniversário: o cupom de {c.birthdayPct}% com o link que já aplica.</p>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between" }}><b>Subiu de nível</b><AutoToggle action={toggleClubMsg} k="msgTier" on={c.msgTier} label="Quem completar 3, 6 ou 12 meses" /></div>
                <p className="dim" style={{ fontSize: 12.5 }}>Avisa do brinde a caminho e manda o link da coleção exclusiva do nível.</p>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between" }}><b>Pontos de cada compra</b><AutoToggle action={toggleClubMsg} k="msgPoints" on={c.msgPoints} label="Os membros que comprarem" /></div>
                <p className="dim" style={{ fontSize: 12.5 }}>Quando a compra de um membro soma pontos. Se ele responder RESGATAR, recebe o link para trocar na hora.</p>
                {pp && <pre className="msgprev">{pp}</pre>}
              </div>
            </div>
            <form action={launchClubMsg} className="stack" style={{ gap: 8, marginTop: 18 }}>
              <b>Aviso de lançamento</b>
              <p className="dim" style={{ fontSize: 12.5 }}>Vai para os {emDia} membros em dia. Use {"{nome}"}, {"{pontos}"}, {"{valor}"}, {"{horas}"}, {"{pct}"}, {"{clube}"} e {"{link}"}: cada um recebe com os próprios números.</p>
              <textarea className="in" name="text" rows={6} defaultValue={LAUNCH_DEFAULT} />
              <div><ConfirmButton className="btn pri sm" disabled={!emDia} message={`Mandar o aviso para ${emDia} membros agora?`}>Mandar aviso de lançamento</ConfirmButton></div>
            </form>
            <p className="dim" style={{ fontSize: 12.5, marginTop: 12 }}>Desconto automático no checkout: {c.autoDiscountId ? `ativo (${c.discountPct}% para quem tem a marcação "clube" na Shopify)` : "sendo criado na loja (o Hub cria sozinho em alguns minutos)"}.</p>
          </Panel>
        );
}
