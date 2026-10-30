// Área do membro (página "Meu clube"): acesso por link assinado ou CPF + final do celular.
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { env } from "./env";
import { getSettings } from "./settings";
import { digits, memberState } from "./club";

const secret = () => `CLUBE:${process.env.INTEGRATIONS_SECRET ?? process.env.SESSION_SECRET ?? process.env.DATABASE_URL ?? ""}`;
const sign = (id: string) => createHmac("sha256", secret()).update(id).digest("base64url").slice(0, 16);

export const memberToken = (id: string) => `${id}.${sign(id)}`;
export const memberLink = (id: string) => `${env.appUrl().replace(/\/$/, "")}/assinar/meu?t=${memberToken(id)}`;

export function verifyToken(t: string): string | null {
  const [id, sig] = t.split(".");
  if (!id || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export async function findMemberFor(q: { t?: string; cpf?: string; fim?: string }) {
  if (q.t) {
    const id = verifyToken(q.t);
    return id ? db.clubMember.findUnique({ where: { id } }) : null;
  }
  const cpf = digits(q.cpf ?? "");
  const fim = digits(q.fim ?? "");
  if (cpf.length !== 11 || fim.length !== 4) return null;
  const m = await db.clubMember.findUnique({ where: { cpf } });
  return m && (m.phone ?? "").endsWith(fim) ? m : null;
}

export async function memberView(memberId: string) {
  const [m, s, prizes, rewards, hist] = await Promise.all([
    db.clubMember.findUnique({ where: { id: memberId } }),
    getSettings(),
    db.clubPrize.findMany({ where: { active: true }, orderBy: { points: "asc" } }),
    db.clubReward.findMany({ where: { memberId, usedAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.clubPoints.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  if (!m) return null;
  const c = s.club;
  const st = memberState(m, c.graceDays);
  const value = Math.floor(m.points / 100) * c.valuePer100;
  return {
    token: memberToken(m.id),
    first: m.name.split(" ")[0],
    status: st.label,
    ok: st.k === "em_dia" || st.k === "vencendo",
    paidUntil: m.paidUntil?.toISOString() ?? null,
    code: m.code,
    points: m.points,
    value,
    minRedeem: c.minRedeem,
    valuePer100: c.valuePer100,
    discountPct: c.discountPct,
    club: c.name,
    store: s.postsale.storeUrl,
    prizes: prizes.map((p) => ({ id: p.id, title: p.title, points: p.points, image: p.image, can: m.points >= p.points })),
    rewards: rewards.map((r) => ({ code: r.code, value: r.value, points: r.points, at: r.createdAt.toISOString() })),
    history: hist.map((h) => ({ delta: h.delta, note: h.note ?? h.reason, at: h.createdAt.toISOString() })),
  };
}
export type MemberView = NonNullable<Awaited<ReturnType<typeof memberView>>>;
