// Público: junta clientes da Shopify, leads e membros do club num contato por telefone,
// calcula a matriz RFM e monta listas que se atualizam sozinhas por regras.
import { db } from "./db";
import { customers, type Customer } from "./store";
import { normalizePhone } from "./segments";
import { FIELDS, rfmLabel, type ARule } from "./audienceTypes";
export { FIELDS, OPS, RFM_SEGMENTS, describe, rfmLabel, type ARule } from "./audienceTypes";

const DAY = 864e5;

function quint(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => s[Math.floor(q * (s.length - 1))] ?? 0);
}
export function rfmOf(c: Customer, mCut: number[]) {
  const days = c.lastOrderAt ? (Date.now() - Date.parse(c.lastOrderAt)) / DAY : 9999;
  const r = days <= 30 ? 5 : days <= 60 ? 4 : days <= 120 ? 3 : days <= 240 ? 2 : 1;
  const f = c.orders >= 6 ? 5 : c.orders >= 4 ? 4 : c.orders === 3 ? 3 : c.orders === 2 ? 2 : 1;
  const m = c.spent > mCut[3] ? 5 : c.spent > mCut[2] ? 4 : c.spent > mCut[1] ? 3 : c.spent > mCut[0] ? 2 : 1;
  const fm = Math.round((f + m) / 2);
  let seg: string;
  if (r >= 4 && fm >= 4) seg = "campeoes";
  else if (r >= 3 && fm >= 3 && f >= 2) seg = "leais";
  else if (r >= 4 && fm >= 2 && f >= 2) seg = "potenciais";
  else if (r === 5 && f === 1) seg = "novos";
  else if (r === 4 && f === 1) seg = "promissores";
  else if (r === 3 && fm >= 2) seg = "atencao";
  else if (r === 3) seg = "dormir";
  else if (r === 1 && fm >= 4) seg = "naoperder";
  else if (r <= 2 && fm >= 3) seg = "risco";
  else if (r === 2) seg = "hibernando";
  else seg = "perdidos";
  return { r, f, m, seg, days: Math.round(days) };
}

export type Contact = {
  phone: string; name: string; email: string | null;
  spent: number; orders: number; days: number | null; rfm: string | null;
  state: string | null; city: string | null; tags: string[]; etiquetas: string[]; lists: string[];
  club: boolean; lead: boolean; customer: boolean;
};

// Todos os contatos conhecidos, um por telefone
export async function contacts(): Promise<Contact[]> {
  const [cs, leads, club, tags, members] = await Promise.all([
    customers().catch(() => [] as Customer[]),
    db.lead.findMany({ select: { phone: true, name: true, email: true } }),
    db.clubMember.findMany({ where: { status: "ativo" }, select: { phone: true, name: true } }),
    db.contactTag.findMany({ select: { phone: true, tag: true } }),
    db.listMember.findMany({ select: { phone: true, listId: true } }),
  ]);
  const mCut = quint(cs.map((c) => c.spent));
  const map = new Map<string, Contact>();
  const base = (phone: string, name: string): Contact => ({ phone, name, email: null, spent: 0, orders: 0, days: null, rfm: null, state: null, city: null, tags: [], etiquetas: [], lists: [], club: false, lead: false, customer: false });
  for (const c of cs) {
    const phone = normalizePhone(c.phone);
    if (!phone) continue;
    const r = rfmOf(c, mCut);
    const prev = map.get(phone);
    if (prev && prev.spent >= c.spent) continue;
    map.set(phone, { ...base(phone, c.name), email: c.email, spent: c.spent, orders: c.orders, days: c.lastOrderAt ? r.days : null, rfm: r.seg, state: c.state, city: c.city, tags: c.tags.map((t) => t.toLowerCase()), customer: true });
  }
  for (const l of leads) {
    const phone = normalizePhone(l.phone);
    if (!phone) continue;
    const c = map.get(phone) ?? base(phone, l.name ?? "");
    c.lead = true;
    c.email ??= l.email ?? null;
    if (!c.name) c.name = l.name ?? "";
    map.set(phone, c);
  }
  for (const m of club) {
    const phone = normalizePhone(m.phone);
    if (!phone) continue;
    const c = map.get(phone) ?? base(phone, m.name ?? "");
    c.club = true;
    map.set(phone, c);
  }
  for (const t of tags) map.get(t.phone)?.etiquetas.push(t.tag);
  for (const m of members) map.get(m.phone)?.lists.push(m.listId);
  return [...map.values()];
}

/* ---------- Regras ---------- */

function test(c: Contact, r: ARule) {
  const f = FIELDS.find((x) => x.k === r.field);
  if (!f) return false;
  const raw = (c as Record<string, unknown>)[r.field];
  const v = (r.value ?? "").trim().toLowerCase();
  if (f.type === "bool") return r.op === "no" ? !raw : !!raw;
  if (f.type === "number") {
    if (raw === null || raw === undefined) return false;
    const a = Number(raw), b = Number(v.replace(",", "."));
    return r.op === "gte" ? a >= b : r.op === "lte" ? a <= b : r.op === "gt" ? a > b : r.op === "lt" ? a < b : a === b;
  }
  if (Array.isArray(raw)) {
    const has = raw.some((x) => (r.op === "contains" ? String(x).includes(v) : String(x).toLowerCase() === v));
    return r.op === "neq" ? !has : has;
  }
  const s = String(raw ?? "").toLowerCase();
  if (r.op === "contains") return s.includes(v);
  if (r.op === "neq") return s !== v;
  return s === v;
}
export function matches(c: Contact, rules: ARule[], mode: string) {
  if (!rules.length) return false;
  return mode === "any" ? rules.some((r) => test(c, r)) : rules.every((r) => test(c, r));
}

// Atualiza os membros de uma lista com regras (entra quem passa, sai quem deixou de passar)
export async function refreshList(listId: string, all?: Contact[]) {
  const l = await db.contactList.findUnique({ where: { id: listId } });
  if (!l || !l.dynamic) return { added: 0, removed: 0, total: 0 };
  const rules = (l.rules ?? []) as ARule[];
  const people = all ?? (await contacts());
  const want = new Map(people.filter((c) => matches(c, rules.filter((r) => !(r.field === "lists" && r.value === listId)), l.mode)).map((c) => [c.phone, c]));
  const cur = await db.listMember.findMany({ where: { listId }, select: { phone: true } });
  const have = new Set(cur.map((m) => m.phone));
  const toAdd = [...want.values()].filter((c) => !have.has(c.phone));
  const toRemove = [...have].filter((p) => !want.has(p));
  for (let i = 0; i < toAdd.length; i += 500) {
    await db.listMember.createMany({ data: toAdd.slice(i, i + 500).map((c) => ({ listId, phone: c.phone, name: c.name || null, email: c.email, fields: { rfm: rfmLabel(c.rfm ?? ""), gasto: c.spent.toFixed(2), pedidos: String(c.orders) } })), skipDuplicates: true });
  }
  if (toRemove.length) await db.listMember.deleteMany({ where: { listId, phone: { in: toRemove } } });
  await db.contactList.update({ where: { id: listId }, data: { refreshedAt: new Date() } });
  return { added: toAdd.length, removed: toRemove.length, total: want.size };
}

export async function refreshAllLists() {
  const lists = await db.contactList.findMany({ where: { dynamic: true }, select: { id: true } });
  if (!lists.length) return;
  const all = await contacts();
  for (const l of lists) await refreshList(l.id, all).catch(() => null);
}
