import { customers, type Customer } from "@/lib/store";
import { SEGMENTS, inSegment, type SegmentKey } from "@/lib/segments";
import { brl } from "@/lib/time";
import Link from "next/link";
import { Crown, MessageCircle, Repeat, Send, Users } from "lucide-react";
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
        <Kpi icon={<Users size={15} />} label="Clientes" value={all.length.toLocaleString("pt-BR")} />
        <Kpi icon={<Crown size={15} />} tone="s" label="Gasto médio por cliente (LTV)" value={brl(ltv, 0)} />
        <Kpi icon={<Repeat size={15} />} tone="k" label="Compraram mais de uma vez" value={`${Math.round(repeat * 100)}%`} />
        <Kpi icon={<MessageCircle size={15} />} tone="p" label="Com WhatsApp" value={all.filter((c) => c.phone).length.toLocaleString("pt-BR")} sub="podem receber disparos" />
      </div>
      <div className="segs">
        {Object.entries(SEGMENTS).map(([k, v]) => (
          <Link key={k} href={q("s", k)} className={`segc${seg === k ? " on" : ""}`} title={v.desc}>
            <span className="l">{v.label}</span>
            <b>{(counts[k] ?? 0).toLocaleString("pt-BR")}</b>
            <span className="d">{v.desc}</span>
          </Link>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(220px,1fr)", alignItems: "start" }}>
        <Panel title={`${SEGMENTS[seg].label}${uf ? ` em ${uf}` : ""}`} sub={`${list.length.toLocaleString("pt-BR")} pessoas · ${SEGMENTS[seg].desc}`} body={false}
          right={list.length ? <Link className="btn pri sm" href="/disparos"><Send size={14} /> Disparar para este grupo</Link> : undefined}>
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
                        <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                          <span className="av-s">{(c.name || "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</span>
                          <div>
                            {c.name}
                            <div className="dim" style={{ fontSize: 12 }}>{c.phone ?? c.email ?? ""}</div>
                          </div>
                          {c.orders >= 3 && <span className="chip c-s" style={{ marginLeft: 4 }}><Crown size={11} /> VIP</span>}
                        </div>
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
        <Panel title="Por estado" sub="Clique para filtrar">
          {uf && <Link className="chip c-k" href={q("uf", "")} style={{ marginBottom: 8 }}>ver todos os estados</Link>}
          {ufs.slice(0, 14).map(([k, n]) => (
            <Link key={k} href={q("uf", k)} className="lrow" style={{ color: "inherit", padding: "8px 0" }}>
              <b style={{ width: 28, color: uf === k ? "var(--sun)" : undefined }}>{k}</b>
              <div className="hbar" style={{ flex: 1 }}><i className={uf === k ? "s" : ""} style={{ width: `${(n / (ufs[0]?.[1] || 1)) * 100}%` }} /></div>
              <span className="mut end" style={{ width: 44 }}>{n}</span>
            </Link>
          ))}
        </Panel>
      </div>
      <div className="callout sun">
        Voucher de aniversário: a Shopify não guarda a data de nascimento. O formulário de leads já pede a data, e quem preencher entra na régua de aniversário quando a recuperação e o pós-venda forem ativados.
      </div>
    </>
  );
}
