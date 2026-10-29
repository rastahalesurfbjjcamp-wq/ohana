import Link from "next/link";
import { revalidatePath } from "next/cache";
import { BellRing, Coins, Hourglass, PackageX, Send, Tag } from "lucide-react";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/queue";
import { costResolver } from "@/lib/report";
import { ordersBetween, products, type Product } from "@/lib/store";
import { addDays, brl, dayRange, isoDayLocal } from "@/lib/time";
import { ErrorNote, Header, Kpi, Panel } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XGG", "EG", "EGG", "G1", "G2", "G3", "A0", "A1", "A2", "A3", "A4", "M0", "M1", "M2", "M3", "M4", "28", "30", "32", "34", "36", "38", "40", "42", "44", "46"];
const isSize = (t: string) => SIZE_ORDER.includes(t.toUpperCase());

type Cell = { size: string; stock: number; sold30: number; waiting: number; price: number; cost: number | null };
type Row = { key: string; product: Product; label: string; cells: Cell[]; sold30: number; stock: number; days: number | null };

async function notifyWaiting() {
  "use server";
  const list = await products();
  const inStock = new Set<string>();
  for (const p of list) {
    for (const v of p.variants) {
      if (v.stock <= 0) continue;
      inStock.add(`${p.title}||${v.title}`.toUpperCase());
      inStock.add(`${p.title}||`.toUpperCase());
      for (const part of v.title.split(" / ")) inStock.add(`${p.title}||${part}`.toUpperCase());
    }
  }
  const waiting = await db.waitlist.findMany({ where: { notifiedAt: null } });
  const ids = waiting.filter((w) => inStock.has(`${w.product}||${w.variant}`.toUpperCase())).map((w) => w.id);
  if (ids.length) await enqueue("waitlist-notify", { ids });
  revalidatePath("/estoque");
}

export default async function Estoque({ searchParams }: { searchParams: Promise<{ f?: string; t?: string }> }) {
  const { f = "alertas", t = "top" } = await searchParams;
  const rows: Row[] = [];
  let error: unknown = null;
  let costValue = 0, saleValue = 0, pieces = 0, missingCost = 0;
  const waitRows = await db.waitlist.findMany({ where: { notifiedAt: null } }).catch(() => []);
  const waitBy = (title: string, variant: string, size: string) =>
    waitRows.filter((w) => w.product === title && (w.variant === variant || w.variant.toUpperCase() === size.toUpperCase())).length;
  try {
    const today = isoDayLocal();
    const [list, orders, resolve] = await Promise.all([products(), ordersBetween(dayRange(addDays(today, -29)).start, dayRange(today).end), costResolver()]);
    const sold = new Map<string, number>();
    for (const o of orders) {
      if (o.cancelled) continue;
      for (const l of o.lines) sold.set(`${l.title}||${l.variant}`, (sold.get(`${l.title}||${l.variant}`) ?? 0) + l.quantity);
    }
    for (const p of list) {
      if (/gift ?card|vale.?presente|cart[aã]o.?presente/i.test(p.title)) continue;
      const groups = new Map<string, Cell[]>();
      for (const v of p.variants) {
        const parts = v.title === "Default Title" ? ["Único"] : v.title.split(" / ");
        const sizeIdx = parts.findIndex(isSize);
        const size = sizeIdx >= 0 ? parts[sizeIdx] : parts[parts.length - 1];
        const rest = parts.filter((_, i) => i !== (sizeIdx >= 0 ? sizeIdx : parts.length - 1)).join(" / ");
        const cost = resolve(p.title, v.unitCost);
        const stock = Math.max(0, v.stock);
        pieces += stock;
        saleValue += stock * v.price;
        if (cost != null) costValue += stock * cost;
        else if (stock > 0) missingCost += stock;
        const cell: Cell = { size, stock: v.stock, sold30: sold.get(`${p.title}||${v.title}`) ?? 0, waiting: waitBy(p.title, v.title, size), price: v.price, cost };
        groups.set(rest, [...(groups.get(rest) ?? []), cell]);
      }
      for (const [rest, cells] of groups) {
        const s30 = cells.reduce((a, c) => a + c.sold30, 0);
        const st = cells.reduce((a, c) => a + Math.max(0, c.stock), 0);
        rows.push({ key: p.id + rest, product: p, label: rest, cells, sold30: s30, stock: st, days: s30 > 0 ? st / (s30 / 30) : null });
      }
    }
  } catch (e) {
    error = e;
  }

  const allCells = rows.flatMap((r) => r.cells.map((c) => ({ r, c })));
  const zeroSelling = allCells.filter(({ c }) => c.stock <= 0 && c.sold30 > 0);
  const ending = rows.filter((r) => r.stock > 0 && r.days != null && r.days < 7);
  const lost = zeroSelling.reduce((a, { c }) => a + (c.sold30 / 30) * 7 * c.price, 0);
  const waitingTotal = waitRows.length;

  const grid = (t === "todos" ? rows : rows.filter((r) => r.sold30 > 0)).sort((a, b) => b.sold30 - a.sold30).slice(0, t === "todos" ? 400 : 14);
  const sizes = [...new Set(grid.flatMap((r) => r.cells.map((c) => c.size)))].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase()), ib = SIZE_ORDER.indexOf(b.toUpperCase());
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
  }).slice(0, 8);

  // Sugestão de reposição: 45 dias de venda para o que zerou ou acaba em até 15 dias
  const suggestion = rows
    .map((r) => {
      const need = r.cells.filter((c) => c.sold30 > 0 && (c.stock <= 0 || c.stock / (c.sold30 / 30) < 15) || c.waiting > 0);
      const qty = need.reduce((a, c) => a + Math.max(5, Math.ceil(((c.sold30 * 1.5) + c.waiting - Math.max(0, c.stock)) / 5) * 5), 0);
      return { r, sizes: need.map((c) => c.size), qty };
    })
    .filter((x) => x.qty > 0)
    .sort((a, b) => b.r.sold30 - a.r.sold30)
    .slice(0, 8);
  const orderText = `Pedido de reposição ${isoDayLocal().split("-").reverse().join("/")}\n\n` + suggestion.map((x) => `${x.r.product.title}${x.r.label ? ` (${x.r.label})` : ""}: ${x.qty} peças, tamanhos ${x.sizes.join(", ")}`).join("\n");

  const detail = f === "parados" ? allCells.filter(({ c }) => c.stock > 0 && c.sold30 === 0) : f === "todos" ? allCells : allCells.filter(({ c, r }) => (c.stock <= 0 && c.sold30 > 0) || (c.stock > 0 && c.sold30 > 0 && c.stock / (c.sold30 / 30) < 15) || (r.days != null && r.days < 7 && c.stock <= 2));

  return (
    <>
      <Header title="Estoque" lede="Quanto tem de cada tamanho, quanto vale o estoque, quando vai acabar e quem está esperando a reposição.">
        <form action={notifyWaiting}>
          <ConfirmButton className="btn pri" disabled={!waitingTotal} message={`Mandar WhatsApp para quem está esperando um tamanho que já voltou? (${waitingTotal} na lista)`}>
            <BellRing size={16} /> Avisar quem está esperando
          </ConfirmButton>
        </form>
      </Header>
      {error ? <ErrorNote error={error} /> : null}
      <div className="grid g4">
        <Kpi icon={<Coins size={15} />} label="Valor em estoque (custo)" value={brl(costValue, 0)} sub={missingCost ? `${missingCost} peças sem custo ficaram de fora` : `${pieces.toLocaleString("pt-BR")} peças`} />
        <Kpi icon={<Tag size={15} />} tone="k" label="Valor em estoque (venda)" value={brl(saleValue, 0)} sub={costValue ? `margem bruta de ${brl(saleValue - costValue, 0)}` : `${pieces.toLocaleString("pt-BR")} peças`} />
        <Kpi icon={<PackageX size={15} />} tone="c" label="Tamanhos zerados que vendem" value={<span className={zeroSelling.length ? "dn" : ""}>{zeroSelling.length}</span>} sub={zeroSelling.length ? `uns ${brl(lost, 0)} por semana sem vender` : "nenhum"} />
        <Kpi icon={<Hourglass size={15} />} tone="s" label="Acaba em menos de 7 dias" value={<span style={ending.length ? { color: "var(--sun)" } : undefined}>{ending.length}</span>} sub={waitingTotal ? `${waitingTotal} pessoas esperando reposição` : "no ritmo atual de venda"} />
      </div>

      <div className="cols c-3-1">
        <Panel title="Grade por tamanho" sub={waitingTotal ? "Estoque real da Shopify. Em vermelho, os zerados, com quantas pessoas esperam cada um." : "Estoque real da Shopify. Em vermelho os zerados, em amarelo os que estão acabando."} body={false}
          right={<div className="seg"><Link href={`/estoque?f=${f}`} className={t !== "todos" ? "on" : ""}>Mais vendidos</Link><Link href={`/estoque?f=${f}&t=todos`} className={t === "todos" ? "on" : ""}>Todos</Link></div>}>
          <div style={{ overflowX: "auto", padding: "0 10px 14px" }}>
            <table className="sgrid">
              <thead>
                <tr><th style={{ textAlign: "left" }}>Produto</th>{sizes.map((s) => <th key={s}>{s}</th>)}<th style={{ textAlign: "left" }}>Acaba em</th></tr>
              </thead>
              <tbody>
                {grid.map((r) => {
                  const zeroSizes = r.cells.filter((c) => c.stock <= 0 && c.sold30 > 0).map((c) => c.size);
                  return (
                    <tr key={r.key}>
                      <td>
                        <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {r.product.image ? <img className="thumb" src={r.product.image} alt="" /> : <div className="thumb" />}
                          <div style={{ minWidth: 0 }}>
                            <b style={{ fontWeight: 600, fontSize: 13.5 }}>{r.product.title}</b>
                            {r.label && <div className="dim" style={{ fontSize: 12 }}>{r.label}</div>}
                          </div>
                        </div>
                      </td>
                      {sizes.map((s) => {
                        const c = r.cells.find((x) => x.size === s);
                        if (!c) return <td key={s}><span className="sz na">–</span></td>;
                        const tone = c.stock <= 0 ? "z" : c.stock <= 2 || (c.sold30 > 0 && c.stock / (c.sold30 / 30) < 15) ? "w" : "ok";
                        return (
                          <td key={s}>
                            <span className={`sz ${tone}`} title={`${c.sold30} vendidos em 30 dias`}>
                              <b>{Math.max(0, c.stock)}</b>
                              {c.waiting > 0 ? <small>{c.waiting} esperando</small> : c.stock <= 0 && c.sold30 > 0 ? <small>{c.sold30} vend./mês</small> : null}
                            </span>
                          </td>
                        );
                      })}
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                        {zeroSizes.length >= 2 ? <span className="dn">{zeroSizes.slice(0, 3).join(", ")} zerados</span> : r.days == null ? <span className="dim">sem venda</span> : (
                          <span className={r.days < 7 ? "dn" : ""} style={r.days >= 7 && r.days < 15 ? { color: "var(--sun)" } : r.days >= 15 ? { color: "var(--ink2)" } : undefined}>{Math.round(r.days)} dias</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!grid.length && !error && <div className="empty">Nada vendido nos últimos 30 dias.</div>}
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Sugestão de reposição" sub="Pelo ritmo de venda dos últimos 30 dias e pela lista de espera">
            {suggestion.length ? (
              <>
                {suggestion.map((x) => (
                  <div className="lrow" key={x.r.key}>
                    <div style={{ minWidth: 0 }}>
                      <div className="t" style={{ fontSize: 13.5 }}>{x.r.product.title}</div>
                      <div className="s">{x.r.label ? `${x.r.label} · ` : ""}{x.sizes.join(", ")}</div>
                    </div>
                    <b className="end">{x.qty} peças</b>
                  </div>
                ))}
                <a className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} href={`https://wa.me/?text=${encodeURIComponent(orderText)}`} target="_blank" rel="noreferrer">
                  <Send size={15} /> Mandar pedido no WhatsApp
                </a>
              </>
            ) : <div className="empty">Nada para repor agora.</div>}
          </Panel>
          <div className="callout sun">
            <BellRing size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>Quando o tamanho voltar, clique em <b>Avisar quem está esperando</b> e cada pessoa da lista recebe o link no WhatsApp. A lista vem do botão &quot;Avise-me&quot; da loja (endereço <code>/api/avise</code>).</div>
          </div>
        </div>
      </div>

      <div><div className="seg">
        <Link href={`/estoque?f=alertas&t=${t}`} className={f === "alertas" ? "on" : ""}>Precisa de atenção</Link>
        <Link href={`/estoque?f=parados&t=${t}`} className={f === "parados" ? "on" : ""}>Parados</Link>
        <Link href={`/estoque?f=todos&t=${t}`} className={f === "todos" ? "on" : ""}>Todos os tamanhos</Link>
      </div></div>
      <Panel title={f === "todos" ? "Todos os tamanhos" : f === "parados" ? "Parados há 30 dias" : "Precisa de atenção"} sub={`${detail.length} tamanho(s)`} body={false}>
        {detail.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="tb">
              <thead>
                <tr><th>Produto</th><th>Tamanho</th><th className="r">Estoque</th><th className="r">Vendeu (30 dias)</th><th className="r">Valor parado (custo)</th><th className="r">Valor (venda)</th><th className="r">Acaba em</th></tr>
              </thead>
              <tbody>
                {detail.slice(0, 300).map(({ r, c }, i) => {
                  const days = c.sold30 > 0 ? Math.max(0, c.stock) / (c.sold30 / 30) : null;
                  return (
                    <tr key={r.key + c.size + i}>
                      <td>
                        <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {r.product.image ? <img className="thumb" src={r.product.image} alt="" /> : <div className="thumb" />}
                          <span>{r.product.title}{r.label ? <span className="dim"> · {r.label}</span> : null}</span>
                        </div>
                      </td>
                      <td><span className="chip c-n">{c.size}</span></td>
                      <td className="r">{c.stock <= 0 ? <span className="chip c-c">zerado</span> : c.stock}</td>
                      <td className="r">{c.sold30}</td>
                      <td className="r mut">{c.cost != null ? brl(Math.max(0, c.stock) * c.cost, 0) : "sem custo"}</td>
                      <td className="r">{brl(Math.max(0, c.stock) * c.price, 0)}</td>
                      <td className="r">
                        {c.stock <= 0 ? "–" : days == null ? <span className="dim">sem venda</span> : (
                          <div style={{ minWidth: 110, marginLeft: "auto" }}>
                            <b className={days < 7 ? "dn" : ""} style={days >= 7 && days < 15 ? { color: "var(--sun)" } : undefined}>{Math.round(days)} dias</b>
                            <div className="hbar" style={{ marginTop: 6, height: 5 }}><i className={days < 7 ? "c" : days < 15 ? "s" : ""} style={{ width: `${Math.min(100, (days / 60) * 100)}%` }} /></div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !error && <div className="empty">Nada por aqui.</div>
        )}
      </Panel>
    </>
  );
}
