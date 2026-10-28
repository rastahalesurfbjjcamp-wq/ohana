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
