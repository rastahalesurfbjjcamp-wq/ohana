import type { ReactNode } from "react";

export function Header({ title, lede, children }: { title: string; lede?: string; children?: ReactNode }) {
  return (
    <div className="hd">
      <div>
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {children && <div className="acts">{children}</div>}
    </div>
  );
}

export function Kpi({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="pnl kpi">
      <small>
        {icon}
        {label}
      </small>
      <span className="num">{value}</span>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Panel({ title, sub, right, children, body = true }: { title: string; sub?: string; right?: ReactNode; children: ReactNode; body?: boolean }) {
  return (
    <section className="pnl">
      <div className="ph">
        <div>
          <h3>{title}</h3>
          {sub && <small>{sub}</small>}
        </div>
        {right}
      </div>
      {body ? <div className="pb">{children}</div> : <div style={{ marginTop: 12 }}>{children}</div>}
    </section>
  );
}

export function Bar({ value, max }: { value: number; max: number }) {
  const p = Math.min(100, max ? (value / max) * 100 : 0);
  return (
    <div className="bar">
      <i className={p >= 95 ? "full" : p >= 80 ? "warn" : ""} style={{ width: `${p}%` }} />
    </div>
  );
}

export function PeriodTabs({ base, current, keys, extra = "" }: { base: string; current: string; keys?: string[]; extra?: string }) {
  const all = [
    ["hoje", "Hoje"], ["ontem", "Ontem"], ["7d", "7 dias"], ["30d", "30 dias"], ["mes", "Este mês"], ["mes-passado", "Mês passado"], ["90d", "90 dias"],
  ];
  const list = keys ? all.filter(([k]) => keys.includes(k)) : all;
  return (
    <div className="tabs">
      {list.map(([k, l]) => (
        <a key={k} href={`${base}?p=${k}${extra}`} className={current === k ? "on" : ""}>{l}</a>
      ))}
    </div>
  );
}

export function BarChart({ data, format, tone }: { data: { label: string; value: number }[]; format?: (v: number) => string; tone?: "alt" }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const every = Math.ceil(data.length / 12);
  return (
    <div className="chart">
      {data.map((d, i) => (
        <div className="col" key={d.label + i} title={`${d.label}: ${format ? format(d.value) : d.value}`}>
          <div className={`b${tone ? " " + tone : ""}${d.value < 0 ? " neg" : ""}`} style={{ height: `${(Math.abs(d.value) / max) * 100}%` }} />
          <small>{i % every === 0 ? d.label : " "}</small>
        </div>
      ))}
    </div>
  );
}

export function NeedShopify() {
  return (
    <div className="note">
      Para esta tela mostrar os dados da loja, falta colar a chave da Shopify (SHOPIFY_ADMIN_TOKEN) nas variáveis do Easypanel, no serviço hub. Depois clique em Implantar.
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = String(error).replace(/^Error: /, "");
  if (msg.includes("SHOPIFY_NAO_CONFIGURADA")) return <NeedShopify />;
  return <div className="err">Não consegui carregar os dados agora: {msg.slice(0, 240)}</div>;
}
