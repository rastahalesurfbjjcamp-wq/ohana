// Gasto do Meta Ads (Graph API).
import { swr } from "./cache";
import { creds } from "./integrations";
import { getSettings, type AdAccountCfg, type AdGroup } from "./settings";

const GRAPH = process.env.META_GRAPH_URL || "https://graph.facebook.com/v23.0"; // endereço alternativo só para teste local

async function metaSpendRaw(sinceIso: string, untilIso: string): Promise<number | null> {
  const { token } = (await creds()).meta;
  const accs = await activeAccounts();
  if (!token || !accs.length) return null;
  let total = 0;
  for (const a of accs) total += (await spendOf(a.id, sinceIso, untilIso, token)) ?? 0;
  return total;
}

async function spendOf(account: string, sinceIso: string, untilIso: string, token: string): Promise<number | null> {
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
async function metaInsightsRaw(sinceIso: string, untilIso: string, level: "account" | "campaign" = "account") {
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

async function metaCampaignsRaw(sinceIso: string, untilIso: string): Promise<CampaignRow[] | null> {
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
async function metaAdsRaw(sinceIso: string, untilIso: string): Promise<AdRow[] | null> {
  const { token } = (await creds()).meta;
  const accs = await activeAccounts();
  if (!token || !accs.length) return null;
  const out: AdRow[] = [];
  for (const a of accs) out.push(...(await adsOf(a.id, sinceIso, untilIso, token)));
  return out;
}

async function adsOf(account: string, sinceIso: string, untilIso: string, token: string): Promise<AdRow[]> {
  const act = account.startsWith("act_") ? account : `act_${account}`;
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

export async function metaSpend(sinceIso: string, untilIso: string): Promise<number | null> {
  const k = (await activeAccounts()).map((a) => a.id).join(",");
  return swr(`spend:${sinceIso}:${untilIso}:${k}`, 300_000, () => metaSpendRaw(sinceIso, untilIso));
}

export async function metaInsights(sinceIso: string, untilIso: string, level: "account" | "campaign" = "account") {
  return swr(`ins:${sinceIso}:${untilIso}:${level}`, 300_000, () => metaInsightsRaw(sinceIso, untilIso, level));
}

export async function metaCampaigns(sinceIso: string, untilIso: string) {
  return swr(`camp:${sinceIso}:${untilIso}`, 300_000, () => metaCampaignsRaw(sinceIso, untilIso));
}

export async function metaAds(sinceIso: string, untilIso: string) {
  const k = (await activeAccounts()).map((a) => a.id).join(",");
  return swr(`ads:${sinceIso}:${untilIso}:${k}`, 300_000, () => metaAdsRaw(sinceIso, untilIso));
}

/* ---------- Várias contas e campanhas separadas por tipo (venda, lead, perfil) ---------- */

const actId = (a: string) => (a.startsWith("act_") ? a : `act_${a}`);

// Contas que o token enxerga
export type MetaAccount = { id: string; name: string; status: number };
async function metaAccountsRaw(): Promise<MetaAccount[]> {
  const { token } = (await creds()).meta;
  if (!token) return [];
  const res = await fetch(`${GRAPH}/me/adaccounts?${new URLSearchParams({ fields: "account_id,name,account_status", limit: "100", access_token: token })}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Meta Ads respondeu ${res.status}`);
  const j = (await res.json()) as { data?: { account_id: string; name: string; account_status: number }[] };
  return (j.data ?? []).map((a) => ({ id: a.account_id, name: a.name, status: a.account_status }));
}
export async function metaAccounts() {
  return swr("accounts", 1_800_000, metaAccountsRaw);
}

// Contas ligadas no Hub. Sem escolha feita, usa a conta da integração.
export async function activeAccounts(): Promise<AdAccountCfg[]> {
  const [{ ads }, c] = await Promise.all([getSettings(), creds()]);
  const on = ads.accounts.filter((a) => a.on);
  if (on.length) return on;
  return c.meta.adAccount ? [{ id: c.meta.adAccount, name: "Conta principal", on: true, kind: "auto" }] : [];
}

type A = { action_type: string; value: string }[];
const first = (a: A | undefined, types: string[]) => Number(types.map((t) => a?.find((x) => x.action_type === t)).find(Boolean)?.value ?? 0);
const most = (a: A | undefined, re: RegExp, not?: RegExp) => Math.max(0, ...(a ?? []).filter((x) => re.test(x.action_type) && !(not && not.test(x.action_type))).map((x) => Number(x.value)));

export interface CampStat {
  id: string; name: string; account: string; accountName: string; objective: string;
  group: AdGroup; auto: AdGroup; manual: boolean;
  spend: number; impressions: number; clicks: number;
  leads: number; follows: number; visits: number; purchases: number; value: number;
  acts: Record<string, number>; // tudo que o Meta mandou nessa campanha (para escolher a métrica de seguidor)
}

// Campos extras que nem toda conta/versão aceita: testa uma vez e lembra
const EXTRA = ["instagram_profile_visits"];
const extraOk = new Map<string, boolean>();

const OBJ: Record<string, AdGroup> = {
  OUTCOME_SALES: "vendas", CONVERSIONS: "vendas", PRODUCT_CATALOG_SALES: "vendas",
  OUTCOME_LEADS: "leads", LEAD_GENERATION: "leads",
  OUTCOME_ENGAGEMENT: "perfil", OUTCOME_AWARENESS: "perfil", POST_ENGAGEMENT: "perfil", PAGE_LIKES: "perfil", BRAND_AWARENESS: "perfil", REACH: "perfil", VIDEO_VIEWS: "perfil",
};

async function campStatsRaw(sinceIso: string, untilIso: string): Promise<CampStat[] | null> {
  const { token } = (await creds()).meta;
  const [accs, s] = await Promise.all([activeAccounts(), getSettings()]);
  if (!token || !accs.length) return null;
  const out: CampStat[] = [];
  const fm = s.ads.followMetric;
  for (const acc of accs) {
    const extra = EXTRA.filter((f) => extraOk.get(f) !== false);
    let url: string | null = `${GRAPH}/${actId(acc.id)}/insights?${new URLSearchParams({
      fields: ["campaign_id,campaign_name,objective,spend,impressions,inline_link_clicks,actions,action_values", ...extra].join(","),
      level: "campaign",
      time_range: JSON.stringify({ since: sinceIso, until: untilIso }),
      limit: "200",
      access_token: token,
    })}`;
    while (url) {
      const res: Response = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.text();
        // campo extra não aceito: tira e tenta de novo
        const bad = extra.find((f) => body.includes(f));
        if (res.status === 400 && bad && extraOk.get(bad) !== false) { extraOk.set(bad, false); return campStatsRaw(sinceIso, untilIso); }
        throw new Error(`Meta Ads respondeu ${res.status} na conta ${acc.name || acc.id}`);
      }
      for (const f of extra) extraOk.set(f, true);
      const j = (await res.json()) as { data?: ({ campaign_id: string; campaign_name: string; objective?: string; spend?: string; impressions?: string; inline_link_clicks?: string; actions?: A; action_values?: A } & Record<string, unknown>)[]; paging?: { next?: string } };
      for (const r of j.data ?? []) {
        const acts: Record<string, number> = {};
        for (const a of r.actions ?? []) acts[a.action_type] = Number(a.value) || 0;
        for (const f of extra) if (r[f] != null) acts[f] = Number(r[f]) || 0;
        const visits = acts.instagram_profile_visits || most(r.actions, /profile_visit/);
        // seguidor: a métrica escolhida no painel, ou o que tiver "follow" no nome
        const follows = fm ? acts[fm] ?? 0 : most(r.actions, /follow/, /unfollow/);
        const leads = first(r.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "onsite_web_lead", "leadgen_grouped"]);
        const purchases = first(r.actions, ["omni_purchase", "offsite_conversion.fb_pixel_purchase", "purchase"]);
        const objective = r.objective ?? "";
        // tipo automático: a conta manda primeiro, depois o objetivo da campanha
        let auto: AdGroup = acc.kind !== "auto" ? acc.kind : OBJ[objective] ?? (follows || visits ? "perfil" : leads && !purchases ? "leads" : purchases ? "vendas" : "fora");
        if (acc.kind === "auto" && objective === "OUTCOME_TRAFFIC") auto = follows || visits ? "perfil" : purchases ? "vendas" : leads ? "leads" : "fora";
        const manual = s.ads.camp[r.campaign_id];
        out.push({
          id: r.campaign_id, name: r.campaign_name, account: acc.id, accountName: acc.name, objective,
          group: manual ?? auto, auto, manual: !!manual,
          spend: Number(r.spend ?? 0), impressions: Number(r.impressions ?? 0), clicks: Number(r.inline_link_clicks ?? 0),
          leads, follows, visits, purchases, acts,
          value: first(r.action_values, ["omni_purchase", "offsite_conversion.fb_pixel_purchase", "purchase"]),
        });
      }
      url = j.paging?.next ?? null;
    }
  }
  return out.sort((a, b) => b.spend - a.spend);
}

export async function campStats(sinceIso: string, untilIso: string) {
  const s = await getSettings();
  // a chave muda quando as escolhas mudam, para o painel refletir na hora
  const key = JSON.stringify([s.ads.accounts.filter((a) => a.on).map((a) => a.id + a.kind), s.ads.camp, s.ads.followMetric]);
  return swr(`cs:${sinceIso}:${untilIso}:${key}`, 300_000, () => campStatsRaw(sinceIso, untilIso));
}

export type GroupTotals = { spend: number; leads: number; follows: number; visits: number; purchases: number; value: number; campaigns: number };
export function byGroup(rows: CampStat[]) {
  const z = (): GroupTotals => ({ spend: 0, leads: 0, follows: 0, visits: 0, purchases: 0, value: 0, campaigns: 0 });
  const g: Record<AdGroup, GroupTotals> & { total: GroupTotals } = { vendas: z(), leads: z(), perfil: z(), fora: z(), total: z() };
  for (const r of rows) {
    for (const t of [g[r.group], g.total]) {
      t.spend += r.spend; t.leads += r.leads; t.follows += r.follows; t.visits += r.visits; t.purchases += r.purchases; t.value += r.value;
      if (r.spend > 0) t.campaigns++;
    }
  }
  return g;
}
