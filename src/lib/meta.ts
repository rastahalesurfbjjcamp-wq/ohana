// Gasto do Meta Ads (Graph API).
import { env } from "./env";

const GRAPH = "https://graph.facebook.com/v23.0";

export async function metaSpend(sinceIso: string, untilIso: string): Promise<number | null> {
  const token = env.metaToken();
  const account = env.metaAdAccount();
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
