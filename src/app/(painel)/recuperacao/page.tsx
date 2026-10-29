import Link from "next/link";
import { CreditCard, Gift, HeartHandshake, MessageCircle, QrCode, RotateCcw, ShoppingCart, Star, Truck, UserPlus, X, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { brl, pct } from "@/lib/time";
import { Header, Panel } from "@/components/ui";
import { NumberInput } from "@/components/NumberInput";
import { AutoToggle } from "@/components/AutoToggle";
import { stopCase } from "../acoes3";
import { saveRecoveryMessages, toggleAutomation } from "../acoes4";

export const dynamic = "force-dynamic";

const KIND: Record<string, [string, string]> = { carrinho: ["Carrinho", "c-s"], pix: ["Pix pendente", "c-k"], rastreio: ["Rastreio", "c-n"], entregue: ["Entregue", "c-n"], avaliacao: ["Avaliação", "c-n"], recompra: ["Recompra", "c-n"] };
const RANGES: [string, string, number][] = [["hoje", "Hoje", 1], ["7", "7 dias", 7], ["30", "30 dias", 30]];

function fmtDelay(min: number) {
  if (min < 60) return `${min} min`;
  if (min % 1440 === 0) return `${min / 1440} d`;
  if (min % 60 === 0) return `${min / 60} h`;
  return `${Math.round(min / 60)} h`;
}
function until(d: Date | null) {
  if (!d) return "–";
  const m = Math.round((d.getTime() - Date.now()) / 60000);
  if (m <= 0) return "agora";
  if (m < 60) return `em ${m} min`;
  if (m < 1440) return `em ${Math.round(m / 60)} h`;
  return `em ${Math.round(m / 1440)} d`;
}

function StepFields({ prefix, i, step }: { prefix: string; i: number; step?: { delayMin: number; text: string } }) {
  const hours = step && step.delayMin >= 60 && step.delayMin % 60 === 0;
  return (
    <div className="stepbox">
      <div className="row" style={{ gap: 8 }}>
        <span className="stepn">{i + 1}</span>
        <span className="mut" style={{ fontSize: 13 }}>Mandar</span>
        <NumberInput size="sm" name={`${prefix}${i}_delay`} defaultValue={step ? (hours ? step.delayMin / 60 : step.delayMin) : ""} />
        <select className="in" name={`${prefix}${i}_unit`} defaultValue={hours ? "h" : "m"} style={{ width: 120, height: 34 }}>
          <option value="m">minutos</option>
          <option value="h">horas</option>
        </select>
        <span className="mut" style={{ fontSize: 13 }}>{i === 0 ? "depois do evento" : "depois da anterior"}</span>
      </div>
      <textarea className="in" name={`${prefix}${i}_text`} defaultValue={step?.text ?? ""} style={{ minHeight: 70 }} placeholder="Deixe vazio para não usar esta mensagem" />
    </div>
  );
}

export default async function Recuperacao({ searchParams }: { searchParams: Promise<{ k?: string; ok?: string; r?: string; cfg?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const range = RANGES.find((x) => x[0] === sp.r) ?? RANGES[2];
  const since = range[2] === 1 ? new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) + "T03:00:00Z") : new Date(Date.now() - range[2] * 864e5);
  const k = sp.k ?? "todos";
  const [period, active] = await Promise.all([
    db.recoveryCase.findMany({ where: { createdAt: { gte: since } } }),
    db.recoveryCase.findMany({ where: { ...(k === "todos" ? { status: { in: ["ativo", "recuperado"] } } : { kind: k }), createdAt: { gte: new Date(Date.now() - 7 * 864e5) } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 60 }),
  ]);
  const of = (kind: string) => period.filter((c) => c.kind === kind);
  const stat = (kind: string) => {
    const list = of(kind);
    const sent = list.reduce((a, c) => a + c.sentCount, 0);
    const contacted = list.filter((c) => c.sentCount > 0);
    const rec = list.filter((c) => c.status === "recuperado");
    return { n: list.length, sent, rate: contacted.length ? rec.length / contacted.length : 0, value: rec.reduce((a, c) => a + (c.recoveredValue ?? c.value), 0), total: list.reduce((a, c) => a + c.value, 0), rec: rec.length };
  };
  const cart = stat("carrinho"), pix = stat("pix"), track = stat("rastreio"), review = stat("avaliacao"), rebuy = stat("recompra");
  const recoveredAll = period.filter((c) => c.status === "recuperado");
  const recValue = recoveredAll.reduce((a, c) => a + (c.recoveredValue ?? c.value), 0);
  const sentAll = period.reduce((a, c) => a + c.sentCount, 0);

  type Card = { key: string; icon: LucideIcon; tone: string; title: string; sub: string; on: boolean; steps: number; stats: [string, string, boolean?][]; label?: string };
  const cards: Card[] = [
    { key: "carrinho", icon: ShoppingCart, tone: "t-s", title: "Carrinho abandonado", sub: s.recovery.cartSteps.map((x) => fmtDelay(x.delayMin)).join(" · ") || "sem mensagens", on: s.recovery.cartEnabled, steps: s.recovery.cartSteps.length, stats: [[String(cart.sent), "envios"], [pct(cart.rate, 0), "recuperou"], [brl(cart.value, 0), "vendas", true]] },
    { key: "pix", icon: QrCode, tone: "t-k", title: "Pix ou boleto pendente", sub: s.recovery.pixSteps.map((x) => fmtDelay(x.delayMin)).join(" · ") || "sem mensagens", on: s.recovery.pixEnabled, steps: s.recovery.pixSteps.length, stats: [[String(pix.sent), "envios"], [pct(pix.rate, 0), "pagou"], [brl(pix.value, 0), "vendas", true]] },
    { key: "rastreio", icon: Truck, tone: "t-p", title: "Rastreio e entrega", sub: `ao postar · atraso depois de ${s.recovery.delayedDays} dias`, on: s.recovery.trackingEnabled, steps: 1, stats: [[String(track.sent), "envios"], [String(track.n), "pedidos"], ["–", ""]] },
    { key: "avaliacao", icon: Star, tone: "t-l", title: "Avaliação com foto", sub: `${s.postsale.reviewDelayDays} dias depois de entregue · cupom ${s.postsale.coupon}`, on: s.postsale.reviewEnabled, steps: 1, stats: [[String(review.sent), "envios"], [String(review.n), "pedidos"], ["–", ""]] },
    { key: "recompra", icon: RotateCcw, tone: "t-n", title: "Lembrete de recompra", sub: `${s.postsale.repurchaseDays} dias sem comprar`, on: s.postsale.repurchaseEnabled, steps: 1, stats: [[String(rebuy.sent), "envios"], [pct(rebuy.rate, 0), "voltou"], [brl(rebuy.value, 0), "vendas", true]] },
    { key: "boasvindas", icon: UserPlus, tone: "t-l", title: "Boas-vindas do lead", sub: "na hora do cadastro · link do grupo", on: s.leads.welcomeEnabled, steps: 1, stats: [["", "configurar em Leads"], ["", ""], ["", ""]], label: "Os leads" },
    { key: "volta", icon: HeartHandshake, tone: "t-c", title: "Mensagem de volta", sub: `${s.winback.delayMinutes} min depois de sair do grupo`, on: s.winback.enabled, steps: 1, stats: [["", "configurar em Entradas e saídas"], ["", ""], ["", ""]], label: "Quem sai do grupo" },
    { key: "cartao", icon: CreditCard, tone: "t-n", title: "Cartão recusado", sub: "entra junto com o carrinho abandonado", on: s.recovery.cartEnabled, steps: 0, stats: [["", "a Shopify trata como checkout não concluído"], ["", ""], ["", ""]] },
  ];
  const editable = ["carrinho", "pix", "rastreio", "avaliacao", "recompra"];
  const cfg = sp.cfg && editable.includes(sp.cfg) ? sp.cfg : null;
  const anyOn = cards.some((c) => c.on);

  return (
    <>
      <Header title="Recuperação de vendas" lede="Mensagens automáticas no WhatsApp para quem abandonou o carrinho, gerou Pix e não pagou, e para acompanhar o pedido até depois da entrega.">
        <div className="seg">{RANGES.map(([kk, l]) => <Link key={kk} href={`/recuperacao${kk === "30" ? "" : `?r=${kk}`}`} className={range[0] === kk ? "on" : ""}>{l}</Link>)}</div>
      </Header>
      {sp.ok && <div className="ok">Mensagens salvas.</div>}
      {!anyOn && <div className="note">Tudo desligado por enquanto. Ligue cada automação na chave do cartão. Só entram carrinhos e pedidos criados depois de ligar.</div>}

      <div className="grid g4">
        <div className="pnl kpi hl">
          <small>Recuperado pelo Hub</small>
          <span className="num up" style={{ fontSize: 34 }}>{brl(recValue, 0)}</span>
          <div className="sub">{recoveredAll.length} pedido{recoveredAll.length === 1 ? "" : "s"} · {range[1].toLowerCase()}</div>
        </div>
        <div className="pnl kpi"><small>Carrinhos abandonados</small><span className="num">{brl(cart.total, 0)}</span><div className="sub">{cart.n} carrinhos · {pct(cart.n ? cart.rec / cart.n : 0, 1)} recuperados</div></div>
        <div className="pnl kpi"><small>Pix gerado e não pago</small><span className="num">{brl(pix.total, 0)}</span><div className="sub">{pix.n} Pix · {pix.rec} pagos depois do lembrete</div></div>
        <div className="pnl kpi"><small>Custo das mensagens</small><span className="num">R$ 0</span><div className="sub">pelo WhatsApp conectado · {sentAll.toLocaleString("pt-BR")} envios</div></div>
      </div>

      <div className="autos">
        {cards.map((c) => (
          <div key={c.key} className={`auto${c.on ? " on" : ""}${cfg === c.key ? " sel" : ""}`}>
            <Link href={editable.includes(c.key) ? `/recuperacao?cfg=${c.key}${sp.r ? `&r=${sp.r}` : ""}` : c.key === "boasvindas" ? "/leads?cfg=1" : c.key === "volta" ? "/entradas" : "#"} className="auto-h">
              <span className={`tile sm ${c.on ? c.tone : "t-n"}`}><c.icon size={16} /></span>
              <div style={{ minWidth: 0 }}>
                <b>{c.title}</b>
                <small>{c.sub}</small>
              </div>
            </Link>
            {c.stats[0][0] !== "" ? (
              <div className="auto-s">
                {c.stats.map(([v, l, g], i) => <div key={i}><b className={g && v !== "R$ 0" ? "up" : ""}>{v}</b><small>{l}</small></div>)}
              </div>
            ) : <div className="dim" style={{ fontSize: 12.5, padding: "6px 2px 4px", minHeight: 52 }}>{c.stats[0][1]}</div>}
            <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
              <span className="pips">{c.on ? Array.from({ length: Math.max(1, c.steps) }).map((_, i) => <i key={i} />) : <span className="dim" style={{ fontSize: 12 }}>Desligada</span>}</span>
              {c.key !== "cartao" && <AutoToggle action={toggleAutomation} k={c.key} on={c.on} label={c.label} />}
            </div>
          </div>
        ))}
      </div>

      {cfg && (
        <Panel title={`Mensagens: ${cards.find((c) => c.key === cfg)?.title}`} sub="{nome}, {produto}, {valor}, {pedido}, {link}, {rastreio} e {cupom} são trocados pelos dados de cada pessoa." right={<Link className="menu-b" href={`/recuperacao${sp.r ? `?r=${sp.r}` : ""}`} aria-label="Fechar"><X size={16} /></Link>}>
          <form action={saveRecoveryMessages} className="stack">
            <input type="hidden" name="kind" value={cfg} />
            {cfg === "carrinho" && [0, 1, 2].map((i) => <StepFields key={i} prefix="cart" i={i} step={s.recovery.cartSteps[i]} />)}
            {cfg === "pix" && [0, 1].map((i) => <StepFields key={i} prefix="pix" i={i} step={s.recovery.pixSteps[i]} />)}
            {cfg === "rastreio" && (
              <>
                <textarea className="in" name="trackingText" defaultValue={s.recovery.trackingText} style={{ minHeight: 80 }} />
                <div className="row"><span className="mut" style={{ fontSize: 13 }}>Considerar entrega atrasada depois de</span><NumberInput size="sm" name="delayedDays" defaultValue={s.recovery.delayedDays} suffix="dias" /></div>
              </>
            )}
            {cfg === "avaliacao" && (
              <>
                <div className="row"><span className="mut" style={{ fontSize: 13 }}>Mandar</span><NumberInput size="sm" name="reviewDelayDays" defaultValue={s.postsale.reviewDelayDays} suffix="dias" /><span className="mut" style={{ fontSize: 13 }}>depois de entregue, com o cupom</span><input className="in" name="coupon" defaultValue={s.postsale.coupon} style={{ width: 140, height: 34 }} /></div>
                <textarea className="in" name="reviewText" defaultValue={s.postsale.reviewText} style={{ minHeight: 80 }} />
              </>
            )}
            {cfg === "recompra" && (
              <>
                <div className="row"><span className="mut" style={{ fontSize: 13 }}>Quando completar</span><NumberInput size="sm" name="repurchaseDays" defaultValue={s.postsale.repurchaseDays} suffix="dias" step={5} /><span className="mut" style={{ fontSize: 13 }}>desde a última compra</span></div>
                <textarea className="in" name="repurchaseText" defaultValue={s.postsale.repurchaseText} style={{ minHeight: 80 }} />
              </>
            )}
            <div><button className="btn pri" type="submit">Salvar mensagens</button></div>
          </form>
        </Panel>
      )}

      <Panel title="Em recuperação agora" sub="Últimos 7 dias" body={false}
        right={<div className="chips">{[["todos", "Todos"], ["carrinho", "Carrinho"], ["pix", "Pix pendente"], ["rastreio", "Rastreio"], ["avaliacao", "Avaliação"]].map(([kk, l]) => <Link key={kk} href={`/recuperacao?k=${kk}${sp.r ? `&r=${sp.r}` : ""}`} className={k === kk ? "on" : ""}>{l}</Link>)}</div>}>
        {active.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="tb">
              <thead><tr><th>Cliente</th><th>Evento</th><th>Produto</th><th className="r">Valor</th><th>Mensagens</th><th>Próxima</th><th style={{ width: 90 }} /></tr></thead>
              <tbody>
                {active.map((c) => {
                  const total = c.kind === "carrinho" ? Math.max(1, s.recovery.cartSteps.length) : c.kind === "pix" ? Math.max(1, s.recovery.pixSteps.length) : 1;
                  const [lbl, tone] = c.status === "recuperado" ? ["Recuperado", "c-l"] : KIND[c.kind] ?? [c.kind, "c-n"];
                  return (
                    <tr key={c.id}>
                      <td><b style={{ fontWeight: 600 }}>{c.name ?? "Sem nome"}</b><div className="dim" style={{ fontSize: 12 }}>{formatPhone(c.phone)}{c.orderName ? ` · ${c.orderName}` : ""}</div></td>
                      <td><span className={`chip ${tone}`}>{lbl}</span></td>
                      <td className="mut" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.product ?? "–"}</td>
                      <td className="r"><b className={c.status === "recuperado" ? "up" : ""}>{c.value ? brl(c.recoveredValue ?? c.value) : "–"}</b></td>
                      <td>
                        <span className="msgs">
                          {Array.from({ length: total }).map((_, i) => {
                            const st = i < c.sentCount ? "sent" : i === c.sentCount && c.status === "ativo" ? "next" : "";
                            return <i key={i} className={st}>{i + 1}</i>;
                          })}
                          {c.status === "recuperado" && <i className="ok">✓</i>}
                        </span>
                      </td>
                      <td className={c.status === "recuperado" ? "up" : "mut"} style={{ whiteSpace: "nowrap" }}>{c.status === "recuperado" ? "pagou" : c.status === "ativo" ? until(c.nextAt) : c.status === "sem_resposta" ? "sem resposta" : c.status}</td>
                      <td className="r">
                        <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <Link className="wa-b" href={`/atendimento?tel=${c.phone}`} title="Abrir conversa"><MessageCircle size={15} /></Link>
                          {c.status === "ativo" && <form action={stopCase}><input type="hidden" name="id" value={c.id} /><button className="btn sm ghost" title="Parar as mensagens">Parar</button></form>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-art"><Gift size={26} className="dim" /><div>Ninguém em recuperação agora. Os casos aparecem aqui assim que as automações forem ligadas.</div></div>
        )}
      </Panel>
    </>
  );
}
