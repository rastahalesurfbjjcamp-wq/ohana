// Gasto do Meta Ads (Graph API).
import { creds } from "./integrations";

const GRAPH = "https://graph.facebook.com/v23.0";

export async function metaSpend(sinceIso: string, untilIso: string): Promise<number | null> {
  const { token, adAccount: account } = (await creds()).meta;
  if (!token || !account) return null;
  const act = account.startsWith("act_") ? account : `act_${account}`;
  const params = new URLSearchParams({
    fields: "spend",
    time_range: JSON.stringify({ since: sinceIso, until: untilIso }),
    access_token: token,
  });
  const res = await fetch(`${GRAPH}/${act}/insights?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Meta Ads respondeu ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: { spend?: string }[] };
  return json.data?.reduce((s, r) => s + Number(r.spend ?? 0), 0) ?? 0;
}

// Gasto e compras que o próprio Meta diz ter gerado
export async function metaInsights(sinceIso: string, untilIso: string, level: "account" | "campaign" = "account") {
  const { token, adAccount: account } = (await creds()).meta;
  if (!token || !account) return null;
  const act = account.startsWith("act_") ? account : `act_${account}`;
  const params = new URLSearchParams({
    fields: level === "campaign" ? "campaign_name,spend,actions,action_values" : "spend,actions,action_values",
    level,
    time_range: JSON.stringify({ since: sinceIso, until: untilIso }),
    limit: "200",
    access_token: token,
  });
  const res = await fetch(`${GRAPH}/${act}/insights?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Meta Ads respondeu ${res.status}`);
  type A = { action_type: string; value: string }[];
  const json = (await res.json()) as { data?: { campaign_name?: string; spend?: string; actions?: A; action_values?: A }[] };
  const pick = (a: A | undefined) => {
    const p = a?.find((x) => x.action_type === "omni_purchase") ?? a?.find((x) => x.action_type === "offsite_conversion.fb_pixel_purchase") ?? a?.find((x) => x.action_type === "purchase");
    return Number(p?.value ?? 0);
  };
  return (json.data ?? []).map((r) => ({
    campaign: r.campaign_name ?? "Conta",
    spend: Number(r.spend ?? 0),
    purchases: pick(r.actions),
    value: pick(r.action_values),
  }));
}

export interface CampaignRow {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  purchases: number;
  value: number;
}

export async function metaCampaigns(sinceIso: string, untilIso: string): Promise<CampaignRow[] | null> {
  const { token, adAccount } = (await creds()).meta;
  if (!token || !adAccount) return null;
  const act = adAccount.startsWith("act_") ? adAccount : `act_${adAccount}`;
  const params = new URLSearchParams({
    fields: "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions,action_values",
    level: "campaign",
    time_range: JSON.stringify({ since: sinceIso, until: untilIso }),
    limit: "200",
    access_token: token,
  });
  const res = await fetch(`${GRAPH}/${act}/insights?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Meta Ads respondeu ${res.status}`);
  type A = { action_type: string; value: string }[];
  const json = (await res.json()) as { data?: { campaign_id: string; campaign_name: string; spend?: string; impressions?: string; clicks?: string; ctr?: string; cpc?: string; actions?: A; action_values?: A }[] };
  const pick = (a?: A) => Number((a?.find((x) => x.action_type === "omni_purchase") ?? a?.find((x) => x.action_type === "offsite_conversion.fb_pixel_purchase"))?.value ?? 0);
  return (json.data ?? []).map((r) => ({
    id: r.campaign_id,
    name: r.campaign_name,
    spend: Number(r.spend ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    ctr: Number(r.ctr ?? 0) / 100,
    cpc: Number(r.cpc ?? 0),
    purchases: pick(r.actions),
    value: pick(r.action_values),
  }));
}

// Nível anúncio: campanha, conjunto e anúncio com gasto, cliques, leads e compras que o Meta conta
export interface AdRow { campaignId: string; adsetId: string; adId: string; campaign: string; adset: string; ad: string; spend: number; clicks: number; leads: number; purchases: number; value: number }
export async function metaAds(sinceIso: string, untilIso: string): Promise<AdRow[] | null> {
  const { token, adAccount } = (await creds()).meta;
  if (!token || !adAccount) return null;
  const act = adAccount.startsWith("act_") ? adAccount : `act_${adAccount}`;
  const out: AdRow[] = [];
  let url: string | null = `${GRAPH}/${act}/insights?${new URLSearchParams({
    fields: "campaign_id,adset_id,ad_id,campaign_name,adset_name,ad_name,spend,inline_link_clicks,actions,action_values",
    level: "ad",
    time_range: JSON.stringify({ since: sinceIso, until: untilIso }),
    limit: "500",
    access_token: token,
  })}`;
  type A = { action_type: string; value: string }[];
  const val = (a: A | undefined, types: string[]) => Number(types.map((t) => a?.find((x) => x.action_type === t)).find(Boolean)?.value ?? 0);
  while (url) {
    const res: Response = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Meta Ads respondeu ${res.status}`);
    const json = (await res.json()) as { data?: { campaign_id: string; adset_id: string; ad_id: string; campaign_name: string; adset_name: string; ad_name: string; spend?: string; inline_link_clicks?: string; actions?: A; action_values?: A }[]; paging?: { next?: string } };
    for (const r of json.data ?? []) {
      out.push({
        campaignId: r.campaign_id, adsetId: r.adset_id, adId: r.ad_id, campaign: r.campaign_name, adset: r.adset_name, ad: r.ad_name,
        spend: Number(r.spend ?? 0), clicks: Number(r.inline_link_clicks ?? 0),
        leads: val(r.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "complete_registration"]),
        purchases: val(r.actions, ["omni_purchase", "offsite_conversion.fb_pixel_purchase", "purchase"]),
        value: val(r.action_values, ["omni_purchase", "offsite_conversion.fb_pixel_purchase", "purchase"]),
      });
    }
    url = json.paging?.next ?? null;
  }
  return out;
}
