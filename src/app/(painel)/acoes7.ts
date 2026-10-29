"use server";
// Anúncios: contas que aparecem no Hub, tipo de cada campanha e cartões da visão geral.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings, saveSetting, type AdAccountCfg, type AdGroup } from "@/lib/settings";

async function admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "ADMIN") throw new Error("Só o administrador pode mudar isso");
}
const KINDS = ["auto", "vendas", "leads", "perfil"] as const;
const GROUPS = ["vendas", "leads", "perfil", "fora"] as const;

export async function saveAdAccounts(f: FormData) {
  await admin();
  const ids = f.getAll("id").map(String);
  const accounts: AdAccountCfg[] = ids.map((id) => {
    const k = String(f.get(`kind_${id}`) ?? "auto");
    return { id, name: String(f.get(`name_${id}`) ?? ""), on: f.get(`on_${id}`) === "1", kind: (KINDS as readonly string[]).includes(k) ? (k as AdAccountCfg["kind"]) : "auto" };
  });
  await saveSetting("ads", { accounts });
  revalidatePath("/campanhas");
  revalidatePath("/");
}

export async function saveCampGroup(f: FormData) {
  await admin();
  const id = String(f.get("id") ?? "");
  const g = String(f.get("group") ?? "auto");
  if (!id) return;
  const camp = { ...(await getSettings()).ads.camp };
  if ((GROUPS as readonly string[]).includes(g)) camp[id] = g as AdGroup;
  else delete camp[id];
  await saveSetting("ads", { camp });
  revalidatePath("/campanhas");
  revalidatePath("/");
}

export async function saveDashCards(f: FormData) {
  await admin();
  const cards = f.getAll("card").map(String).slice(0, 12);
  await saveSetting("ads", { cards: cards.length ? cards : ["faturamento"] });
  revalidatePath("/");
}

export async function saveFollowMetric(f: FormData) {
  await admin();
  await saveSetting("ads", { followMetric: String(f.get("metric") ?? "").slice(0, 120) });
  revalidatePath("/campanhas");
  revalidatePath("/");
}

export async function savePerfilCoupons(f: FormData) {
  await admin();
  const list = String(f.get("coupons") ?? "").split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^[\w-]{2,40}$/.test(c)).slice(0, 10);
  await saveSetting("ads", { perfilCoupons: list });
  revalidatePath("/campanhas");
  revalidatePath("/");
}
