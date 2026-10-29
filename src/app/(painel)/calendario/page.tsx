import { customers } from "@/lib/store";
import { upcomingHolidays, ufFromCep, type Holiday } from "@/lib/holidays";
import { isoDayLocal, weekdayName } from "@/lib/time";
import { Header, Kpi, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const KIND = { nacional: ["nacional", "c-k"], estadual: ["estadual", "c-s"], municipal: ["municipal", "c-n"], comercial: ["data comercial", "c-l"] } as const;

export default async function Calendario({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k = "todos" } = await searchParams;
  const today = isoDayLocal();
  const byUf = new Map<string, number>();
  let hasCustomers = false;
  try {
    for (const c of await customers()) {
      const uf = c.state ?? ufFromCep(c.zip);
      if (uf) byUf.set(uf, (byUf.get(uf) ?? 0) + 1);
    }
    hasCustomers = true;
  } catch {
    hasCustomers = false;
  }
  let list: Holiday[] = upcomingHolidays(today, 365);
  // Estaduais só aparecem se houver clientes naquele estado
  if (hasCustomers) list = list.filter((h) => h.kind !== "estadual" || (h.uf && (byUf.get(h.uf) ?? 0) > 0));
  if (k !== "todos") list = list.filter((h) => h.kind === k);
  const next = list.find((h) => h.kind === "comercial");
  const daysTo = (d: string) => Math.round((Date.parse(d) - Date.parse(today)) / 864e5);

  return (
    <>
      <Header title="Calendário de vendas" lede="Feriados nacionais, estaduais (pelo estado dos seus clientes, vindo do CEP) e datas boas para campanha nos próximos 12 meses." />
      <div className="grid g4">
        <Kpi label="Próxima data comercial" value={next ? next.name : "–"} sub={next ? `em ${daysTo(next.date)} dias` : undefined} />
        <Kpi label="Feriados nos próximos 30 dias" value={upcomingHolidays(today, 30).filter((h) => h.kind !== "comercial").length} />
        <Kpi label="Estados com clientes" value={hasCustomers ? byUf.size : "–"} sub={hasCustomers ? undefined : "conecte a Shopify"} />
        <Kpi label="Estado com mais clientes" value={hasCustomers ? [...byUf.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "–" : "–"} />
      </div>
      <div className="tabs">
        {[["todos", "Tudo"], ["comercial", "Datas comerciais"], ["nacional", "Nacionais"], ["estadual", "Estaduais"], ["municipal", "Municipais"]].map(([key, label]) => (
          <a key={key} href={`/calendario?k=${key}`} className={k === key ? "on" : ""}>{label}</a>
        ))}
      </div>
      <Panel title="Próximos 12 meses" body={false}>
        <table className="tb">
          <tbody>
            {list.map((h) => (
              <tr key={h.date + h.name}>
                <td style={{ width: 130 }}>
                  <b style={{ fontWeight: 550 }}>{h.date.slice(8)}/{h.date.slice(5, 7)}/{h.date.slice(2, 4)}</b>
                  <div className="dim" style={{ fontSize: 12 }}>{weekdayName(h.date)}, em {daysTo(h.date)} dias</div>
                </td>
                <td>
                  {h.name}
                  {h.tip && <div className="dim" style={{ fontSize: 12 }}>{h.tip}</div>}
                </td>
                <td>
                  <span className={`chip ${KIND[h.kind][1]}`}>{KIND[h.kind][0]}{h.uf ? ` ${h.uf}` : ""}</span>
                </td>
                <td className="r mut" style={{ width: 160 }}>
                  {h.uf && byUf.get(h.uf) ? `${byUf.get(h.uf)} clientes em ${h.uf}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
