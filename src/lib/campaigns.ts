// Campanhas de WhatsApp: na hora marcada, coloca todo mundo da lista na sequência da campanha.
// O envio sai aos poucos pelo mesmo controle de envios por hora das automações.
import { db } from "./db";
import { enterAutomation } from "./automations";
import { refreshList } from "./audience";

type Cfg = { campaign?: boolean; listId?: string; at?: string; state?: string; startedAt?: string; total?: number };

export async function runCampaigns() {
  const list = await db.automation.findMany({ where: { trigger: "manual" } });
  for (const a of list) {
    const cfg = (a.config ?? {}) as Cfg;
    if (!cfg.campaign) continue;
    if (cfg.state === "agendada" && cfg.at && new Date(`${cfg.at}:00-03:00`).getTime() <= Date.now() && cfg.listId) {
      // trava para não rodar duas vezes
      const lock = await db.automation.updateMany({ where: { id: a.id, updatedAt: a.updatedAt }, data: { config: { ...cfg, state: "enviando", startedAt: new Date().toISOString() }, active: true } });
      if (!lock.count) continue;
      await refreshList(cfg.listId).catch(() => null);
      const members = await db.listMember.findMany({ where: { listId: cfg.listId } });
      let n = 0;
      for (const m of members) {
        const ok = await enterAutomation(a.id, `camp-${a.id}-${m.phone}`, m.phone, { nome: m.name ?? "", email: m.email ?? "", telefone: m.phone, ...((m.fields ?? {}) as Record<string, string>) }, { force: true, delayMin: 0 });
        if (ok) n++;
      }
      await db.automation.update({ where: { id: a.id }, data: { config: { ...cfg, state: "enviando", startedAt: new Date().toISOString(), total: n } } });
      continue;
    }
    if (cfg.state === "enviando" && a.active) {
      const left = await db.automationRun.count({ where: { automationId: a.id, status: "ativo" } });
      if (!left) await db.automation.update({ where: { id: a.id }, data: { config: { ...cfg, state: "enviada" } } });
    }
  }
}
