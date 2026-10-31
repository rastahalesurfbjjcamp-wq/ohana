"use server";
// Mensagens manuais: envio pelo botão do pedido/carrinho e cadastro das mensagens.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";
import { normalizePhone } from "@/lib/segments";
import { sendQuick, type QuickCtx, type QuickPart } from "@/lib/quick";

async function user() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function sendQuickAction(messageId: string, refId: string, phone: string, ctx: QuickCtx): Promise<{ ok: boolean; error?: string; at?: string; by?: string }> {
  const u = await user();
  const to = normalizePhone(phone);
  if (!to) return { ok: false, error: "Telefone inválido" };
  if (process.env.DEMO_MODE === "1") {
    await db.quickSend.create({ data: { messageId, refId, phone: to, by: u.name } });
    return { ok: true, at: new Date().toISOString(), by: u.name };
  }
  try {
    await sendQuick(messageId, refId, to, ctx, u.name);
    return { ok: true, at: new Date().toISOString(), by: u.name };
  } catch (e) {
    return { ok: false, error: String(e).replace(/^Error: /, "").slice(0, 160) };
  }
}

export async function saveQuickMessage(f: FormData) {
  await user();
  const id = str(f, "id");
  const prev = id ? await db.quickMessage.findUnique({ where: { id } }) : null;
  const old = (prev?.parts ?? []) as QuickPart[];
  const n = Math.min(6, Math.max(1, Number(str(f, "n")) || 1));
  const parts: QuickPart[] = [];
  for (let i = 0; i < n; i++) {
    const text = str(f, `text_${i}`);
    const productImage = f.get(`img_${i}`) === "on";
    const file = f.get(`file_${i}`);
    let mediaUrl = f.get(`keep_${i}`) === "1" ? old[i]?.mediaUrl : undefined;
    let mediaType = f.get(`keep_${i}`) === "1" ? old[i]?.mediaType : undefined;
    if (file instanceof File && file.size > 0) { const up = await saveUpload(file); mediaUrl = up.url; mediaType = up.type; }
    if (text || productImage || mediaUrl) parts.push({ text: text || undefined, productImage: productImage || undefined, mediaUrl, mediaType });
  }
  const data = { name: str(f, "name") || "Mensagem", kind: str(f, "kind") === "pedido" ? "pedido" : "carrinho", show: ["pendente", "pago", "enviado"].includes(str(f, "show")) ? str(f, "show") : "todos", parts };
  if (!parts.length) redirect(`/modelos?manual=${id || "novo"}&erro=1`);
  if (prev) await db.quickMessage.update({ where: { id }, data });
  else await db.quickMessage.create({ data: { ...data, position: await db.quickMessage.count() } });
  revalidatePath("/modelos");
  revalidatePath("/pedidos");
  redirect("/modelos?ok=manual#manuais");
}

export async function toggleQuickMessage(f: FormData) {
  await user();
  const m = await db.quickMessage.findUnique({ where: { id: str(f, "id") } });
  if (m) await db.quickMessage.update({ where: { id: m.id }, data: { active: !m.active } });
  revalidatePath("/modelos");
  revalidatePath("/pedidos");
}

export async function deleteQuickMessage(f: FormData) {
  await user();
  await db.quickMessage.delete({ where: { id: str(f, "id") } }).catch(() => null);
  revalidatePath("/modelos");
  redirect("/modelos#manuais");
}
