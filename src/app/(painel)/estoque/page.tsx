import { ordersBetween, products, type Product } from "@/lib/store";
import { addDays, dayRange, isoDayLocal } from "@/lib/time";
import Link from "next/link";
import { AlertTriangle, Hourglass, PackageX, Warehouse } from "lucide-react";
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
        <Kpi icon={<Warehouse size={15} />} label="Peças em estoque" value={totalPieces.toLocaleString("pt-BR")} />
        <Kpi icon={<PackageX size={15} />} tone="c" label="Esgotados que vendem" value={<span className={out.length ? "dn" : ""}>{out.length}</span>} sub="tamanhos zerados com venda no mês" />
        <Kpi icon={<Hourglass size={15} />} tone="s" label="Acabam em até 15 dias" value={ending.length} />
        <Kpi icon={<AlertTriangle size={15} />} tone="n" label="Parados" value={stopped.length} sub="tem estoque e não vendeu em 30 dias" />
      </div>
      {out.length > 0 && (
        <div className="callout coral">
          <PackageX size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>{out.length} tamanho(s) zerados que venderam no mês. Cada dia sem repor é venda perdida: {out.slice(0, 3).map((r) => `${r.product.title} (${r.variant})`).join(", ")}{out.length > 3 ? "…" : ""}</div>
        </div>
      )}
      <div><div className="seg">
        <Link href="/estoque?f=alertas" className={f === "alertas" ? "on" : ""}>Alertas ({out.length + ending.length})</Link>
        <Link href="/estoque?f=parados" className={f === "parados" ? "on" : ""}>Parados ({stopped.length})</Link>
        <Link href="/estoque?f=todos" className={f === "todos" ? "on" : ""}>Todos ({rows.length})</Link>
      </div></div>
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
                  <td>
                    <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.product.image ? <img className="thumb" src={r.product.image} alt="" /> : <div className="thumb" />}
                      <span>{r.product.title}</span>
                    </div>
                  </td>
                  <td className="mut">{r.variant}</td>
                  <td className="r">{r.stock <= 0 ? <span className="chip c-c">esgotado</span> : r.stock}</td>
                  <td className="r">{r.sold30}</td>
                  <td className="r">
                    {r.stock <= 0 ? "–" : r.days == null ? <span className="dim">sem venda</span> : (
                      <div style={{ minWidth: 120 }}>
                        <b className={r.days < 7 ? "dn" : ""} style={r.days >= 7 && r.days < 15 ? { color: "var(--sun)" } : undefined}>{Math.round(r.days)} dias</b>
                        <div className="hbar" style={{ marginTop: 6, height: 5 }}><i className={r.days < 7 ? "c" : r.days < 15 ? "s" : ""} style={{ width: `${Math.min(100, (r.days / 60) * 100)}%` }} /></div>
                      </div>
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
