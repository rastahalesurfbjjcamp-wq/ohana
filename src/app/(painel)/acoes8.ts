"use server";
// Rasta Hale Club: eventos com pontos, sorteio, cortesia para top compradores, Close Friends, brindes e indicação.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings, saveSetting } from "@/lib/settings";
import { affiliateRows, drawRaffle, grantCourtesy, monthKey, processPerks, topBuyers } from "@/lib/clubPlus";

async function user() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
async function admin() {
  const s = await user();
  if (s.role !== "ADMIN") throw new Error("Só o administrador pode mudar isso");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const msg = (e: unknown) => encodeURIComponent(String(e).replace(/^Error: /, "").slice(0, 160));
const done = (extra: string) => { revalidatePath("/clube"); redirect(`/clube?${extra}`); };
const rethrow = (e: unknown) => { if (String(e).includes("NEXT_REDIRECT")) throw e; };

export async function createMeet(f: FormData) {
  await user();
  const title = str(f, "title");
  const date = new Date(`${str(f, "date")}T${str(f, "time") || "10:00"}:00-03:00`);
  const points = Math.max(0, Math.round(Number(str(f, "points")) || 0));
  const slots = Math.max(1, Math.round(Number(str(f, "slots")) || 1));
  if (!title || Number.isNaN(date.getTime())) redirect(`/clube?evento=1&erro=${encodeURIComponent("Coloque o nome e a data do evento")}`);
  await db.clubMeet.create({ data: { title, date, points, slots, place: str(f, "place") || null } });
  done("ok=evento");
}

export async function toggleMeet(f: FormData) {
  await user();
  const e = await db.clubMeet.findUnique({ where: { id: str(f, "id") } });
  if (e) await db.clubMeet.update({ where: { id: e.id }, data: { active: !e.active } });
  done("ok=1");
}

export async function raffleNow() {
  await admin();
  try {
    await drawRaffle(monthKey());
  } catch (e) {
    rethrow(e);
    redirect(`/clube?erro=${msg(e)}`);
  }
  done("ok=sorteio");
}

export async function courtesyNow(f: FormData) {
  await admin();
  try {
    const list = await topBuyers(10);
    const b = list.find((x) => x.id === str(f, "id"));
    if (!b) throw new Error("Cliente não encontrado na Shopify");
    await grantCourtesy(b);
  } catch (e) {
    rethrow(e);
    redirect(`/clube?erro=${msg(e)}`);
  }
  done("ok=cortesia");
}

// Close Friends: marca como adicionados (ou removidos) depois de mexer no Instagram
export async function markCloseFriends(f: FormData) {
  await user();
  const ids = str(f, "ids").split(",").filter(Boolean);
  const on = str(f, "on") === "1";
  if (ids.length) await db.clubMember.updateMany({ where: { id: { in: ids } }, data: { closeFriends: on } });
  done("ok=cf");
}

export async function perkSent(f: FormData) {
  await user();
  await db.clubPerk.update({ where: { id: str(f, "id") }, data: { status: "enviado" } }).catch(() => null);
  done("ok=1");
}

export async function retryPerks() {
  await user();
  await db.clubPerk.updateMany({ where: { status: { in: ["erro", "sem_endereco"] } }, data: { status: "pendente" } });
  await processPerks(20).catch(() => null);
  done("ok=brindes");
}

export async function savePerkAddress(f: FormData) {
  await user();
  const id = str(f, "memberId");
  const zip = str(f, "zip").replace(/\D/g, "");
  await db.clubMember.update({ where: { id }, data: { shirtSize: str(f, "size") || undefined, address: { zip, street: str(f, "street"), number: str(f, "number"), extra: str(f, "extra"), district: str(f, "district"), city: str(f, "city"), state: str(f, "state").toUpperCase().slice(0, 2) } } }).catch(() => null);
  await db.clubPerk.updateMany({ where: { memberId: id, status: { in: ["sem_endereco", "erro"] } }, data: { status: "pendente" } });
  await processPerks(5).catch(() => null);
  done("ok=brindes");
}

export async function payAffiliates(f: FormData) {
  await admin();
  const month = str(f, "month") || monthKey();
  const rows = await affiliateRows(month);
  for (const r of rows) if (!r.paidAt && r.amount > 0) await db.clubAffPayout.create({ data: { memberId: r.id, month, count: r.count, amount: r.amount } }).catch(() => null);
  done("ok=afiliados");
}

export async function saveClubPlus(f: FormData) {
  await admin();
  const c = (await getSettings()).club;
  const n = (k: string, d: number) => { const v = Number(str(f, k).replace(",", ".")); return Number.isFinite(v) && v >= 0 ? v : d; };
  await saveSetting("club", {
    usesPerMonth: Math.round(n("usesPerMonth", c.usesPerMonth)), birthdayPct: Math.min(90, n("birthdayPct", c.birthdayPct)), affiliatePct: Math.min(100, n("affiliatePct", c.affiliatePct)),
    t6Points: n("t6Points", c.t6Points), kitTitle: str(f, "kitTitle") || c.kitTitle, t3Gift: str(f, "t3Gift") || c.t3Gift, t12Gift: str(f, "t12Gift") || c.t12Gift,
    t3Link: str(f, "t3Link"), t6Link: str(f, "t6Link"), t12Link: str(f, "t12Link"), earlyLink: str(f, "earlyLink"),
    rafflePrizes: str(f, "rafflePrizes") || c.rafflePrizes, instagram: str(f, "instagram").replace(/^@+/, ""),
  });
  done("ok=regras");
}
