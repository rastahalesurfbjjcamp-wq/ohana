// Meta Ads fictício: contas, campanhas e resultados por dia, coerentes com os pedidos da loja.
import { CAMPAIGNS } from "./data";

const ACCOUNTS = [{ account_id: "1001", name: "Maré Alta · Vendas", account_status: 1 }, { account_id: "1002", name: "Maré Alta · Perfil", account_status: 1 }];
const days = (a: string, b: string) => { const out: string[] = []; for (let d = new Date(a + "T12:00:00Z"); d.toISOString().slice(0, 10) <= b; d = new Date(d.getTime() + 864e5)) out.push(d.toISOString().slice(0, 10)); return out; };
const wobble = (day: string, id: string) => { let h = 0; for (const ch of day + id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 0.75 + (h % 1000) / 2000; };

function statsFor(c: (typeof CAMPAIGNS)[number], since: string, until: string) {
  let spend = 0, imp = 0, clicks = 0, purchases = 0, value = 0, leads = 0, visits = 0, convs = 0, eng = 0;
  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  for (const d of days(since, until > today ? today : until)) {
    const f = wobble(d, c.id) * (d === today ? new Date(Date.now() - 3 * 3600_000).getUTCHours() / 24 : 1);
    const s = c.daily * f; spend += s; imp += s * 95; clicks += s * 1.9;
    if (c.kind === "vendas") { const p = s / (38 + (c.id.charCodeAt(5) % 3) * 9); purchases += p; value += p * 285; }
    if (c.kind === "leads") leads += s / 2.6;
    if (c.kind === "perfil") { visits += s * 9.5; convs += s * 0.4; eng += s * 60; }
  }
  const r = (x: number) => String(Math.round(x));
  const actions = [
    { action_type: "link_click", value: r(clicks) },
    ...(purchases ? [{ action_type: "omni_purchase", value: r(purchases) }, { action_type: "offsite_conversion.fb_pixel_purchase", value: r(purchases) }] : []),
    ...(leads ? [{ action_type: "lead", value: r(leads) }, { action_type: "offsite_conversion.fb_pixel_lead", value: r(leads) }] : []),
    ...(visits ? [{ action_type: "post_engagement", value: r(eng) }, { action_type: "onsite_conversion.messaging_conversation_started_7d", value: r(convs) }] : []),
  ];
  return { spend: spend.toFixed(2), impressions: r(imp), clicks: r(clicks), inline_link_clicks: r(clicks), ctr: (clicks / Math.max(1, imp) * 100).toFixed(2), cpc: (spend / Math.max(1, clicks)).toFixed(2), actions, action_values: purchases ? [{ action_type: "omni_purchase", value: value.toFixed(2) }, { action_type: "offsite_conversion.fb_pixel_purchase", value: value.toFixed(2) }] : [], ...(visits ? { instagram_profile_visits: r(visits) } : {}) };
}

export function demoGraph(url: URL): unknown {
  const path = url.pathname.replace(/^\/v\d+\.\d+/, "");
  if (path.startsWith("/me/adaccounts")) return { data: ACCOUNTS };
  const m = path.match(/^\/act_(\d+)(\/insights)?/);
  if (!m) return { id: "demo", name: "Maré Alta", display_phone_number: "+55 21 4000-0000", verified_name: "Maré Alta" };
  const acc = ACCOUNTS.find((a) => a.account_id === m[1]);
  if (!m[2]) return { name: acc?.name ?? "Conta demo", account_status: 1 };
  const tr = JSON.parse(url.searchParams.get("time_range") ?? "{}") as { since?: string; until?: string };
  const since = tr.since ?? "2020-01-01", until = tr.until ?? "2999-01-01";
  const level = url.searchParams.get("level") ?? "account";
  const camps = CAMPAIGNS.filter((c) => c.acc === m[1]);
  if (level === "campaign") return { data: camps.map((c) => ({ campaign_id: c.id, campaign_name: c.name, objective: c.objective, ...statsFor(c, since, until) })).filter((x) => Number(x.spend) > 0) };
  if (level === "ad") {
    const rows = camps.flatMap((c) => [1, 2, 3].map((k) => {
      const st = statsFor(c, since, until); const share = k === 1 ? 0.5 : k === 2 ? 0.32 : 0.18;
      const sc = (x: string) => String(Math.round(Number(x) * share));
      return { campaign_id: c.id, adset_id: `${c.id}1`, ad_id: `${c.id}1${k}`, campaign_name: c.name, adset_name: "Público principal", ad_name: ["Vídeo surf", "Carrossel coleção", "Foto atleta"][k - 1], spend: (Number(st.spend) * share).toFixed(2), inline_link_clicks: sc(st.inline_link_clicks), actions: st.actions.map((a) => ({ ...a, value: sc(a.value) })), action_values: st.action_values.map((a) => ({ ...a, value: (Number(a.value) * share).toFixed(2) })) };
    })).filter((x) => Number(x.spend) > 0);
    return { data: rows };
  }
  const all = camps.map((c) => statsFor(c, since, until));
  return { data: [{ spend: all.reduce((s, x) => s + Number(x.spend), 0).toFixed(2), actions: [], action_values: [] }] };
}
