import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

/* Blocos do visual novo do Hub (card de números, card com abas, filtros e painel branco com lista e detalhe) */

const TONES = ["#f6c7a8", "#b9d7f7", "#d9c6f5", "#f5e6a3", "#c7efd2", "#f6b8b8"];
export function initials(name: string) {
  const p = (name || "?").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1][0] : p[0]?.[1] ?? "")).toUpperCase();
}
function tone(name: string) {
  let h = 0;
  for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
export function NxAv({ name, size }: { name: string; size?: number }) {
  return <span className="nx-av" style={{ background: tone(name), ...(size ? { width: size, height: size } : {}) }}>{initials(name)}</span>;
}

export function NxHead({ title, back, children }: { title: ReactNode; back?: string; children?: ReactNode }) {
  return (
    <div className="nx-hd">
      {back && <Link href={back} className="nx-ic" aria-label="Voltar"><ArrowLeft size={17} /></Link>}
      <h1>{title}</h1>
      <div className="nx-sp" />
      {children}
    </div>
  );
}

export function NxStat({ label, value, pre, sub, tone: t }: { label: string; value: ReactNode; pre?: string; sub?: ReactNode; tone?: "up" | "dn" | "mut" }) {
  return (
    <div className="nx-stat">
      <div className="nx-lab">{label}</div>
      <div className="nx-big">{pre && <small>{pre}</small>}{value}</div>
      {sub != null && <div className={`nx-sub ${t ?? "mut"}`}>{sub}</div>}
    </div>
  );
}

export function NxHero({ stats, children, href }: { stats: ReactNode; children?: ReactNode; href?: string }) {
  const inner = (<><div className="nx-stats">{stats}</div>{children}</>);
  return href ? <Link href={href} className="nx-card nx-hero">{inner}</Link> : <section className="nx-card nx-hero">{inner}</section>;
}

/* barras listradas: entradas em verde-limão, saídas em vermelho */
export function NxBars({ items, ticks = 5, fmt }: { items: { label: string; value: number; neg?: boolean }[]; ticks?: number; fmt?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const step = Math.max(1, Math.ceil(items.length / ticks));
  return (
    <div className="nx-barsw">
      <div className="nx-bars">
        {items.map((it, i) => <i key={i} className={it.neg ? "r" : it.value ? "l" : ""} style={{ height: `${Math.max(5, (Math.abs(it.value) / max) * 100)}%` }} title={`${it.label}: ${fmt ? fmt(it.value) : it.value}`} />)}
      </div>
      <div className="nx-bl">{items.map((it, i) => <span key={i}>{i % step === 0 || i === items.length - 1 ? it.label : ""}</span>)}</div>
    </div>
  );
}

export function NxTracks({ children }: { children: ReactNode }) {
  return <div className="nx-tl">{children}</div>;
}
export function NxTrack({ l, r, pct, children }: { l: ReactNode; r?: ReactNode; pct: number; children?: ReactNode }) {
  return (
    <div>
      <div className="nx-m"><span>{l}</span><span>{r}</span></div>
      <div className="nx-trk"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
      {children}
    </div>
  );
}
export function NxAvs({ names, more }: { names: string[]; more?: number }) {
  if (!names.length) return <div className="nx-avs nx-note">ninguém ainda</div>;
  return <div className="nx-avs">{names.map((n, i) => <NxAv key={i} name={n} />)}{more ? <span className="nx-av nx-more">+{more}</span> : null}</div>;
}
export function NxNote({ children }: { children: ReactNode }) {
  return <div className="nx-avs nx-note">{children}</div>;
}

export function NxTabsCard({ title, value, pre, chip, tabs, button }: { title: string; value: ReactNode; pre?: string; chip?: ReactNode; tabs: { top: ReactNode; label: string; href?: string; on?: boolean }[]; button?: { label: string; href: string } }) {
  return (
    <section className="nx-card nx-side">
      <div className="nx-lab">{title}</div>
      <div className="nx-big">{pre && <small>{pre}</small>}{value}{chip != null && chip !== "" && <span className="nx-chip">{chip}</span>}</div>
      <div className="nx-tabs3">
        {tabs.map((t, i) => {
          const c = <><span>{t.top}</span><b>{t.label}</b></>;
          return t.href ? <Link key={i} href={t.href} className={`nx-tb${t.on ? " on" : ""}`}>{c}</Link> : <div key={i} className={`nx-tb${t.on ? " on" : ""}`}>{c}</div>;
        })}
        {button && <Link href={button.href} className="nx-tbtn">{button.label}</Link>}
      </div>
    </section>
  );
}

export function NxRow2({ children }: { children: ReactNode }) {
  return <div className="nx-row">{children}</div>;
}

export function NxFilters({ count, children }: { count?: number; children: ReactNode }) {
  return <div className="nx-flt"><div className="nx-ft">Filtros{count ? <span>{count}</span> : null}</div>{children}</div>;
}
export function NxPill({ href, on, children }: { href: string; on?: boolean; children: ReactNode }) {
  return <Link href={href} className={`nx-pill${on ? " on" : ""}`}>{children}</Link>;
}

export function NxPanel({ title, tabs, list, detail, tools }: { title: string; tabs?: { label: string; count?: number; href: string; on?: boolean }[]; list: ReactNode; detail?: ReactNode; tools?: ReactNode }) {
  return (
    <div className="nx-wrap">
      {tabs && tabs.length > 0 && (
        <div className="nx-notch">
          {tabs.map((t) => <Link key={t.label} href={t.href} className={`nx-nt${t.on ? " on" : ""}`}>{t.label}{t.count != null && <span>{t.count.toLocaleString("pt-BR")}</span>}</Link>)}
        </div>
      )}
      <div className={`nx-white${detail ? "" : " solo"}`}>
        <div className="nx-lst">
          <div className="nx-hh"><h4>{title}</h4>{tools}</div>
          {list}
        </div>
        {detail && <div className="nx-det">{detail}</div>}
      </div>
    </div>
  );
}

export function NxItem({ href, name, title, sub, status, ok, value, on, scroll = false }: { href: string; name: string; title: ReactNode; sub?: ReactNode; status?: ReactNode; ok?: boolean; value?: ReactNode; on?: boolean; scroll?: boolean }) {
  return (
    <Link href={href} scroll={scroll} className={`nx-it${on ? " on" : ""}`}>
      <NxAv name={name} />
      <div className="nx-n">{title}{sub != null && <small>{sub}</small>}</div>
      {status != null && status !== "" && <span className={`nx-st${ok ? " p" : ""}`}>{status}</span>}
      {value != null && <span className="nx-vl">{value}</span>}
    </Link>
  );
}
export function NxEmpty({ children }: { children: ReactNode }) {
  return <div className="nx-empty">{children}</div>;
}

export function NxDHead({ cols }: { cols: { label: string; node: ReactNode }[] }) {
  return <div className="nx-dh">{cols.map((c, i) => <div key={i}><div className="nx-lab">{c.label}</div>{c.node}</div>)}</div>;
}
export function NxDNum({ children, chip }: { children?: ReactNode; chip?: ReactNode }) {
  return <div className="nx-dnum">{children}{chip != null && chip !== "" && <span className="nx-chip">{chip}</span>}</div>;
}
export function NxDText({ children }: { children: ReactNode }) {
  return <div className="nx-dtxt">{children}</div>;
}
export function NxWho({ name, sub }: { name: string; sub?: ReactNode }) {
  return <div className="nx-who"><NxAv name={name} /><div><b>{name}</b>{sub != null && <small>{sub}</small>}</div></div>;
}
export function NxDCards({ items, cols = 4 }: { items: { v: ReactNode; d: ReactNode; href?: string }[]; cols?: number }) {
  return (
    <div className="nx-pcs" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {items.map((it, i) => {
        const c = <><div className="nx-pv"><span>{it.v}</span>{it.href && <ArrowUpRight size={15} />}</div><div className="nx-pd">{it.d}</div></>;
        return it.href ? <Link key={i} href={it.href} className="nx-pc">{c}</Link> : <div key={i} className="nx-pc">{c}</div>;
      })}
    </div>
  );
}
export function NxQuote({ children }: { children: ReactNode }) {
  return <div className="nx-quote">{children}</div>;
}
export function NxDFoot({ vals, children }: { vals: { l: string; v: ReactNode }[]; children?: ReactNode }) {
  return (
    <div className="nx-ftr">
      {vals.map((x) => <div key={x.l}>{x.l}<b>{x.v}</b></div>)}
      <div className="nx-gr">{children}</div>
    </div>
  );
}
export function NxBtn({ href, children, lime, target }: { href: string; children: ReactNode; lime?: boolean; target?: string }) {
  return <Link href={href} target={target} className={lime ? "nx-lime" : "nx-ic"}>{children}</Link>;
}
