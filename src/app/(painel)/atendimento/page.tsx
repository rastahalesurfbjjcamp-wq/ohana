import Link from "next/link";
import { Bot, Check, CheckCheck, MessageCircle, Search, UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { normalizePhone } from "@/lib/segments";
import { customers, lastOrderOf, type Order } from "@/lib/store";
import { brl } from "@/lib/time";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ChatComposer } from "@/components/ChatComposer";
import { replyChat, saveQuickReplies, threadAction } from "../acoes3";
import { chatList, chatNote, chatSchedule, chatScheduleCancel, chatTag } from "../acoes13";
import { rfmOf } from "@/lib/audience";
import { RFM_SEGMENTS } from "@/lib/audienceTypes";
import { ordersBetween } from "@/lib/store";

export const dynamic = "force-dynamic";

const TONES = ["#7cb4fb", "#4ad781", "#f87171", "#f7c928", "#b4a1fb"];
const initials = (n: string) => n.replace(/[^\p{L}\s]/gu, "").split(" ").filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "•";
const tz = "America/Sao_Paulo";
function when(d: Date) {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "agora";
  if (diff < 864e5 && new Date().toLocaleDateString("pt-BR", { timeZone: tz }) === d.toLocaleDateString("pt-BR", { timeZone: tz })) return d.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  if (diff < 6 * 864e5) return d.toLocaleDateString("pt-BR", { timeZone: tz, weekday: "short" }).replace(".", "");
  return d.toLocaleDateString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" });
}
const SHIP: Record<string, string> = { DELIVERED: "entregue", IN_TRANSIT: "em trânsito", OUT_FOR_DELIVERY: "saiu para entrega", FULFILLED: "postado" };

export default async function Atendimento({ searchParams }: { searchParams: Promise<{ p?: string; tel?: string; f?: string; q?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  const me = session?.name ?? "";
  const s = await getSettings();
  const f = sp.f ?? "aguardando";
  const phoneSel = normalizePhone(sp.tel ?? sp.p ?? "") ?? sp.p ?? null;
  const all = await db.chatThread.findMany({ orderBy: { lastAt: "desc" }, take: 300 });
  const lastBy = new Map((await db.chatMessage.findMany({ where: { phone: { in: all.map((t) => t.phone) } }, orderBy: { createdAt: "desc" }, distinct: ["phone"], select: { phone: true, fromMe: true, by: true } })).map((m) => [m.phone, m]));
  const groups: Record<string, (t: (typeof all)[number]) => boolean> = {
    voce: (t) => t.status === "aberto" && t.assignee === me,
    equipe: (t) => t.status === "aberto" && !!t.assignee && t.assignee !== me,
    aguardando: (t) => t.status === "aberto" && (t.unread > 0 || lastBy.get(t.phone)?.fromMe === false),
    robo: (t) => t.status === "aberto" && t.aiEnabled && !t.assignee,
    concluido: (t) => t.status === "resolvido",
  };
  const q = (sp.q ?? "").toLowerCase().trim();
  const threads = all.filter((t) => (groups[f] ?? groups.aguardando)(t) && (!q || `${t.name ?? ""} ${t.phone}`.toLowerCase().includes(q.replace(/\D/g, "") || q)));
  const current = phoneSel ? all.find((t) => t.phone === phoneSel) ?? null : null;
  const messages = phoneSel ? await db.chatMessage.findMany({ where: { phone: phoneSel }, orderBy: { createdAt: "asc" }, take: 300 }) : [];
  if (current?.unread) await db.chatThread.update({ where: { phone: current.phone }, data: { unread: 0 } });

  // Painel do cliente
  let cust: Awaited<ReturnType<typeof customers>>[number] | null = null;
  let order: Order | null = null;
  if (phoneSel) {
    cust = (await customers().catch(() => [])).find((c) => normalizePhone(c.phone) === phoneSel) ?? null;
    if (cust) order = await lastOrderOf(cust.id).catch(() => null);
  }
  const [lead, inGroup, quickRow, users] = await Promise.all([
    phoneSel ? db.lead.findUnique({ where: { phone: phoneSel } }) : null,
    phoneSel ? db.membership.count({ where: { contact: { phone: phoneSel }, leftAt: null, group: { isCommunity: true } } }) : 0,
    db.setting.findUnique({ where: { key: "_quick_replies" } }),
    db.user.findMany({ select: { name: true } }),
  ]);
  const libQuick = (await db.messageTemplate.findMany({ where: { kind: "resposta" }, orderBy: { name: "asc" } })).map((t) => ((t.parts ?? []) as { text?: string }[]).map((p) => p.text).filter(Boolean).join("\n\n")).filter(Boolean);
  const quick = [...((quickRow?.value as { items?: string[] } | undefined)?.items ?? []), ...libQuick];
  const [tags, allLists, myLists, scheds, myOrders] = phoneSel ? await Promise.all([
    db.contactTag.findMany({ where: { phone: phoneSel }, orderBy: { createdAt: "asc" } }),
    db.contactList.findMany({ where: { dynamic: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.listMember.findMany({ where: { phone: phoneSel }, include: { list: { select: { name: true } } } }),
    db.chatSchedule.findMany({ where: { phone: phoneSel }, orderBy: { at: "desc" }, take: 6 }),
    ordersBetween(new Date(Date.now() - 180 * 864e5), new Date()).then((os) => os.filter((o) => normalizePhone(o.phone) === phoneSel).slice(0, 5)).catch(() => [] as Order[]),
  ]) : [[], [], [], [], [] as Order[]];
  let rfm: (typeof RFM_SEGMENTS)[number] | undefined;
  if (cust) {
    const all = await customers().catch(() => []);
    const sorted = all.map((c) => c.spent).sort((a, b) => a - b);
    const mCut = [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.floor(q * (sorted.length - 1))] ?? 0);
    const k = rfmOf(cust, mCut).seg;
    rfm = RFM_SEGMENTS.find((x) => x.k === k);
  }
  const nowLocal = new Date(Date.now() - 3 * 3600_000 + 3600_000).toISOString().slice(0, 16);
  const displayName = current?.name ?? cust?.name ?? lead?.name ?? (phoneSel ? formatPhone(phoneSel) : "");
  const fmtT = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const fmtD = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "2-digit", month: "long" });
  const by: Record<string, string> = { ia: "Assistente IA", equipe: "Equipe", sistema: "Automático" };
  const count = (k: string) => all.filter(groups[k]).length;
  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const v: Record<string, string | undefined> = { f: sp.f, q: sp.q, p: phoneSel ?? undefined, ...extra };
    for (const [k, val] of Object.entries(v)) if (val) p.set(k, val);
    return `/atendimento${p.toString() ? `?${p}` : ""}`;
  };
  let lastDay = "";

  return (
    <>
      <AutoRefresh seconds={12} />
      <div className={`inbox${sp.tel || sp.p ? " has-chat" : ""}`}>
        <aside className="ib-list">
          <form className="srch" action="/atendimento" style={{ minWidth: 0 }}>
            <Search size={15} className="dim" />
            <input name="q" defaultValue={sp.q} placeholder="Nome ou telefone" />
            {sp.f && <input type="hidden" name="f" value={sp.f} />}
          </form>
          <div className="ib-tabs">
            {[["voce", "Você"], ["equipe", "Equipe"], ["aguardando", "Aguardando"], ["robo", "Robô"], ["concluido", "Concluído"]].map(([k, l]) => (
              <Link key={k} href={link({ f: k, p: undefined })} className={f === k ? "on" : ""}>{l}{count(k) > 0 && k !== "concluido" && <span>{count(k)}</span>}</Link>
            ))}
          </div>
          <div className="ib-items">
            {threads.map((t, i) => {
              const nm = t.name ?? formatPhone(t.phone);
              const lb = lastBy.get(t.phone);
              return (
                <Link key={t.phone} href={link({ p: t.phone, tel: undefined })} className={`ib-it${t.phone === phoneSel ? " on" : ""}`}>
                  <span className="av-s" style={{ color: TONES[i % 5], background: `${TONES[i % 5]}1f` }}>{t.name ? initials(t.name) : "•"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 6, flexWrap: "nowrap" }}>
                      <b>{nm}</b>
                      <small className={t.unread ? "up" : "dim"}>{when(t.lastAt)}</small>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between", gap: 6, flexWrap: "nowrap" }}>
                      <span className="pv">{lb?.fromMe ? (lb.by === "ia" ? "Robô: " : "Você: ") : ""}{t.lastText}</span>
                      {t.unread > 0 && <span className="ub">{t.unread}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
            {!threads.length && <div className="empty" style={{ padding: 24 }}>Nenhuma conversa aqui.</div>}
          </div>
        </aside>

        <section className="ib-chat">
          {phoneSel ? (
            <>
              <div className="ib-h">
                <Link href="/atendimento" className="ib-back" aria-label="Voltar para a lista">‹</Link>
                <span className="av-s">{initials(displayName)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{displayName}</b>
                  <small>{formatPhone(phoneSel)} · {current?.aiEnabled && !current.assignee ? "o robô está respondendo" : current?.assignee ? `com ${current.assignee}` : "WhatsApp conectado"}</small>
                </div>
                {current && (
                  <form action={threadAction} className="row" style={{ gap: 8 }}>
                    <input type="hidden" name="phone" value={current.phone} />
                    {current.aiEnabled || current.assignee !== me ? <button className="btn pri" name="act" value="ia_off"><UserCheck size={15} /> Assumir conversa</button> : <button className="btn" name="act" value="ia_on"><Bot size={15} /> Devolver para o robô</button>}
                    {current.status === "aberto" ? <button className="btn" name="act" value="resolver"><Check size={15} /> Concluir</button> : <button className="btn" name="act" value="reabrir">Reabrir</button>}
                  </form>
                )}
              </div>
              <div className="ib-msgs">
                {messages.map((m) => {
                  const day = fmtD.format(m.createdAt);
                  const sep = day !== lastDay ? (lastDay = day) : null;
                  return (
                    <div key={m.id} style={{ display: "contents" }}>
                      {sep && <div className="ib-day">{sep}</div>}
                      {m.by === "nota" ? (
                        <div className="ib-note nota">Nota interna · {m.text}</div>
                      ) : m.by === "sistema" ? (
                        <div className="ib-note">{m.text.length > 140 ? `${m.text.slice(0, 140)}…` : m.text}</div>
                      ) : (
                        <div className={`bub ${m.fromMe ? "me" : "them"}${m.by === "ia" ? " ia" : ""}`}>
                          <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                          <small>{m.fromMe ? `${by[m.by] ?? m.by} · ` : ""}{fmtT.format(m.createdAt)}{m.fromMe && <CheckCheck size={13} />}</small>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!messages.length && <div className="empty-art"><MessageCircle size={28} className="dim" /><div>Nenhuma mensagem ainda com essa pessoa. Escreva abaixo para começar.</div></div>}
              </div>
              <ChatComposer action={replyChat} phone={phoneSel} name={displayName} quick={quick} coupon={s.postsale.coupon} tracking={order?.tracking?.url ?? order?.tracking?.number ?? null} exchangeUrl={`${s.postsale.storeUrl.replace(/\/$/, "")}/pages/trocas`} />
            </>
          ) : (
            <div className="empty-art" style={{ margin: "auto" }}>
              <MessageCircle size={34} className="dim" />
              <b>Escolha uma conversa</b>
              <div className="dim" style={{ maxWidth: 340 }}>{s.assistant.enabled ? "O robô com IA responde sozinho até alguém da equipe assumir." : "O robô com IA está desligado. Ligue em Assistente IA."}</div>
              <Link className="btn sm" href="/assistente"><Bot size={14} /> Assistente IA</Link>
            </div>
          )}
        </section>

        <aside className="ib-side">
          {phoneSel ? (
            <>
              <div className="row" style={{ gap: 12, flexWrap: "nowrap" }}>
                <span className="av-s" style={{ width: 44, height: 44, fontSize: 14 }}>{initials(displayName)}</span>
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 15 }}>{displayName}</b>
                  <div className="dim" style={{ fontSize: 12 }}>{cust ? `cliente desde ${new Date(cust.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}` : lead ? "lead" : "contato"}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 6, margin: "12px 0" }}>
                {inGroup > 0 && <span className="chip c-l">No grupo</span>}
                {cust && (cust.orders >= 3 || cust.spent >= 1000) && <span className="chip c-s">VIP</span>}
                {cust?.tags.slice(0, 3).map((t) => <span className="chip c-n" key={t}>{t}</span>)}
                {!cust && lead && <span className="chip c-k">lead</span>}
                {rfm && <span className="chip" style={{ background: `${rfm.color}26`, color: rfm.color }} title={`${rfm.desc}. Sugestão: ${rfm.action}`}>{rfm.label}</span>}
              </div>
              <div className="ib-sec">Resumo</div>
              <div className="kv"><span className="mut">Total gasto</span><b>{cust ? brl(cust.spent) : "-"}</b></div>
              <div className="kv"><span className="mut">Pedidos</span><b>{cust?.orders ?? 0}</b></div>
              <div className="kv"><span className="mut">Cidade</span><b>{cust ? [cust.city, cust.state].filter(Boolean).join(" / ") || "-" : "-"}</b></div>
              {lead && <div className="kv"><span className="mut">Veio de</span><b>{lead.utmSource ?? lead.source}</b></div>}
              {order && (
                <>
                  <div className="ib-sec">Último pedido</div>
                  <div className="ib-order">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {order.images[0] ? <img src={order.images[0]} alt="" /> : <span className="tile sm t-n" />}
                    <div style={{ minWidth: 0 }}>
                      <b>{order.name} · {order.lines[0]?.title}{order.lines[0]?.variant ? ` ${order.lines[0].variant}` : ""}</b>
                      <small>{brl(order.total, 0)} · {order.shipStatus ? SHIP[order.shipStatus] ?? order.shipStatus.toLowerCase() : order.financial === "PAID" ? "aguardando postagem" : "aguardando pagamento"}</small>
                    </div>
                  </div>
                </>
              )}
              {myOrders.length > 1 && (
                <>
                  <div className="ib-sec">Pedidos</div>
                  {myOrders.map((o) => <div key={o.id} className="kv"><span className="mut">{o.name} · {new Date(o.createdAt).toLocaleDateString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" })}</span><b>{brl(o.total, 0)} <small className={o.financial === "PAID" ? "up" : "dn"}>{o.financial === "PAID" ? "pago" : "não pago"}</small></b></div>)}
                </>
              )}
              <div className="ib-sec">Etiquetas</div>
              <div className="row" style={{ gap: 5, flexWrap: "wrap" }}>
                {tags.map((t) => <form key={t.tag} action={chatTag}><input type="hidden" name="phone" value={phoneSel} /><input type="hidden" name="tag" value={t.tag} /><input type="hidden" name="act" value="remove" /><button className="chip c-k ib-tag" type="submit" title="Tirar etiqueta">{t.tag} ×</button></form>)}
                <form action={chatTag} className="row" style={{ gap: 4 }}><input type="hidden" name="phone" value={phoneSel} /><input className="in" name="tag" placeholder="+ etiqueta" style={{ height: 28, width: 110, fontSize: 12 }} /></form>
              </div>
              <div className="ib-sec">Listas</div>
              <div className="row" style={{ gap: 5, flexWrap: "wrap" }}>
                {myLists.map((m) => <form key={m.listId} action={chatList}><input type="hidden" name="phone" value={phoneSel} /><input type="hidden" name="listId" value={m.listId} /><input type="hidden" name="act" value="remove" /><button className="chip c-n ib-tag" type="submit" title={allLists.some((l) => l.id === m.listId) ? "Tirar da lista" : "Lista por regra"} disabled={!allLists.some((l) => l.id === m.listId)}>{m.list.name}{allLists.some((l) => l.id === m.listId) ? " ×" : ""}</button></form>)}
                {allLists.filter((l) => !myLists.some((m) => m.listId === l.id)).length > 0 && (
                  <form action={chatList} className="row" style={{ gap: 4 }}><input type="hidden" name="phone" value={phoneSel} /><input type="hidden" name="name" value={displayName} />
                    <select className="in" name="listId" style={{ height: 28, fontSize: 12, width: 130 }}>{allLists.filter((l) => !myLists.some((m) => m.listId === l.id)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                    <button className="btn sm" type="submit" style={{ height: 28 }}>+</button>
                  </form>
                )}
              </div>
              <div className="ib-sec">Nota interna</div>
              <form action={chatNote} className="stack" style={{ gap: 6 }}>
                <input type="hidden" name="phone" value={phoneSel} />
                <textarea className="in" name="text" rows={2} placeholder="Só a equipe vê. Ex.: quer trocar a G pela M" style={{ fontSize: 12.5, height: "auto", padding: 8 }} />
                <div><button className="btn sm" type="submit">Salvar nota</button></div>
              </form>
              <div className="ib-sec">Mensagem agendada</div>
              <form action={chatSchedule} className="stack" style={{ gap: 6 }}>
                <input type="hidden" name="phone" value={phoneSel} />
                <input className="in" type="datetime-local" name="at" defaultValue={nowLocal} style={{ height: 34, fontSize: 12.5 }} />
                <textarea className="in" name="text" rows={3} placeholder="Ex.: Oi {nome}, conseguiu ver o tamanho?" style={{ fontSize: 12.5, height: "auto", padding: 8 }} />
                <label className="check" style={{ fontSize: 12 }}><input type="checkbox" name="cReply" defaultChecked /> Cancelar se o cliente escrever</label>
                <label className="check" style={{ fontSize: 12 }}><input type="checkbox" name="cAgent" /> Cancelar se alguém da equipe escrever</label>
                <label className="check" style={{ fontSize: 12 }}><input type="checkbox" name="cArchive" defaultChecked /> Cancelar se a conversa for concluída</label>
                <div><button className="btn sm" type="submit">Agendar envio</button></div>
              </form>
              {scheds.map((m) => (
                <div key={m.id} className="kv" style={{ alignItems: "flex-start" }}>
                  <span className="mut" style={{ fontSize: 12 }}>{m.at.toLocaleString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {m.text.slice(0, 40)}{m.text.length > 40 ? "…" : ""}</span>
                  {m.status === "agendada" ? <form action={chatScheduleCancel}><input type="hidden" name="id" value={m.id} /><button className="chip c-k ib-tag" type="submit">agendada ×</button></form> : <span className={`chip ${m.status === "enviada" ? "c-l" : m.status === "erro" ? "c-c" : "c-n"}`} title={m.note ?? ""}>{m.status}</span>}
                </div>
              ))}
              {current && (
                <>
                  <div className="ib-sec">Responsável</div>
                  <form action={threadAction} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <input type="hidden" name="phone" value={current.phone} />
                    <input type="hidden" name="act" value="assign" />
                    <select className="in" name="assignee" defaultValue={current.assignee ?? ""} style={{ height: 38 }}>
                      <option value="">Robô / ninguém</option>
                      {users.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
                    </select>
                    <button className="btn sm" type="submit">Salvar</button>
                  </form>
                </>
              )}
            </>
          ) : (
            <>
              <div className="ib-sec" style={{ marginTop: 0 }}>Respostas rápidas</div>
              <form action={saveQuickReplies} className="stack" style={{ gap: 8 }}>
                <textarea className="in" name="items" defaultValue={quick.join("\n\n")} style={{ minHeight: 260, fontSize: 13 }} placeholder={"Uma resposta por bloco, separadas por uma linha em branco.\n\nOi {nome}! Tudo bem? Como posso ajudar?\n\nO prazo de entrega para o Rio é de 2 a 4 dias úteis."} />
                <span className="dim" style={{ fontSize: 12 }}>Separe com uma linha em branco. {"{nome}"} vira o primeiro nome.</span>
                <div><button className="btn pri sm" type="submit">Salvar respostas</button></div>
              </form>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
