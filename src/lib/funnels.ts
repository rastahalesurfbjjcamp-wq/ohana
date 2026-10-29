// Funis: sequências de mensagens no privado disparadas por eventos.
import { db } from "./db";
import { env } from "./env";
import { redirectLink } from "./redirect";
import { humanDelay, reserveSlot, sendText } from "./send";
import { logChat } from "./recovery";

export const TRIGGERS: Record<string, string> = {
  lead_novo: "Virou lead (formulário do Grupo VIP)",
  entrou_grupo: "Entrou em um grupo da comunidade",
  saiu_grupo: "Saiu de um grupo da comunidade",
  primeira_compra: "Fez a primeira compra",
};

type Step = { delayMin: number; text: string };

export async function funnelEvent(trigger: string, phone: string, name?: string | null) {
  const funnels = await db.funnel.findMany({ where: { trigger, active: true } });
  for (const f of funnels) {
    const steps = f.steps as Step[];
    if (!steps.length) continue;
    const exists = await db.funnelRun.findUnique({ where: { funnelId_phone: { funnelId: f.id, phone } } });
    if (exists) continue;
    await db.funnelRun.create({ data: { funnelId: f.id, phone, name: name ?? null, nextAt: new Date(Date.now() + steps[0].delayMin * 60_000) } });
  }
}

export async function runFunnels() {
  const due = await db.funnelRun.findMany({ where: { status: "ativo", nextAt: { lte: new Date() } }, include: { funnel: true }, take: 15 });
  if (!due.length) return;
  const opted = new Set((await db.optOut.findMany({ where: { phone: { in: due.map((r) => r.phone) } } })).map((o) => o.phone));
  for (const r of due) {
    const steps = r.funnel.steps as Step[];
    const step = steps[r.step];
    if (!step || opted.has(r.phone) || !r.funnel.active) {
      await db.funnelRun.update({ where: { id: r.id }, data: { status: opted.has(r.phone) || !r.funnel.active ? "parado" : "concluido", nextAt: null } });
      continue;
    }
    if ((await reserveSlot()) > 0) return;
    const text = step.text
      .replace(/\{nome\}/g, (r.name ?? "").split(" ")[0] || "tudo bem")
      .replace(/\{loja\}/g, env.storeName())
      .replace(/\{link\}/g, redirectLink());
    try {
      await sendText(r.phone, text);
      await logChat(r.phone, r.name, text, "sistema");
    } catch (e) {
      console.error("[funil]", e);
    }
    const next = steps[r.step + 1];
    await db.funnelRun.update({
      where: { id: r.id },
      data: { step: { increment: 1 }, nextAt: next ? new Date(Date.now() + next.delayMin * 60_000) : null, status: next ? "ativo" : "concluido" },
    });
    await humanDelay();
  }
}
