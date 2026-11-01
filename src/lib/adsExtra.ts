// TikTok Ads e Google Ads: gasto e resultado por campanha, para somar no lucro e no relatório.
import { creds } from "./integrations";

export type AdCamp = { id: string; name: string; spend: number; clicks: number; impressions: number; conversions: number; value: number };
const cache = new Map<string, { at: number; v: AdCamp[] }>();

async function memo(key: string, fn: () => Promise<AdCamp[]>) {
  const c = cache.get(key);
  if (c && Date.now() - c.at < 10 * 60_000) return c.v;
  const v = await fn();
  cache.set(key, { at: Date.now(), v });
  return v;
}

/* ---------- TikTok (Marketing API v1.3) ---------- */
const TT = "https://business-api.tiktok.com/open_api/v1.3";

export async function tiktokGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const c = (await creds()).tiktok;
  if (!c.token || !c.advertiserId) throw new Error("TIKTOK_NAO_CONFIGURADO");
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`${TT}${path}?${q}`, { headers: { "Access-Token": c.token }, cache: "no-store" });
  const j = (await r.json()) as { code: number; message: string; data: T };
  if (j.code !== 0) throw new Error(`TikTok: ${j.message}`);
  return j.data;
}

export async function tiktokCampaigns(from: string, to: string): Promise<AdCamp[]> {
  const c = (await creds()).tiktok;
  if (!c.token || !c.advertiserId) return [];
  return memo(`tt:${from}:${to}`, async () => {
    type Row = { dimensions: { campaign_id: string }; metrics: Record<string, string> };
    const d = await tiktokGet<{ list: Row[] }>("/report/integrated/get/", {
      advertiser_id: c.advertiserId!, report_type: "BASIC", data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify(["campaign_id"]), metrics: JSON.stringify(["campaign_name", "spend", "clicks", "impressions", "conversion", "total_complete_payment_rate", "complete_payment"]),
      start_date: from, end_date: to, page_size: "1000",
    });
    return (d.list ?? []).map((r) => ({
      id: r.dimensions.campaign_id, name: r.metrics.campaign_name ?? r.dimensions.campaign_id,
      spend: Number(r.metrics.spend) || 0, clicks: Number(r.metrics.clicks) || 0, impressions: Number(r.metrics.impressions) || 0,
      conversions: Number(r.metrics.complete_payment ?? r.metrics.conversion) || 0, value: 0,
    })).filter((x) => x.spend > 0 || x.impressions > 0);
  });
}

/* ---------- Google Ads (REST) ---------- */
async function googleToken() {
  const g = (await creds()).google;
  if (!g.clientId || !g.clientSecret || !g.refreshToken || !g.developerToken || !g.customerId) throw new Error("GOOGLE_NAO_CONFIGURADO");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: "refresh_token" }), cache: "no-store" });
  const j = (await r.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!j.access_token) throw new Error(`Google recusou o acesso: ${j.error_description ?? j.error ?? r.status}`);
  return { token: j.access_token, g };
}

export async function googleQuery<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const { token, g } = await googleToken();
  const cid = g.customerId!.replace(/\D/g, "");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "developer-token": g.developerToken!, "Content-Type": "application/json" };
  if (g.loginCustomerId) headers["login-customer-id"] = g.loginCustomerId.replace(/\D/g, "");
  const r = await fetch(`https://googleads.googleapis.com/${g.apiVersion || "v24"}/customers/${cid}/googleAds:searchStream`, { method: "POST", headers, body: JSON.stringify({ query }), cache: "no-store" });
  const j = (await r.json()) as { results?: T[]; error?: { message: string } }[] | { error?: { message: string; details?: { errors?: { message: string }[] }[] } };
  if (!Array.isArray(j)) throw new Error(`Google Ads: ${j.error?.details?.[0]?.errors?.[0]?.message ?? j.error?.message ?? r.status}`);
  return j.flatMap((b) => b.results ?? []);
}

export async function googleCampaigns(from: string, to: string): Promise<AdCamp[]> {
  const g = (await creds()).google;
  if (!g.refreshToken || !g.customerId) return [];
  return memo(`gg:${from}:${to}`, async () => {
    type Row = { campaign: { id: string; name: string }; metrics: { costMicros?: string; clicks?: string; impressions?: string; conversions?: number; conversionsValue?: number } };
    const rows = await googleQuery<Row>(`SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'`);
    const map = new Map<string, AdCamp>();
    for (const r of rows) {
      const c = map.get(r.campaign.id) ?? { id: r.campaign.id, name: r.campaign.name, spend: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 };
      c.spend += Number(r.metrics.costMicros ?? 0) / 1e6; c.clicks += Number(r.metrics.clicks ?? 0); c.impressions += Number(r.metrics.impressions ?? 0);
      c.conversions += Number(r.metrics.conversions ?? 0); c.value += Number(r.metrics.conversionsValue ?? 0);
      map.set(r.campaign.id, c);
    }
    return [...map.values()].filter((x) => x.spend > 0 || x.impressions > 0);
  });
}

// Gasto somado de TikTok e Google no período (0 se não estiverem conectados)
export async function extraSpend(from: string, to: string) {
  const [t, g] = await Promise.all([tiktokCampaigns(from, to).catch(() => []), googleCampaigns(from, to).catch(() => [])]);
  const sum = (l: AdCamp[]) => l.reduce((s, c) => s + c.spend, 0);
  return { tiktok: sum(t), google: sum(g), total: sum(t) + sum(g), tiktokCamps: t, googleCamps: g };
}
