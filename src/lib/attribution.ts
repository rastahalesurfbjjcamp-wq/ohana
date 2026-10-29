import type { Order } from "./store";

export function channelOf(o: Order): { channel: string; paid: boolean; campaign: string | null } {
  const u = o.utm;
  if (u?.source) {
    const s = u.source;
    const paid = /cpc|paid|ads|ppc|cpm/.test(u.medium ?? "") || /ads/.test(s);
    if (/^(fb|facebook|ig|instagram|meta)/.test(s)) return { channel: paid || u.campaign ? "Meta Ads" : "Instagram/Facebook (link)", paid: paid || !!u.campaign, campaign: u.campaign ?? null };
    if (/google|gads|adwords/.test(s)) return { channel: paid ? "Google Ads" : "Google (link)", paid, campaign: u.campaign ?? null };
    if (/tiktok/.test(s)) return { channel: "TikTok", paid, campaign: u.campaign ?? null };
    if (/whats|wpp|zap|grupo|comunidade/.test(s)) return { channel: "WhatsApp / comunidade", paid: false, campaign: u.campaign ?? null };
    if (/mail|klaviyo|newsletter/.test(s)) return { channel: "E-mail", paid: false, campaign: u.campaign ?? null };
    return { channel: `UTM: ${s}`, paid, campaign: u.campaign ?? null };
  }
  const r = (o.firstSource ?? "").toLowerCase();
  if (!r) return { channel: "Direto (sem origem)", paid: false, campaign: null };
  if (r.includes("instagram")) return { channel: "Instagram orgânico", paid: false, campaign: null };
  if (r.includes("facebook")) return { channel: "Facebook orgânico", paid: false, campaign: null };
  if (r.includes("google")) return { channel: "Google orgânico", paid: false, campaign: null };
  if (r.includes("linktr") || r.includes("bio")) return { channel: "Link na bio", paid: false, campaign: null };
  if (r.includes("whatsapp") || r.includes("wa.me")) return { channel: "WhatsApp / comunidade", paid: false, campaign: null };
  if (r.includes("tiktok")) return { channel: "TikTok orgânico", paid: false, campaign: null };
  return { channel: "Outros sites", paid: false, campaign: null };
}
