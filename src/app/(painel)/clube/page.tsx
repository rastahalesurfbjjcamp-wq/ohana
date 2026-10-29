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
import { addMember, adjustPoints, cancelMember, eventCheckin, payMember, redeemPoints, saveClubRules, scanClubNow, updateMember } from "../acoes6";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = { compra: "Compra", estorno: "Estorno", mensalidade: "Mensalidade", resgate: "Resgate", evento: "Evento", ajuste: "Ajuste", bonus: "Bônus" };
const OK: Record<string, string> = { pago: "Mensalidade registrada. O cupom de membro está ligado.", entrada: "Entrada no evento registrada.", ajuste: "Pontos ajustados.", regras: "Regras salvas.", "1": "Salvo." };

export default async function Clube({ searchParams }: { searchParams: Promise<{ q?: string; novo?: string; erro?: string; ok?: string; cupom?: string; criado?: string; regras?: string; somados?: string; f?: string; editar?: string }> }) {
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

  return (
    <>
      <Header title="Clube de fidelidade" lede={`${c.name}: mensalidade de ${brl(c.fee)}, ${c.discountPct}% de desconto em toda compra, acesso antecipado e pontos que viram desconto ou entrada nos eventos.`}>
        <form action={scanClubNow}><button className="btn" type="submit" title="Puxa as compras dos últimos 30 dias e soma os pontos"><RefreshCw size={15} /> Atualizar pontos</button></form>
        <Link className="btn" href={sp.regras ? "/clube" : "/clube?regras=1"}><Settings2 size={15} /> Regras</Link>
        <Link className="btn pri" href={sp.novo ? "/clube" : "/clube?novo=1"}><Plus size={16} /> Novo membro</Link>
      </Header>
      {sp.ok && <div className="ok">{OK[sp.ok] ?? "Salvo."}</div>}
      {sp.somados && <div className="ok">{Number(sp.somados) ? `${sp.somados} pontos somados das compras.` : "Nenhuma compra nova de membro para somar."}</div>}
      {sp.erro && sp.erro !== "nome" && <div className="err">{sp.erro}</div>}

      {sp.regras && (
        <Panel title="Regras do clube" sub="Valem para todos os membros" right={<Link className="menu-b" href="/clube" aria-label="Fechar"><X size={16} /></Link>}>
          <form action={saveClubRules} className="stack" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Nome do clube</label><input className="in" name="name" defaultValue={c.name} /></div>
              <label className="check" style={{ alignSelf: "flex-end", paddingBottom: 10 }}><input type="checkbox" name="enabled" defaultChecked={c.enabled} /> Somar pontos automaticamente</label>
            </div>
            <div className="rule-grid">
              <div className="rule"><span>Mensalidade</span><NumberInput name="fee" defaultValue={c.fee} prefix="R$" decimals={2} step={1} /><small>quanto o membro paga por mês</small></div>
              <div className="rule"><span>Desconto do membro</span><NumberInput name="discountPct" defaultValue={c.discountPct} suffix="%" max={50} /><small>em toda compra na loja</small></div>
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
        <div className="pnl kpi"><small>Receita por mês</small><span className="num">{brl(active.reduce((a, m) => a + (m.fee || c.fee), 0), 0)}</span><div className="sub">mensalidades dos membros em dia</div></div>
        <div className={`pnl kpi ${late.length ? "warnk" : ""}`}><small>Em atraso</small><span className="num" style={late.length ? { color: "var(--sun)" } : undefined}>{late.length}</span><div className="sub">cupom desligado depois de {c.graceDays} dias</div></div>
        <div className="pnl kpi"><small>Pontos em aberto</small><span className="num">{pts.toLocaleString("pt-BR")}</span><div className="sub">valem {money(pts)} em desconto</div></div>
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
                {list.map((m) => {
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
          </div>
        ) : <div className="empty-art"><Crown size={26} className="dim" /><div>Nenhum membro ainda. Clique em Novo membro para cadastrar o primeiro.</div></div>}
      </Panel>
    </>
  );
}
