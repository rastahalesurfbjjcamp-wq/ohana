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
    db.clubReward.findMany({ where: { memberId, usedAt: null, kind: { not: "aniversario" } }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.clubPoints.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  if (!m) return null;
  const c = s.club;
  const st = memberState(m, c.graceDays);
  const value = Math.floor(m.points / 100) * c.valuePer100;
  const P = await import("./clubPlus");
  const months = P.monthsIn(m);
  const tier = P.tierOf(months);
  const nt = P.nextTier(tier);
  const month = P.monthKey();
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  if (!m.refCode) m.refCode = await P.ensureRefCode(m.id);
  const [meets, mine, bday, raffle, refs] = await Promise.all([
    db.clubMeet.findMany({ where: { active: true, date: { gte: new Date(Date.now() - 864e5) } }, orderBy: { date: "asc" }, take: 6, include: { _count: { select: { tickets: true } } } }),
    db.clubTicket.findMany({ where: { memberId: m.id }, select: { meetId: true } }),
    db.clubReward.findFirst({ where: { memberId: m.id, kind: "aniversario", createdAt: { gte: yearStart } }, orderBy: { createdAt: "desc" } }),
    db.clubRaffle.findUnique({ where: { month } }),
    db.clubMember.findMany({ where: { referredById: m.id }, select: { status: true, paidUntil: true, courtesy: true } }),
  ]);
  const mineSet = new Set(mine.map((t) => t.meetId));
  const refActive = refs.filter((r) => !r.courtesy && memberState(r, c.graceDays).k !== "cancelado" && memberState(r, c.graceDays).k !== "atrasado").length;
  const links = [[3, c.t3Link], [6, c.t6Link], [12, c.t12Link]].filter(([t, l]) => l && tier >= Number(t)).map(([t, l]) => ({ tier: Number(t), url: String(l) }));
  const usesLeft = c.usesPerMonth ? Math.max(0, c.usesPerMonth - (m.usesMonth === month ? m.monthUses : 0)) : null;
  return {
    months, tier, tierName: P.tierName(tier), nextTier: nt, monthsToNext: nt ? nt - months : 0, nextPerks: nt ? P.tierPerks(nt, c) : [],
    usesPerMonth: c.usesPerMonth, usesLeft, monthLabel: new Date().toLocaleDateString("pt-BR", { month: "long" }),
    birthday: bday && !bday.usedAt && (!bday.expiresAt || bday.expiresAt > new Date()) ? { code: bday.code, pct: c.birthdayPct, until: bday.expiresAt?.toISOString() ?? null } : null,
    meets: meets.map((e) => ({ id: e.id, title: e.title, date: e.date.toISOString(), points: e.points, place: e.place, left: Math.max(0, e.slots - e._count.tickets), mine: mineSet.has(e.id) })),
    refLink: m.refCode ? `${env.appUrl().replace(/\/$/, "")}/club/${m.refCode}` : null, refActive, refMonthly: Math.round(refActive * c.fee * c.affiliatePct) / 100, affiliatePct: c.affiliatePct,
    raffle: { prizes: P.parsePrizes(c.rafflePrizes).map((p) => p.title), won: raffle ? ((raffle.winners as { prize: string; memberId: string }[]).find((w) => w.memberId === m.id)?.prize ?? null) : null, drawn: !!raffle },
    closeFriends: m.closeFriends, instagram: m.instagram, storeInstagram: c.instagram, links, earlyLink: c.earlyLink || null, kit: await db.clubPerk.findUnique({ where: { memberId_kind: { memberId: m.id, kind: "kit" } }, select: { status: true, orderName: true } }),
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
