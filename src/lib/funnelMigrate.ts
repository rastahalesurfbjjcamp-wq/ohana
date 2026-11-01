// Os funis antigos (lista de mensagens) viram automações no editor de blocos.
// Quem já estava no meio de um funil antigo termina por lá; quem entrar daqui pra frente vai pela automação.
import { db } from "./db";
import type { Flow, Node, Part } from "./flowTypes";
import type { Step } from "./funnels";

const COND: Record<string, string> = { nao_no_grupo: "fora_grupo", no_grupo: "no_grupo", nao_comprou: "nao_pagou", comprou: "pagou" };

function waitOf(min: number): { amount: number; unit: "min" | "h" | "d" } {
  if (min >= 1440 && min % 1440 === 0) return { amount: min / 1440, unit: "d" };
  if (min >= 60 && min % 60 === 0) return { amount: min / 60, unit: "h" };
  return { amount: Math.max(1, min), unit: "min" };
}

export function flowFromSteps(steps: Step[]): { flow: Flow; delayMin: number } {
  const nodes: Record<string, Node> = {};
  let x = 340;
  const y = 200;
  const ids: string[] = []; // primeiro nó de cada passo
  const chain: { id: string; port: string }[] = []; // saídas que apontam para o próximo passo
  let start: string | undefined;
  let delayMin = 0;
  steps.forEach((s, i) => {
    const firsts: string[] = [];
    if (i === 0) delayMin = s.delayMin;
    else if (s.delayMin > 0) { const id = `w${i}`; nodes[id] = { type: "wait", ...waitOf(s.delayMin), x, y: y + 60 } as Node; firsts.push(id); x += 240; }
    let condId: string | undefined;
    if (s.cond && s.cond !== "sempre" && COND[s.cond]) {
      condId = `c${i}`;
      nodes[condId] = { type: "cond", check: COND[s.cond], mode: "all", rules: [{ check: COND[s.cond] }], x, y: y + 20 } as Node;
      firsts.push(condId); x += 300;
    }
    const sid = `s${i}`;
    const parts: Part[] = [];
    if (s.mediaUrl) parts.push({ mediaUrl: s.mediaUrl, mediaType: (s.mediaType as Part["mediaType"]) ?? "image", text: (s.text ?? "").replace(/\{link\}/g, "{grupo}") });
    else parts.push({ text: (s.text ?? "").replace(/\{link\}/g, "{grupo}") });
    nodes[sid] = { type: "send", parts, typing: 4, timeout: 60, x, y: y - 40 } as Node;
    firsts.push(sid); x += 340;
    // liga dentro do passo
    for (let k = 0; k < firsts.length - 1; k++) {
      const a = nodes[firsts[k]] as Record<string, unknown>;
      if (firsts[k] === condId) a.yes = firsts[k + 1]; else a.next = firsts[k + 1];
    }
    // liga as saídas pendentes do passo anterior ao começo deste
    for (const c of chain) (nodes[c.id] as Record<string, unknown>)[c.port] = firsts[0];
    chain.length = 0;
    chain.push({ id: sid, port: "next" });
    if (condId) chain.push({ id: condId, port: "no" });
    if (!start) start = firsts[0];
    ids.push(firsts[0]);
  });
  nodes.x1 = { type: "exit", x, y: y + 120 } as Node;
  for (const c of chain) (nodes[c.id] as Record<string, unknown>)[c.port] = "x1";
  return { flow: { start: start ?? "x1", startPos: { x: 20, y: 200 }, nodes }, delayMin };
}

export async function migrateFunnels() {
  // trava: só um processo migra (o create falha se a chave já existe)
  try { await db.setting.create({ data: { key: "_funnels_migrated", value: {} } }); } catch { return; }
  const map: Record<string, string> = {};
  const funnels = await db.funnel.findMany();
  for (const f of funnels) {
    const steps = (f.steps ?? []) as Step[];
    if (!steps.length) continue;
    const { flow, delayMin } = flowFromSteps(steps);
    const a = await db.automation.create({ data: { name: f.name, trigger: f.trigger, config: { delayMin, fromFunnel: f.id }, flow, active: f.active } });
    map[f.id] = a.id;
  }
  await db.setting.update({ where: { key: "_funnels_migrated" }, data: { value: map } });
}

export async function migratedFunnelIds(): Promise<Set<string>> {
  const s = await db.setting.findUnique({ where: { key: "_funnels_migrated" } }).catch(() => null);
  return new Set(Object.keys((s?.value ?? {}) as Record<string, string>));
}
