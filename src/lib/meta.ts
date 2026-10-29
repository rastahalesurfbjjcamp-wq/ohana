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
