"use server";
// Popups de captura: criar, salvar, ligar/desligar, duplicar e apagar.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { POPUP_KINDS, defaultCfg, type PopupCfg } from "@/lib/popupTypes";

async function user() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function createPopup(f: FormData) {
  await user();
  const kind = String(f.get("kind") ?? "boasvindas");
  const k = POPUP_KINDS.find((x) => x.k === kind) ?? POPUP_KINDS[0];
  const p = await db.popup.create({ data: { name: k.label, kind: k.k, config: defaultCfg(k.k), active: false } });
  redirect(`/popups/${p.id}`);
}

export async function savePopup(id: string, name: string, cfg: PopupCfg) {
  await user();
  await db.popup.update({ where: { id }, data: { name: name.trim().slice(0, 80) || "Popup", config: JSON.parse(JSON.stringify(cfg)) } });
  revalidatePath("/popups");
  return { ok: true };
}

export async function setPopupActive(id: string, active: boolean) {
  await user();
  await db.popup.update({ where: { id }, data: { active } });
  revalidatePath("/popups");
  return { ok: true };
}

export async function togglePopup(f: FormData) {
  await user();
  const id = String(f.get("id"));
  const p = await db.popup.findUnique({ where: { id } });
  if (p) await db.popup.update({ where: { id }, data: { active: !p.active } });
  revalidatePath("/popups");
  redirect("/popups");
}

export async function duplicatePopup(f: FormData) {
  await user();
  const p = await db.popup.findUnique({ where: { id: String(f.get("id")) } });
  if (!p) redirect("/popups");
  const c = await db.popup.create({ data: { name: `${p!.name} (cópia)`, kind: p!.kind, config: p!.config ?? {}, active: false } });
  redirect(`/popups/${c.id}`);
}

export async function deletePopup(f: FormData) {
  await user();
  await db.popup.delete({ where: { id: String(f.get("id")) } }).catch(() => null);
  revalidatePath("/popups");
  redirect("/popups");
}

export async function saveWaButton(f: FormData) {
  await user();
  const phone = String(f.get("phone") ?? "").replace(/\D/g, "").slice(0, 15);
  const value = { on: f.get("on") === "1" && phone.length >= 10, phone, text: String(f.get("text") ?? "").slice(0, 200), label: String(f.get("label") ?? "").slice(0, 40), pos: f.get("pos") === "esquerda" ? "esquerda" : "direita" };
  await db.setting.upsert({ where: { key: "_popup_wa" }, create: { key: "_popup_wa", value }, update: { value } });
  revalidatePath("/popups");
  redirect("/popups?wa=1");
}
