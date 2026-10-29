// Comandos no grupo de resultados: pedir relatório, lançar custos e lotes de estoque.
import { db } from "./db";
import { hasAI, interpretCommand } from "./ai";
import { dailyReport, monthReport, weeklyReport } from "./report";
import { addDays, brl, isoDayLocal } from "./time";

const CONFIRM = /^(ok|okay|sim|pode|confirmo|confirma|isso|manda|fechou|beleza)\b/i;
const CANCEL = /^(n[aã]o|cancela|cancelar|errado)\b/i;
const WRITE_TOOLS = new Set(["lancar_custo_fixo", "lancar_custo", "lancar_lote_estoque"]);

function money(v: unknown) {
  return Math.round(Number(v) * 100) / 100;
}

function describe(name: string, i: Record<string, unknown>, month: string): string {
  if (name === "lancar_custo_fixo")
    return `custo fixo *${i.descricao}*, ${brl(money(i.valor))} por mês${i.recorrente ? ", todo mês" : ""}`;
  if (name === "lancar_custo") return `custo *${i.descricao}*, ${brl(money(i.valor))}, em ${(i.mes as string) ?? month}`;
  if (name === "lancar_lote_estoque") {
    const unit = money(i.valor_total) / Number(i.quantidade);
    return `lote *${i.descricao}*: ${i.quantidade} peças, ${brl(money(i.valor_total))}, ou seja *${brl(unit)} por peça*. Fica ligado aos produtos com "${i.palavra_chave}" no nome`;
  }
  return name;
}

async function execute(name: string, i: Record<string, unknown>, by: string): Promise<string> {
  const today = isoDayLocal();
  const month = today.slice(0, 7);
  switch (name) {
    case "relatorio": {
      const p = i.periodo as string;
      if (p === "semana") return weeklyReport();
      if (p === "mes") return monthReport();
      return dailyReport(p === "ontem" ? addDays(today, -1) : today);
    }
    case "lancar_custo_fixo":
      await db.cost.create({
        data: { kind: "FIXED", description: String(i.descricao), amount: money(i.valor), recurring: !!i.recorrente, month, source: "whatsapp", createdBy: by },
      });
      return `Lançado: ${describe(name, i, month)}. Entra inteiro no lucro do mês.`;
    case "lancar_custo":
      await db.cost.create({
        data: { kind: "VARIABLE", description: String(i.descricao), amount: money(i.valor), month: (i.mes as string) ?? month, source: "whatsapp", createdBy: by },
      });
      return `Lançado: ${describe(name, i, month)}.`;
    case "lancar_lote_estoque": {
      const units = Number(i.quantidade);
      const total = money(i.valor_total);
      await db.cost.create({
        data: {
          kind: "STOCK_LOT",
          description: String(i.descricao),
          amount: total,
          units,
          unitCost: Math.round((total / units) * 100) / 100,
          productKey: String(i.palavra_chave).toLowerCase().trim(),
          month: (i.mes as string) ?? month,
          source: "whatsapp",
          createdBy: by,
        },
      });
      return `Lançado: ${describe(name, i, month)}. Quando o produto vender, o lucro já sai com esse custo.`;
    }
    case "listar_custos": {
      const m = (i.mes as string) ?? month;
      const costs = await db.cost.findMany({ where: { OR: [{ month: m }, { kind: "FIXED", recurring: true }] }, orderBy: { createdAt: "asc" } });
      if (!costs.length) return `Nenhum custo lançado em ${m}.`;
      const kinds = { FIXED: "fixo", VARIABLE: "avulso", STOCK_LOT: "lote" } as const;
      const lines = costs.map((c) => `• ${c.description} (${kinds[c.kind]}): ${brl(Number(c.amount))}${c.unitCost ? `, ${brl(Number(c.unitCost))}/peça` : ""}`);
      return [`*Custos de ${m}*`, "", ...lines].join("\n");
    }
  }
  return "Não entendi o pedido.";
}

// Processa uma mensagem e devolve a resposta (ou null para não responder)
export async function handleCommand(fromPhone: string, input: string, wasAudio: boolean): Promise<string | null> {
  const text = input.trim();
  if (!text) return null;

  const pending = await db.commandLog.findFirst({
    where: { fromPhone, status: "awaiting_confirmation", createdAt: { gte: new Date(Date.now() - 30 * 60_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (pending && CONFIRM.test(text)) {
    const p = pending.pending as { name: string; input: Record<string, unknown> };
    const reply = await execute(p.name, p.input, fromPhone);
    await db.commandLog.update({ where: { id: pending.id }, data: { status: "confirmed", reply } });
    return reply;
  }
  if (pending && CANCEL.test(text)) {
    await db.commandLog.update({ where: { id: pending.id }, data: { status: "canceled" } });
    return "Cancelado, não lancei nada.";
  }

  if (!(await hasAI())) {
    // Sem IA: entende só pedidos de relatório simples
    const t = text.toLowerCase();
    if (/relat[oó]rio|resultado|vendas/.test(t)) {
      const periodo = t.includes("ontem") ? "ontem" : t.includes("semana") ? "semana" : /m[eê]s/.test(t) ? "mes" : "hoje";
      return execute("relatorio", { periodo }, fromPhone);
    }
    return null;
  }

  const today = isoDayLocal();
  const { tool, text: aiText } = await interpretCommand(text, today);
  if (!tool) {
    if (!aiText || aiText.toUpperCase().startsWith("IGNORAR")) return null;
    await db.commandLog.create({ data: { fromPhone, input: text, wasAudio, reply: aiText } });
    return aiText;
  }

  if (WRITE_TOOLS.has(tool.name)) {
    const summary = describe(tool.name, tool.input, today.slice(0, 7));
    const reply = `Vou lançar ${summary}.\n\nResponda *ok* para confirmar ou *não* para cancelar.`;
    await db.commandLog.create({
      data: { fromPhone, input: text, wasAudio, intent: tool.name, pending: { name: tool.name, input: tool.input } as object, status: "awaiting_confirmation", reply },
    });
    return wasAudio ? `Entendi pelo áudio: "${text}"\n\n${reply}` : reply;
  }

  const reply = await execute(tool.name, tool.input, fromPhone);
  await db.commandLog.create({ data: { fromPhone, input: text, wasAudio, intent: tool.name, reply } });
  return reply;
}
