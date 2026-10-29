import { ordersBetween, products, type Product } from "@/lib/store";
import { addDays, dayRange, isoDayLocal } from "@/lib/time";
import { ErrorNote, Header, Kpi, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

type Row = { product: Product; variant: string; stock: number; sold30: number; days: number | null };

export default async function Estoque({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "alertas" } = await searchParams;
  const rows: Row[] = [];
  let error: unknown = null;
  try {
    const today = isoDayLocal();
    const [list, orders] = await Promise.all([
      products(),
      ordersBetween(dayRange(addDays(today, -29)).start, dayRange(today).end),
    ]);
    const sold = new Map<string, number>();
    for (const o of orders) {
      if (o.cancelled) continue;
      for (const l of o.lines) sold.set(`${l.title}||${l.variant}`, (sold.get(`${l.title}||${l.variant}`) ?? 0) + l.quantity);
    }
    for (const p of list) {
      for (const v of p.variants) {
        const s30 = sold.get(`${p.title}||${v.title}`) ?? 0;
        const perDay = s30 / 30;
        rows.push({ product: p, variant: v.title === "Default Title" ? "único" : v.title, stock: v.stock, sold30: s30, days: perDay > 0 ? v.stock / perDay : null });
      }
    }
  } catch (e) {
    error = e;
  }
  const out = rows.filter((r) => r.stock <= 0 && r.sold30 > 0);
  const ending = rows.filter((r) => r.stock > 0 && r.days != null && r.days < 15);
  const stopped = rows.filter((r) => r.stock > 0 && r.sold30 === 0);
  const totalPieces = rows.reduce((a, r) => a + Math.max(0, r.stock), 0);
  const view = f === "todos" ? rows : f === "parados" ? stopped : [...out, ...ending];
  view.sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999) || b.sold30 - a.sold30);

  return (
    <>
      <Header title="Estoque" lede="Quanto tem de cada tamanho, quanto vendeu nos últimos 30 dias e em quantos dias acaba no ritmo atual." />
      {error ? <ErrorNote error={error} /> : null}
      <div className="grid g4">
        <Kpi label="Peças em estoque" value={totalPieces.toLocaleString("pt-BR")} />
        <Kpi label="Esgotados que vendem" value={<span className={out.length ? "dn" : ""}>{out.length}</span>} sub="tamanhos zerados com venda no mês" />
        <Kpi label="Acabam em até 15 dias" value={ending.length} />
        <Kpi label="Parados" value={stopped.length} sub="tem estoque e não vendeu em 30 dias" />
      </div>
      <div className="tabs">
        <a href="/estoque?f=alertas" className={f === "alertas" ? "on" : ""}>Alertas</a>
        <a href="/estoque?f=parados" className={f === "parados" ? "on" : ""}>Parados</a>
        <a href="/estoque?f=todos" className={f === "todos" ? "on" : ""}>Todos</a>
      </div>
      <Panel title={f === "todos" ? "Todos os tamanhos" : f === "parados" ? "Parados" : "Precisa de atenção"} body={false}>
        {view.length ? (
          <table className="tb">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Tamanho</th>
                <th className="r">Estoque</th>
                <th className="r">Vendeu (30 dias)</th>
                <th className="r">Acaba em</th>
              </tr>
            </thead>
            <tbody>
              {view.slice(0, 300).map((r, i) => (
                <tr key={r.product.id + r.variant + i}>
                  <td>{r.product.title}</td>
                  <td className="mut">{r.variant}</td>
                  <td className="r">{r.stock <= 0 ? <span className="chip c-c">esgotado</span> : r.stock}</td>
                  <td className="r">{r.sold30}</td>
                  <td className="r">
                    {r.stock <= 0 ? "–" : r.days == null ? <span className="dim">sem venda</span> : (
                      <span className={r.days < 7 ? "dn" : r.days < 15 ? "c-s" : ""}>{Math.round(r.days)} dias</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !error && <div className="empty">Nada por aqui.</div>
        )}
      </Panel>
    </>
  );
}
