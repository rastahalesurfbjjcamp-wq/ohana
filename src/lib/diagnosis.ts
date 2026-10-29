// Diagnóstico com IA: junta os números da loja e pede um plano de ação.
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { env } from "./env";
import { creds } from "./integrations";
import { computeMetrics } from "./report";
import { conversionByDevice, funnelByDay, ordersBetween, products } from "./store";
import { channelOf } from "./attribution";
import { addDays, brl, dayRange, isoDayLocal, pct } from "./time";

async function snapshot(): Promise<string> {
  const today = isoDayLocal();
  const from = addDays(today, -29);
  const prevFrom = addDays(today, -59);
  const prevTo = addDays(today, -30);
  const L: string[] = [];
  const safe = async <T,>(f: () => Promise<T>) => f().catch(() => null);
  const [m, prev, funnel, dev, orders, prods] = await Promise.all([
    safe(() => computeMetrics(from, today)),
    safe(() => computeMetrics(prevFrom, prevTo)),
    safe(() => funnelByDay(from, today)),
    safe(() => conversionByDevice(from, today)),
    safe(() => ordersBetween(dayRange(from).start, dayRange(today).end)),
    safe(() => products()),
  ]);
  if (m) {
    L.push(`Últimos 30 dias: faturamento ${brl(m.net)}, ${m.orders} pedidos, ticket ${brl(m.aov)}, anúncios ${m.ads != null ? brl(m.ads) : "sem dado"}, lucro antes dos fixos ${brl(m.profitBeforeFixed)}.`);
    if (m.missingCost.length) L.push(`Produtos vendidos sem custo cadastrado: ${[...new Set(m.missingCost)].slice(0, 8).join(", ")}.`);
  }
  if (prev) L.push(`30 dias anteriores: faturamento ${brl(prev.net)}, ${prev.orders} pedidos, anúncios ${prev.ads != null ? brl(prev.ads) : "sem dado"}.`);
  if (funnel?.length) {
    const sum = (k: "sessions" | "cart" | "checkout" | "purchased") => funnel.reduce((a, d) => a + d[k], 0);
    const v = sum("sessions");
    L.push(`Funil 30 dias: ${v} visitas, ${sum("cart")} carrinho, ${sum("checkout")} checkout, ${sum("purchased")} compras (conversão ${v ? pct(sum("purchased") / v) : "?"}).`);
  }
  if (dev?.length) L.push(`Conversão por aparelho: ${dev.map((d) => `${d.device} ${pct(d.rate)} (${d.sessions} visitas)`).join("; ")}.`);
  if (orders?.length) {
    const ch = new Map<string, number>();
    for (const o of orders) ch.set(channelOf(o).channel, (ch.get(channelOf(o).channel) ?? 0) + o.subtotal);
    L.push(`Vendas por canal: ${[...ch.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${brl(v, 0)}`).join("; ")}.`);
    const prodSales = new Map<string, number>();
    for (const o of orders) for (const l of o.lines) prodSales.set(l.title, (prodSales.get(l.title) ?? 0) + l.quantity);
    L.push(`Mais vendidos: ${[...prodSales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} (${v})`).join(", ")}.`);
  }
  if (prods?.length) {
    const out = prods.flatMap((p) => p.variants.filter((v) => v.stock <= 0).map((v) => `${p.title} ${v.title}`));
    L.push(`Tamanhos esgotados: ${out.length} (ex.: ${out.slice(0, 8).join(", ")}).`);
  }
  const rec = await db.recoveryCase.groupBy({ by: ["kind", "status"], _count: true, where: { createdAt: { gte: new Date(Date.now() - 30 * 864e5) } } }).catch(() => []);
  if (rec.length) L.push(`Recuperação 30 dias: ${rec.map((r) => `${r.kind}/${r.status}: ${r._count}`).join("; ")}.`);
  const members = await db.membership.count({ where: { leftAt: null, group: { isCommunity: true } } }).catch(() => 0);
  const joins = await db.memberEvent.count({ where: { type: { in: ["JOIN", "RETURN"] }, createdAt: { gte: new Date(Date.now() - 30 * 864e5) } } }).catch(() => 0);
  const leaves = await db.memberEvent.count({ where: { type: "LEAVE", createdAt: { gte: new Date(Date.now() - 30 * 864e5) } } }).catch(() => 0);
  L.push(`Comunidade no WhatsApp: ${members} pessoas, +${joins} entradas e ${leaves} saídas em 30 dias.`);
  return L.join("\n");
}

export async function runDiagnosis() {
  const c = await creds();
  if (!c.ai.key) throw new Error("Conecte a IA em Integrações");
  const data = await snapshot();
  const client = new Anthropic({ apiKey: c.ai.key });
  const res = await client.messages.create({
    model: c.ai.model ?? env.anthropicModel(),
    max_tokens: 1500,
    system: `Você é um consultor de e-commerce de moda que analisa os números da ${env.storeName()} (${env.storeAbout()}).
Escreva em português simples para o dono da loja, sem travessões e sem jargão. Use exatamente este formato em Markdown:
## Resumo
(2 ou 3 frases sobre como a loja está)
## O que fazer primeiro
1. **Título curto**: o problema com o número que mostra isso, e a ação concreta para esta semana.
(de 3 a 5 itens, do maior para o menor impacto em dinheiro)
## O que está indo bem
(1 a 3 itens curtos)
Use só os números fornecidos. Se faltar dado, diga qual integração conectar.`,
    messages: [{ role: "user", content: data }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("\n").trim();
  return db.diagnosis.create({ data: { content: text } });
}
