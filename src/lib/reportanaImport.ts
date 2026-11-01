import { db } from "./db";
import { REPORTANA_MSGS } from "./reportanaTemplates";

export async function importReportana() {
  const have = await db.messageTemplate.findMany({ where: { folder: { startsWith: "Reportana:" } }, select: { folder: true, name: true } });
  const seen = new Set(have.map((h) => `${h.folder}|${h.name}`));
  const data = REPORTANA_MSGS.filter((m) => !seen.has(`${m.folder}|${m.name}`)).map((m) => ({ name: m.name, folder: m.folder, kind: m.kind, parts: JSON.parse(JSON.stringify(m.parts)) }));
  if (data.length) await db.messageTemplate.createMany({ data });
  await db.setting.upsert({ where: { key: "_rp_msgs" }, create: { key: "_rp_msgs", value: { v: 1, at: new Date().toISOString() } }, update: { value: { v: 1, at: new Date().toISOString() } } });
  return { ok: true, added: data.length };
}

// Na primeira vez que a biblioteca abre, já deixa tudo lá
export async function ensureReportana() {
  const s = await db.setting.findUnique({ where: { key: "_rp_msgs" } }).catch(() => null);
  if (!s) await importReportana().catch(() => null);
}
