"use server";
// Ações em todos os grupos da comunidade e criação de grupos em lote.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { evolution } from "@/lib/evolution";
import { syncGroups } from "@/lib/groups";
import { fillOrder } from "@/lib/redirect";
import { normalizePhone } from "@/lib/segments";
import { saveUpload } from "@/lib/uploads";

async function admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "ADMIN") throw new Error("Só o administrador pode mudar isso");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function eachGroup(fn: (jid: string, i: number) => Promise<unknown>) {
  const groups = await fillOrder();
  let ok = 0, fail = 0;
  for (let i = 0; i < groups.length; i++) {
    try {
      await fn(groups[i].jid, i);
      ok++;
    } catch {
      fail++;
    }
    await pause(1500); // devagar para o WhatsApp não estranhar
  }
  return { ok, fail };
}

// Nome com {n} vira o número do grupo na ordem (01, 02...). Descrição vale para todos.
export async function bulkGroupInfo(form: FormData) {
  await admin();
  const name = str(form, "name");
  const desc = str(form, "description");
  const start = Number(str(form, "start")) || 1;
  const r = await eachGroup(async (jid, i) => {
    if (name) await evolution.updateSubject(jid, name.replace(/\{n\}/g, String(start + i).padStart(2, "0")));
    if (desc) await evolution.updateDescription(jid, desc);
  });
  if (name) await syncGroups().catch(() => null);
  revalidatePath("/grupos");
  redirect(`/grupos?feito=${r.ok}&falha=${r.fail}`);
}

export async function bulkGroupPicture(form: FormData) {
  await admin();
  const file = form.get("photo");
  if (!(file instanceof File) || !file.size) redirect("/grupos?acao=foto&erro=1");
  const up = await saveUpload(file as File);
  const r = await eachGroup((jid) => evolution.updatePicture(jid, up.url));
  redirect(`/grupos?feito=${r.ok}&falha=${r.fail}`);
}

export async function bulkGroupAdmins(form: FormData) {
  await admin();
  const onlyAdmins = str(form, "mode") === "admins";
  const r = await eachGroup((jid) => evolution.updateSetting(jid, onlyAdmins ? "announcement" : "not_announcement"));
  redirect(`/grupos?feito=${r.ok}&falha=${r.fail}`);
}

// Cria vários grupos de uma vez. O WhatsApp exige pelo menos uma pessoa junto: o número de um admin da equipe.
export async function createGroupsBatch(form: FormData) {
  await admin();
  const prefix = str(form, "prefix") || "Grupo VIP";
  const count = Math.min(10, Math.max(1, Number(str(form, "count")) || 1));
  const start = Math.max(1, Number(str(form, "start")) || 1);
  const phone = normalizePhone(str(form, "admin"));
  const desc = str(form, "description");
  if (!phone) redirect("/grupos?criar=1&erro=numero");
  let ok = 0;
  for (let i = 0; i < count; i++) {
    try {
      await evolution.createGroup(`${prefix} ${String(start + i).padStart(2, "0")}`, [phone!], desc || undefined);
      ok++;
    } catch {
      // segue para o próximo
    }
    await pause(3000);
  }
  await syncGroups().catch(() => null);
  // os grupos novos já entram na comunidade, no fim da fila
  const fresh = await db.group.findMany({ where: { name: { startsWith: prefix }, isCommunity: false, archived: false } });
  for (const g of fresh) await db.group.update({ where: { id: g.id }, data: { isCommunity: true } });
  revalidatePath("/grupos");
  redirect(`/grupos?criados=${ok}`);
}

export async function leaveHub(form: FormData) {
  await admin();
  const id = str(form, "id");
  await db.group.update({ where: { id }, data: { isCommunity: false, isResults: false } });
  revalidatePath("/grupos");
}
