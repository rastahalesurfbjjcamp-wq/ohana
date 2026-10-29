import { revalidatePath } from "next/cache";
import { ArrowRight, ChevronRight, Laptop, Smartphone, Tablet, Target } from "lucide-react";
import { DateRange } from "@/components/DateRange";
import { GoalBars, Meter } from "@/components/charts";
import { db } from "@/lib/db";
import { conversionByDevice, funnelByDay, hasShopify, type FunnelDay } from "@/lib/store";
import { resolvePeriod } from "@/lib/periods";
import { addDays, isoDayLocal, pct } from "@/lib/time";
import { Header, NeedShopify, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const DEVICE: Record<string, [string, typeof Smartphone]> = { mobile: ["Celular", Smartphone], desktop: ["Computador", Laptop], tablet: ["Tablet", Tablet] };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

async function saveGoal(form: FormData) {
  "use server";
  const v = Number(String(form.get("goal") ?? "").replace(",", "."));
  if (!(v > 0 && v < 100)) return;
  await db.setting.upsert({ where: { key: "_conv_goal" }, create: { key: "_conv_goal", value: { rate: v / 100 } }, update: { value: { rate: v / 100 } } });
  revalidatePath("/conversao");
}

const totals = (days: FunnelDay[]) => {
  const s = (k: keyof FunnelDay) => days.reduce((a, d) => a + (d[k] as number), 0);
  const visits = s("sessions");
  return { visits, cart: s("cart"), checkout: s("checkout"), bought: s("purchased"), rate: visits ? s("purchased") / visits : 0 };
};

function Status({ rate, goal }: { rate: number; goal: number }) {
  if (rate >= goal) return <span className="chip c-l">Bateu a meta</span>;
  if (rate >= goal * 0.75) return <span className="chip c-s">Perto da meta</span>;
  return <span className="chip c-c">Abaixo da meta</span>;
}

export default async function Conversao({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string }> }) {
  const { p, de, ate } = await searchParams;
  const period = resolvePeriod(p, "30d", de, ate);
  if (!(await hasShopify())) {
    return (
      <>
        <Header title="Conversão" />
        <NeedShopify />
      </>
    );
  }
  const today = isoDayLocal();
  const histFrom = `${addDays(`${today.slice(0, 7)}-01`, -160).slice(0, 7)}-01`;
  const [days, devices, hist, goalRow] = await Promise.all([
    funnelByDay(period.from, period.to),
    conversionByDevice(period.from, period.to),
    funnelByDay(histFrom, today),
    db.setting.findUnique({ where: { key: "_conv_goal" } }),
  ]);
  const goal = (goalRow?.value as { rate?: number } | undefined)?.rate ?? 0.01;
  const fmtPct = (v: number) => `${(v * 100).toFixed(2).replace(".", ",")}%`;
  const t = totals(days ?? []);
  const h = hist ?? [];
  const cards = [
    { label: "Hoje", ...totals(h.filter((d) => d.day === today)) },
    { label: "Este mês", ...totals(h.filter((d) => d.day.slice(0, 7) === today.slice(0, 7))) },
    { label: "Últimos 90 dias", ...totals(h.filter((d) => d.day >= addDays(today, -89))) },
  ];
  const meterMax = Math.max(goal * 2, ...cards.map((c) => c.rate * 1.15));
  const byMonth = new Map<string, FunnelDay[]>();
  for (const d of h) byMonth.set(d.day.slice(0, 7), [...(byMonth.get(d.day.slice(0, 7)) ?? []), d]);
  const months = [...byMonth.entries()].sort().map(([k, v]) => ({ label: MONTHS[Number(k.slice(5)) - 1], value: totals(v).rate * 100 }));

  const steps = [
    { label: "Entraram na loja", n: t.visits },
    { label: "Colocaram no carrinho", n: t.cart },
    { label: "Foram para o pagamento", n: t.checkout },
    { label: "Compraram", n: t.bought },
  ];
  const worst = steps.slice(1).map((s, i) => ({ from: steps[i], to: s, keep: steps[i].n ? s.n / steps[i].n : 0 })).sort((a, b) => a.keep - b.keep)[0];
  // aparelhos desconhecidos viram um "Outro" só
  const devs: { device: string; sessions: number; purchased: number; rate: number }[] = [];
  for (const d of devices ?? []) {
    const key = DEVICE[d.device] ? d.device : "other";
    const cur = devs.find((x) => x.device === key);
    if (cur) { cur.sessions += d.sessions; cur.purchased += d.purchased; cur.rate = cur.sessions ? cur.purchased / cur.sessions : 0; }
    else devs.push({ device: key, sessions: d.sessions, purchased: d.purchased, rate: d.rate });
  }
  const devMax = Math.max(0.0001, ...devs.map((d) => d.rate));

  return (
    <>
      <Header title="Conversão" lede="De cada pessoa que entra na loja, quantas compram, e em que parte do caminho as outras desistem.">
        <form action={saveGoal} className="row" style={{ gap: 6 }}>
          <span className="chip c-s" style={{ height: 40, padding: "0 12px" }}><Target size={14} /> Meta</span>
          <input className="in" name="goal" defaultValue={(goal * 100).toFixed(2).replace(".", ",")} style={{ width: 74, height: 40 }} inputMode="decimal" aria-label="Meta de conversão em %" />
          <button className="btn" type="submit">Salvar</button>
        </form>
        <DateRange current={period.key} from={period.from} to={period.to} label={period.label} />
      </Header>
      {!days && <div className="err">A Shopify não liberou os dados de visitas. Confira se o app tem a permissão read_reports.</div>}
      {days && (
        <>
          <div className="cols c-1-1-1">
            {cards.map((c) => (
              <section className="pnl" style={{ padding: 22 }} key={c.label}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="mut">{c.label}</span>
                  <Status rate={c.rate} goal={goal} />
                </div>
                <div className="mid-num" style={{ marginTop: 12 }}>{fmtPct(c.rate)}</div>
                <div className="dim" style={{ fontSize: 12.5, marginTop: 4 }}>{c.bought.toLocaleString("pt-BR")} compras em {c.visits.toLocaleString("pt-BR")} visitas</div>
                <Meter value={c.rate} goal={goal} max={meterMax} format={fmtPct} />
              </section>
            ))}
          </div>

          <Panel title="O caminho do cliente" sub={`${period.label}: quantas pessoas chegam em cada etapa`}>
            <div className="cols" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0, alignItems: "stretch" }}>
              {steps.map((s, i) => {
                const keep = i > 0 && steps[i - 1].n ? s.n / steps[i - 1].n : null;
                const isWorst = worst && s.label === worst.to.label;
                return (
                  <div key={s.label} className="row" style={{ alignItems: "stretch", gap: 0 }}>
                    {i > 0 && (
                      <div style={{ width: 70, display: "grid", placeItems: "center", textAlign: "center" }}>
                        <div>
                          <ChevronRight size={18} className={isWorst ? "dn" : "dim"} />
                          <div className={isWorst ? "dn" : "mut"} style={{ fontSize: 12, fontWeight: 600 }}>{keep != null ? pct(keep, 0) : "–"}</div>
                          <div className="dim" style={{ fontSize: 11 }}>seguiram</div>
                        </div>
                      </div>
                    )}
                    <div style={{ flex: 1, background: "#0f1312", border: `1px solid ${isWorst ? "rgba(239,68,68,.35)" : "#1f2523"}`, borderRadius: 14, padding: 16 }}>
                      <div className="mut" style={{ fontSize: 12.5 }}>{s.label}</div>
                      <div className="mid-num" style={{ fontSize: 28, marginTop: 8 }}>{s.n.toLocaleString("pt-BR")}</div>
                      <div className="hbar" style={{ marginTop: 12 }}><i style={{ width: `${t.visits ? Math.max(2, (s.n / t.visits) * 100) : 0}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {worst && (
              <div className="callout sun" style={{ marginTop: 16 }}>
                <Target size={17} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  O maior vazamento está entre <b>{worst.from.label.toLowerCase()}</b> e <b>{worst.to.label.toLowerCase()}</b>: só {pct(worst.keep, 0)} seguem.
                  {worst.to.label === "Colocaram no carrinho" && " Fotos, preço e tabela de medidas na página do produto são o que mais pesa aqui."}
                  {worst.to.label === "Foram para o pagamento" && " Frete e prazo aparecendo cedo costumam ajudar."}
                  {worst.to.label === "Compraram" && " Vale olhar meios de pagamento, Pix e a recuperação de checkout."}
                </div>
                {worst.to.label === "Compraram" && <a className="act" href="/recuperacao">Recuperação <ArrowRight size={14} /></a>}
              </div>
            )}
          </Panel>

          <div className="cols c-2-1">
            <Panel title="Mês a mês" sub={`Linha tracejada: meta de ${fmtPct(goal)}`}>
              {months.length ? <GoalBars items={months} goal={goal * 100} format={(v) => `${v.toFixed(2).replace(".", ",")}%`} /> : <div className="empty">Sem dados ainda.</div>}
            </Panel>
            <Panel title="Por aparelho" sub={period.label}>
              {devs.sort((a, b) => b.sessions - a.sessions).map((d) => {
                const [name, Icon] = DEVICE[d.device] ?? ["Outro", Laptop];
                return (
                  <div className="lrow" key={d.device}>
                    <span className={`tile sm ${d.rate >= goal ? "t-l" : "t-n"}`}><Icon size={16} /></span>
                    <div style={{ flex: 1 }}>
                      <div className="t">{name}</div>
                      <div className="s">{d.sessions.toLocaleString("pt-BR")} visitas · {d.purchased} compras</div>
                      <div className="hbar" style={{ marginTop: 8 }}><i className={d.rate >= goal ? "" : d.rate >= goal * 0.75 ? "s" : "c"} style={{ width: `${(d.rate / devMax) * 100}%` }} /></div>
                    </div>
                    <b className="end">{fmtPct(d.rate)}</b>
                  </div>
                );
              })}
              {!devs.length && <div className="empty">Sem dados de aparelho.</div>}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
