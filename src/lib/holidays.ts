// Feriados nacionais, estaduais e municipais (Rio) e datas comerciais.
export type HolidayKind = "nacional" | "estadual" | "municipal" | "comercial";
export interface Holiday {
  date: string; // AAAA-MM-DD
  name: string;
  kind: HolidayKind;
  uf?: string;
  tip?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
const shift = (d: Date, days: number) => new Date(d.getTime() + days * 864e5).toISOString().slice(0, 10);

// n-ésimo dia da semana do mês (dow 0 = domingo)
function nthWeekday(y: number, m: number, dow: number, n: number) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const day = 1 + ((dow - first + 7) % 7) + (n - 1) * 7;
  return iso(y, m, day);
}

const STATE: [string, number, number, string][] = [
  ["AC", 6, 15, "Aniversário do Acre"],
  ["AL", 9, 16, "Emancipação de Alagoas"],
  ["AM", 9, 5, "Elevação do Amazonas a província"],
  ["AP", 9, 13, "Criação do Território do Amapá"],
  ["BA", 7, 2, "Independência da Bahia"],
  ["CE", 3, 25, "Data Magna do Ceará"],
  ["DF", 11, 30, "Dia do Evangélico"],
  ["MA", 7, 28, "Adesão do Maranhão à Independência"],
  ["MS", 10, 11, "Criação de Mato Grosso do Sul"],
  ["PA", 8, 15, "Adesão do Pará à Independência"],
  ["PB", 8, 5, "Fundação da Paraíba"],
  ["PE", 3, 6, "Revolução Pernambucana"],
  ["PI", 10, 19, "Dia do Piauí"],
  ["PR", 12, 19, "Emancipação do Paraná"],
  ["RJ", 4, 23, "Dia de São Jorge"],
  ["RN", 10, 3, "Mártires de Cunhaú e Uruaçu"],
  ["RO", 1, 4, "Criação de Rondônia"],
  ["RR", 10, 5, "Criação de Roraima"],
  ["RS", 9, 20, "Revolução Farroupilha"],
  ["SE", 7, 8, "Emancipação de Sergipe"],
  ["SP", 7, 9, "Revolução Constitucionalista"],
  ["TO", 10, 5, "Criação do Tocantins"],
];

export function holidaysForYear(y: number): Holiday[] {
  const e = easter(y);
  const out: Holiday[] = [
    { date: iso(y, 1, 1), name: "Confraternização Universal", kind: "nacional" },
    { date: shift(e, -48), name: "Carnaval (segunda)", kind: "nacional", tip: "Viagem e praia: bom para surf e acessórios" },
    { date: shift(e, -47), name: "Carnaval (terça)", kind: "nacional" },
    { date: shift(e, -2), name: "Sexta-feira Santa", kind: "nacional" },
    { date: iso(y, 4, 21), name: "Tiradentes", kind: "nacional" },
    { date: iso(y, 5, 1), name: "Dia do Trabalho", kind: "nacional" },
    { date: shift(e, 60), name: "Corpus Christi", kind: "nacional", tip: "Feriado prolongado: campanha de viagem" },
    { date: iso(y, 9, 7), name: "Independência", kind: "nacional" },
    { date: iso(y, 10, 12), name: "Nossa Senhora Aparecida", kind: "nacional" },
    { date: iso(y, 11, 2), name: "Finados", kind: "nacional" },
    { date: iso(y, 11, 15), name: "Proclamação da República", kind: "nacional" },
    { date: iso(y, 11, 20), name: "Consciência Negra", kind: "nacional" },
    { date: iso(y, 12, 25), name: "Natal", kind: "nacional" },
    { date: iso(y, 1, 20), name: "São Sebastião (cidade do Rio)", kind: "municipal", uf: "RJ" },
    // Datas comerciais
    { date: iso(y, 3, 15), name: "Dia do Consumidor", kind: "comercial", tip: "Cupom curto de 24h para a comunidade" },
    { date: nthWeekday(y, 5, 0, 2), name: "Dia das Mães", kind: "comercial", tip: "Kits e vale-presente" },
    { date: iso(y, 6, 12), name: "Dia dos Namorados", kind: "comercial", tip: "Kit casal de rashguards" },
    { date: nthWeekday(y, 8, 0, 2), name: "Dia dos Pais", kind: "comercial", tip: "Kimono e kits de treino" },
    { date: iso(y, 9, 15), name: "Dia do Cliente", kind: "comercial", tip: "Mimo para os clientes VIP" },
    { date: iso(y, 10, 12), name: "Dia das Crianças", kind: "comercial", tip: "Kimonos e rashguards infantis" },
    { date: nthWeekday(y, 11, 5, 4), name: "Black Friday", kind: "comercial", tip: "Aquecer a comunidade 2 semanas antes" },
    { date: shift(new Date(nthWeekday(y, 11, 5, 4) + "T00:00:00Z"), 3), name: "Cyber Monday", kind: "comercial" },
    { date: iso(y, 12, 10), name: "Último dia seguro para entrega de Natal", kind: "comercial", tip: "Avisar prazo de frete" },
  ];
  for (const [uf, m, d, name] of STATE) out.push({ date: iso(y, m, d), name, kind: "estadual", uf });
  return out;
}

export function upcomingHolidays(fromIso: string, days = 365): Holiday[] {
  const y = Number(fromIso.slice(0, 4));
  const end = shift(new Date(fromIso + "T00:00:00Z"), days);
  return [...holidaysForYear(y), ...holidaysForYear(y + 1)]
    .filter((h) => h.date >= fromIso && h.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Estado pelo CEP (faixas dos Correios)
const CEP: [number, number, string][] = [
  [1000, 19999, "SP"], [20000, 28999, "RJ"], [29000, 29999, "ES"], [30000, 39999, "MG"], [40000, 48999, "BA"],
  [49000, 49999, "SE"], [50000, 56999, "PE"], [57000, 57999, "AL"], [58000, 58999, "PB"], [59000, 59999, "RN"],
  [60000, 63999, "CE"], [64000, 64999, "PI"], [65000, 65999, "MA"], [66000, 68899, "PA"], [68900, 68999, "AP"],
  [69000, 69299, "AM"], [69300, 69399, "RR"], [69400, 69899, "AM"], [69900, 69999, "AC"], [70000, 73699, "DF"],
  [73700, 76799, "GO"], [76800, 76999, "RO"], [77000, 77999, "TO"], [78000, 78899, "MT"], [79000, 79999, "MS"],
  [80000, 87999, "PR"], [88000, 89999, "SC"], [90000, 99999, "RS"],
];
export function ufFromCep(cep: string | null | undefined): string | null {
  const d = (cep ?? "").replace(/\D/g, "");
  if (d.length < 5) return null;
  const n = Number(d.slice(0, 5));
  return CEP.find(([a, b]) => n >= a && n <= b)?.[2] ?? null;
}
