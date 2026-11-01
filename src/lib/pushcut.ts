// Notificação no celular do dono (Pushcut) quando sai uma assinatura nova do clube
import { creds } from "./integrations";

export async function pushcut(title: string, text: string) {
  const url = (await creds()).pushcut.url;
  if (!url || !/^https:\/\/api\.pushcut\.io\//.test(url)) return false;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, text }), cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Pushcut respondeu ${r.status}`);
  return true;
}
