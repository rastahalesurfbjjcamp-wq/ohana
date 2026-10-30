// Loja fictícia da demonstração: produtos, clientes e um ano de pedidos, sempre iguais para o mesmo dia.
// Nada aqui é de cliente real.

export const DEMO_STORE = "Maré Alta";
export const DEMO_DOMAIN = "mare-alta-demo.myshopify.com";
const TZ_OFFSET = -3; // horário de Brasília

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const wpick = <T,>(r: () => number, a: [T, number][]) => { const tot = a.reduce((s, x) => s + x[1], 0); let v = r() * tot; for (const [x, w] of a) { v -= w; if (v <= 0) return x; } return a[a.length - 1][0]; };

export type DProduct = { id: string; title: string; price: number; cost: number; line: string; sizes: string[]; stock: number[]; weight: number; createdDaysAgo: number };
const P: [string, number, number, string, number, number?][] = [
  ["Rashguard Tide Breaker", 239, 62, "rash", 9],
  ["Rashguard Coral Reef", 229, 58, "rash", 7],
  ["Rashguard Night Swell", 249, 66, "rash", 6, 40],
  ["Rashguard Long Sleeve Lagoa", 259, 69, "rash", 4],
  ["Fight Short Tide Breaker", 179, 48, "short", 8],
  ["Fight Short Coral Reef", 169, 45, "short", 6],
  ["Fight Short Black Sand", 179, 47, "short", 5, 25],
  ["Boardshort Sunset Point", 199, 52, "board", 5],
  ["Boardshort Lagoa Azul", 189, 50, "board", 4],
  ["Camiseta Classic Wave", 99, 28, "tee", 8],
  ["Camiseta Old School Surf", 109, 30, "tee", 5],
  ["Boné Trucker Maré", 89, 22, "cap", 4],
  ["Kimono Competition A2 Branco", 549, 180, "gi", 3],
  ["Kimono Light Preto", 499, 165, "gi", 2],
  ["Lycra Kids Ondinha", 149, 38, "kids", 3],
  ["Conjunto Rash + Short Tide", 389, 110, "set", 4],
  ["Moletom Swell", 229, 70, "tee", 2],
];
export const PRODUCTS: DProduct[] = (() => {
  const r = rng(11);
  return P.map(([title, price, cost, line, weight, created], i) => {
    const sizes = line === "gi" ? ["A1", "A2", "A3"] : line === "cap" ? ["Único"] : line === "kids" ? ["4", "6", "8", "10"] : ["P", "M", "G", "GG"];
    const stock = sizes.map((_, k) => {
      const base = Math.floor(r() * 26) + 2;
      if (i === 2 && k === 1) return 0; // tamanho esgotado
      if (i === 4 && k === 3) return 1;
      if (i === 9 && k === 0) return 2;
      if (i === 13) return Math.floor(r() * 3);
      return base;
    });
    return { id: `gid://shopify/Product/${9000 + i}`, title, price, cost, line, sizes, stock, weight, createdDaysAgo: created ?? 430 };
  });
})();

const FIRST = ["Lucas", "Gabriel", "Rafael", "Bruno", "Thiago", "Felipe", "Pedro", "João", "Mateus", "Gustavo", "Diego", "André", "Caio", "Rodrigo", "Vinícius", "Leonardo", "Marcelo", "Daniel", "Henrique", "Igor", "Ana", "Juliana", "Camila", "Beatriz", "Larissa", "Mariana", "Fernanda", "Bruna", "Carolina", "Isabela", "Letícia", "Renata", "Aline", "Paula", "Tatiane"];
const LAST = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Lima", "Araújo", "Fernandes", "Carvalho", "Gomes", "Martins", "Rocha", "Ribeiro", "Barros", "Freitas", "Teixeira", "Moura", "Cardoso", "Pinto", "Mendes", "Duarte"];
const STATES: [string, number, string[]][] = [["RJ", 34, ["Rio de Janeiro", "Niterói", "Saquarema", "Cabo Frio"]], ["SP", 24, ["São Paulo", "Santos", "Ubatuba", "Campinas"]], ["SC", 10, ["Florianópolis", "Balneário Camboriú", "Garopaba"]], ["PR", 6, ["Curitiba", "Matinhos"]], ["MG", 7, ["Belo Horizonte", "Juiz de Fora"]], ["ES", 5, ["Vitória", "Vila Velha"]], ["BA", 5, ["Salvador", "Itacaré"]], ["PE", 3, ["Recife"]], ["CE", 3, ["Fortaleza"]], ["RS", 3, ["Porto Alegre"]]];

function cpf(r: () => number) {
  const n = Array.from({ length: 9 }, () => Math.floor(r() * 10));
  const d = (a: number[], f: number) => { const s = a.reduce((acc, x, i) => acc + x * (f - i), 0); const v = (s * 10) % 11; return v === 10 ? 0 : v; };
  n.push(d(n, 10)); n.push(d(n, 11)); return n.join("");
}
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type DCustomer = { id: string; name: string; email: string; phone: string; cpf: string; state: string; city: string; createdAt: string };
export const CUSTOMERS: DCustomer[] = (() => {
  const r = rng(22);
  const out: DCustomer[] = [];
  for (let i = 0; i < 1500; i++) {
    const f = pick(r, FIRST), l = pick(r, LAST), l2 = pick(r, LAST);
    const st = wpick(r, STATES.map((s) => [s, s[1]] as [typeof s, number]));
    const ddd = { RJ: "21", SP: "11", SC: "48", PR: "41", MG: "31", ES: "27", BA: "71", PE: "81", CE: "85", RS: "51" }[st[0]] ?? "21";
    out.push({
      id: `gid://shopify/Customer/${70000 + i}`, name: `${f} ${l}${r() < 0.4 ? ` ${l2}` : ""}`,
      email: `${strip(f)}.${strip(l)}${Math.floor(r() * 90 + 10)}@exemplo.com`,
      phone: `55${ddd}9${String(Math.floor(r() * 1e8)).padStart(8, "0")}`, cpf: cpf(r), state: st[0], city: pick(r, st[2]),
      createdAt: new Date(Date.now() - Math.floor(r() * 500) * 864e5).toISOString(),
    });
  }
  return out;
})();

export const ATHLETES = [
  { code: "MANUSURF", name: "Manuela Prado", ig: "@manu.prado.surf", pct: 10, kind: "atleta" },
  { code: "TIAGOGP", name: "Tiago Guerra", ig: "@tiagoguerra.bjj", pct: 10, kind: "atleta" },
  { code: "RAFAONDA", name: "Rafa Onda", ig: "@rafaonda", pct: 10, kind: "influenciador" },
  { code: "MESTREJOCA", name: "Mestre Joca", ig: "@mestrejoca", pct: 15, kind: "atleta" },
];
export const CAMPAIGNS = [
  { id: "238001", acc: "1001", name: "[VENDAS] Rashguards · Remarketing", objective: "OUTCOME_SALES", daily: 95, kind: "vendas" },
  { id: "238002", acc: "1001", name: "[VENDAS] Coleção Verão · Público amplo", objective: "OUTCOME_SALES", daily: 140, kind: "vendas" },
  { id: "238003", acc: "1001", name: "[VENDAS] Kimonos · Interesse jiu-jitsu", objective: "OUTCOME_SALES", daily: 55, kind: "vendas" },
  { id: "238004", acc: "1001", name: "[LEAD] Grupo VIP · Lançamento", objective: "OUTCOME_LEADS", daily: 45, kind: "leads" },
  { id: "238005", acc: "1002", name: "Perfil · Novos seguidores", objective: "OUTCOME_ENGAGEMENT", daily: 35, kind: "perfil" },
];

export type DOrder = {
  n: number; id: string; name: string; createdAt: string; customer: DCustomer;
  lines: { p: DProduct; size: string; qty: number; gross: number; net: number }[];
  gross: number; discount: number; subtotal: number; shipping: number; total: number;
  code: string | null; gateway: string; financial: string; cancelled: boolean; refunded: boolean;
  fulfillment: string; shippedAt: string | null; deliveredAt: string | null; tracking: string | null;
  utm: Record<string, string> | null; firstSource: string | null;
};

// Ritmo de vendas: cresce ao longo do ano, mais no fim de semana e em datas de lançamento
function dayVolume(daysAgo: number, r: () => number) {
  const growth = 0.55 + 0.45 * (1 - daysAgo / 420);
  const d = new Date(Date.now() - daysAgo * 864e5);
  const wd = d.getUTCDay();
  const week = wd === 0 || wd === 6 ? 1.15 : wd === 1 ? 1.1 : 1;
  const launch = [7, 38, 66, 98, 132, 170, 210, 255, 300, 340].some((x) => Math.abs(daysAgo - x) <= 1) ? 2.3 : 1;
  const bf = daysAgo >= 335 && daysAgo <= 342 ? 2.6 : 1; // black friday do ano passado
  return Math.max(2, Math.round((11 + r() * 7) * growth * week * launch * bf));
}

let cache: { day: string; orders: DOrder[] } | null = null;
export function ORDERS(): DOrder[] {
  const today = new Date(Date.now() + TZ_OFFSET * 3600_000).toISOString().slice(0, 10);
  if (cache && cache.day === today) return cache.orders;
  const r = rng(33);
  const out: DOrder[] = [];
  const now = Date.now();
  let n = 2400;
  const clubCodes = Array.from({ length: 40 }, (_, i) => `CLUBE${strip(CUSTOMERS[i * 7].name.split(" ")[0]).toUpperCase().slice(0, 6)}${String.fromCharCode(65 + (i % 26))}${i}`);
  for (let daysAgo = 420; daysAgo >= 0; daysAgo--) {
    const count = dayVolume(daysAgo, r);
    // fuso: o dia em Brasília começa às 03:00 UTC
    const dayStart = Date.UTC(new Date(now - daysAgo * 864e5 + TZ_OFFSET * 3600_000).getUTCFullYear(), new Date(now - daysAgo * 864e5 + TZ_OFFSET * 3600_000).getUTCMonth(), new Date(now - daysAgo * 864e5 + TZ_OFFSET * 3600_000).getUTCDate()) - TZ_OFFSET * 3600_000;
    for (let k = 0; k < count; k++) {
      const hour = wpick(r, [[8, 2], [9, 3], [10, 4], [11, 5], [12, 7], [13, 6], [14, 5], [15, 5], [16, 5], [17, 5], [18, 6], [19, 8], [20, 9], [21, 9], [22, 6], [23, 3], [0, 1], [7, 1]]);
      const at = dayStart + hour * 3600_000 + Math.floor(r() * 3600_000);
      if (at > now) continue;
      const c = CUSTOMERS[Math.floor(Math.pow(r(), 1.6) * CUSTOMERS.length)];
      const nl = wpick(r, [[1, 60], [2, 30], [3, 10]]);
      const avail = PRODUCTS.filter((p) => p.createdDaysAgo >= daysAgo);
      const lines = Array.from({ length: nl }, () => {
        const p = wpick(r, avail.map((x) => [x, x.weight] as [DProduct, number]));
        const qty = r() < 0.12 ? 2 : 1;
        return { p, size: pick(r, p.sizes), qty, gross: p.price * qty, net: p.price * qty };
      });
      const gross = lines.reduce((s, l) => s + l.gross, 0);
      const src = wpick(r, [["meta", 44], ["instagram", 18], ["google", 10], ["direto", 16], ["whatsapp", 12]] as [string, number][]);
      let code: string | null = null;
      const cr = r();
      if (cr < 0.1) code = pick(r, ATHLETES).code;
      else if (cr < 0.17) code = "COMUNIDADE10";
      else if (cr < 0.23) code = "BEMVINDO10";
      else if (cr < 0.27 && daysAgo < 120) code = pick(r, clubCodes);
      else if (cr < 0.29 && daysAgo < 90) code = "BEMVINDOIG";
      const pct = code ? (code === "MESTREJOCA" ? 0.15 : 0.1) : 0;
      const discount = Math.round(gross * pct * 100) / 100;
      for (const l of lines) l.net = Math.round(l.gross * (1 - pct) * 100) / 100;
      const subtotal = Math.round((gross - discount) * 100) / 100;
      const shipping = subtotal >= 299 ? 0 : wpick(r, [[19.9, 5], [24.9, 3], [29.9, 2]]);
      const age = (now - at) / 864e5;
      const cancelled = r() < 0.012;
      const refunded = !cancelled && age > 10 && r() < 0.018;
      const pending = !cancelled && age < 1.5 && r() < 0.12;
      const gateway = r() < 0.43 ? "Appmax - Pix" : "Appmax - Cartão de crédito";
      const shipped = !cancelled && !pending && age > 1.2;
      const shippedAt = shipped ? new Date(at + (0.8 + r()) * 864e5).toISOString() : null;
      const deliveredAt = shipped && age > 7 ? new Date(at + (5 + r() * 4) * 864e5).toISOString() : null;
      const camp = src === "meta" ? pick(r, CAMPAIGNS.filter((x) => x.kind === "vendas")) : null;
      const utm: Record<string, string> | null = src === "meta" ? { source: "meta", medium: "paid", campaign: camp!.id, term: `${camp!.id}1`, content: `${camp!.id}1${Math.floor(r() * 3) + 1}` }
        : src === "google" ? ({ source: "google", medium: "cpc", campaign: "shopping" } as Record<string, string>)
        : src === "whatsapp" ? ({ source: "whatsapp", medium: "grupo", campaign: "comunidade" } as Record<string, string>)
        : src === "instagram" ? ({ source: "instagram", medium: "bio" } as Record<string, string>) : null;
      n++;
      out.push({
        n, id: `gid://shopify/Order/${5_500_000 + n}`, name: `#${n}`, createdAt: new Date(at).toISOString(), customer: c, lines,
        gross, discount, subtotal: refunded ? 0 : subtotal, shipping, total: refunded ? 0 : subtotal + shipping, code,
        gateway, financial: cancelled ? "VOIDED" : refunded ? "REFUNDED" : pending ? "PENDING" : "PAID", cancelled, refunded,
        fulfillment: shipped ? "FULFILLED" : "UNFULFILLED", shippedAt, deliveredAt,
        tracking: shipped ? `NM${String(100000000 + n * 37).slice(0, 9)}BR` : null,
        utm, firstSource: src === "direto" ? null : src,
      });
    }
  }
  cache = { day: today, orders: out };
  return out;
}
export const CLUB_CODE_FOR = (i: number) => `CLUBE${strip(CUSTOMERS[i * 7].name.split(" ")[0]).toUpperCase().slice(0, 6)}${String.fromCharCode(65 + (i % 26))}${i}`;
