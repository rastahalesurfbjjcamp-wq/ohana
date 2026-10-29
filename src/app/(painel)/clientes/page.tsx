import { customers, type Customer } from "@/lib/store";
import { SEGMENTS, inSegment, type SegmentKey } from "@/lib/segments";
import { brl } from "@/lib/time";
import { ErrorNote, Header, Kpi, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Clientes({ searchParams }: { searchParams: Promise<{ s?: string; uf?: string }> }) {
  const { s = "todos", uf = "" } = await searchParams;
  const seg = (s in SEGMENTS ? s : "todos") as SegmentKey;
  let all: Customer[] = [];
  let error: unknown = null;
  try {
    all = await customers();
  } catch (e) {
    error = e;
  }
  const counts = Object.fromEntries(Object.keys(SEGMENTS).map((k) => [k, all.filter((c) => inSegment(c, k as SegmentKey)).length]));
  const list = all.filter((c) => inSegment(c, seg) && (!uf || c.state === uf)).sort((a, b) => b.spent - a.spent);
  const ltv = all.length ? all.reduce((a, c) => a + c.spent, 0) / all.length : 0;
  const repeat = all.length ? all.filter((c) => c.orders >= 2).length / all.length : 0;
  const byUf = new Map<string, number>();
  for (const c of all) if (c.state) byUf.set(c.state, (byUf.get(c.state) ?? 0) + 1);
  const ufs = [...byUf.entries()].sort((a, b) => b[1] - a[1]);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });
  const q = (k: string, v: string) => `/clientes?s=${k === "s" ? v : seg}${(k === "uf" ? v : uf) ? `&uf=${k === "uf" ? v : uf}` : ""}`;

  return (
    <>
      <Header title="Clientes" lede="Todo mundo que já comprou, separado em grupos para campanhas e disparos. Os grupos atualizam sozinhos com as compras da Shopify." />
      {error ? <ErrorNote error={error} /> : null}
      <div className="grid g4">
        <Kpi label="Clientes" value={all.length.toLocaleString("pt-BR")} />
        <Kpi label="Gasto médio por cliente (LTV)" value={brl(ltv, 0)} />
        <Kpi label="Compraram mais de uma vez" value={`${Math.round(repeat * 100)}%`} />
        <Kpi label="Com WhatsApp" value={all.filter((c) => c.phone).length.toLocaleString("pt-BR")} sub="podem receber disparos" />
      </div>
      <div className="tabs">
        {Object.entries(SEGMENTS).map(([k, v]) => (
          <a key={k} href={q("s", k)} className={seg === k ? "on" : ""} title={v.desc}>
            {v.label} <span className="dim">{counts[k] ?? 0}</span>
          </a>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(220px,1fr)", alignItems: "start" }}>
        <Panel title={`${SEGMENTS[seg].label}${uf ? ` em ${uf}` : ""}`} sub={SEGMENTS[seg].desc} body={false}>
          {list.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="tb">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Cidade</th>
                    <th className="r">Pedidos</th>
                    <th className="r">Gastou</th>
                    <th className="r">Última compra</th>
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, 200).map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        <div className="dim" style={{ fontSize: 12 }}>{c.phone ?? c.email ?? ""}</div>
                      </td>
                      <td className="mut">{[c.city, c.state].filter(Boolean).join(" / ")}</td>
                      <td className="r">{c.orders}</td>
                      <td className="r"><b>{brl(c.spent, 0)}</b></td>
                      <td className="r mut">{c.lastOrderAt ? fmt.format(new Date(c.lastOrderAt)) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {list.length > 200 && <div className="empty">Mostrando 200 de {list.length.toLocaleString("pt-BR")}.</div>}
            </div>
          ) : (
            !error && <div className="empty">Ninguém neste grupo.</div>
          )}
        </Panel>
        <Panel title="Por estado" body={false}>
          <table className="tb">
            <tbody>
              {uf && (
                <tr><td colSpan={2}><a className="chip c-k" href={q("uf", "")}>ver todos os estados</a></td></tr>
              )}
              {ufs.slice(0, 27).map(([k, n]) => (
                <tr key={k}>
                  <td><a href={q("uf", k)} style={uf === k ? { color: "var(--lagoon)", fontWeight: 600 } : undefined}>{k}</a></td>
                  <td className="r mut">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <div className="note">
        Voucher de aniversário: a Shopify não guarda a data de nascimento. O formulário de leads já pede a data, e quem preencher entra na régua de aniversário quando a recuperação e o pós-venda forem ativados.
      </div>
    </>
  );
}
