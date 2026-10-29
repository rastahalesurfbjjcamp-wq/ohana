// Gráficos em SVG, no estilo das telas aprovadas (área suave, cascata, barras com meta, medidor).
import type { ReactNode } from "react";

type Pt = { label: string; value: number };

function smooth(points: [number, number][]) {
  if (points.length < 2) return points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function niceTicks(min: number, max: number, n = 3) {
  if (max === min) return [min];
  const step = (max - min) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step) ?? step;
  const out: number[] = [];
  for (let v = Math.ceil(min / nice) * nice; v <= max; v += nice) out.push(v);
  return out;
}

export function AreaChart({
  data, compare, markers = [], height = 240, format = (v) => v.toLocaleString("pt-BR"), color = "#34c26a", id = "a", zeroBase = false,
}: {
  data: Pt[];
  compare?: number[];
  markers?: { index: number; label: string }[];
  height?: number;
  format?: (v: number) => string;
  color?: string;
  id?: string;
  zeroBase?: boolean;
}) {
  const W = 1000, H = height, padL = 46, padR = 14, padT = 34, padB = 28;
  if (!data.length) return <div className="empty">Sem dados no período.</div>;
  const vals = [...data.map((d) => d.value), ...(compare ?? [])];
  let min = zeroBase ? 0 : Math.min(...vals);
  let max = Math.max(...vals);
  if (max === min) { max = max + 1; min = Math.max(0, min - 1); }
  const pad = (max - min) * 0.12;
  min = zeroBase ? 0 : Math.max(0, min - pad);
  max = max + pad;
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, data.length - 1);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const line = smooth(pts);
  const area = `${line} L${x(data.length - 1)},${H - padB} L${x(0)},${H - padB} Z`;
  const cmp = compare?.length ? smooth(compare.map((v, i) => [x(i), y(v)] as [number, number])) : null;
  const ticks = niceTicks(min, max, 3);
  const every = Math.max(1, Math.ceil(data.length / 6));
  const last = pts[pts.length - 1];
  return (
    <svg className="svgc" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={`g-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
          <text className="ylab" x={0} y={y(t) + 4}>{format(t)}</text>
        </g>
      ))}
      <path d={area} fill={`url(#g-${id})`} />
      {cmp && <path d={cmp} fill="none" stroke="#6b7570" strokeWidth="2" strokeDasharray="5 6" vectorEffect="non-scaling-stroke" />}
      <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {markers.map((m) => {
        const p = pts[m.index];
        if (!p) return null;
        const w = m.label.length * 7.4 + 22;
        return (
          <g key={m.index}>
            <line x1={p[0]} x2={p[0]} y1={p[1]} y2={H - padB} stroke="#f7c928" strokeDasharray="3 5" strokeWidth="1.2" />
            <rect x={Math.min(p[0] - w / 2, W - w - 2)} y={p[1] - 36} width={w} height={24} rx={12} fill="#f7c928" />
            <text x={Math.min(p[0], W - w / 2 - 2)} y={p[1] - 20} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1b1400">{m.label}</text>
            <circle cx={p[0]} cy={p[1]} r={6} fill="#111413" stroke="#f7c928" strokeWidth="2.5" />
          </g>
        );
      })}
      {data.map((d, i) => (
        <g className="pt" key={i}>
          <rect x={x(i) - (W / data.length) / 2} y={padT} width={W / data.length} height={H - padT - padB} fill="transparent" />
          <circle className="ring" cx={pts[i][0]} cy={pts[i][1]} r={5} fill={color} stroke="#111413" strokeWidth="3" />
          <g className="tip">
            <rect x={Math.min(Math.max(pts[i][0] - 70, 0), W - 140)} y={Math.max(pts[i][1] - 52, 0)} width={140} height={38} rx={9} fill="#1e2421" stroke="#2c3431" />
            <text x={Math.min(Math.max(pts[i][0], 70), W - 70)} y={Math.max(pts[i][1] - 37, 15)} textAnchor="middle" fontSize="11" fill="#8b948f">{d.label}</text>
            <text x={Math.min(Math.max(pts[i][0], 70), W - 70)} y={Math.max(pts[i][1] - 21, 31)} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{format(d.value)}</text>
          </g>
          {i % every === 0 || i === data.length - 1 ? (
            <text className="xlab" x={pts[i][0]} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}>{d.label}</text>
          ) : null}
        </g>
      ))}
      <circle cx={last[0]} cy={last[1]} r={6} fill={color} stroke="#111413" strokeWidth="3" />
    </svg>
  );
}

export function Waterfall({ steps, format }: { steps: { label: string; value: number; kind: "total" | "neg" | "result"; sub?: string }[]; format: (v: number) => string }) {
  const W = 1000, H = 330, padT = 40, padB = 54;
  const total = Math.max(1, ...steps.filter((s) => s.kind === "total").map((s) => s.value));
  const lowest = Math.min(0, ...steps.filter((s) => s.kind === "result").map((s) => s.value));
  const span = total - lowest;
  const y = (v: number) => padT + (1 - (v - lowest) / span) * (H - padT - padB);
  const bw = (W / steps.length) * 0.58;
  let running = total;
  return (
    <svg className="svgc" viewBox={`0 0 ${W} ${H}`}>
      <line className="grid" x1={0} x2={W} y1={y(0)} y2={y(0)} />
      {steps.map((s, i) => {
        const cx = (W / steps.length) * (i + 0.5);
        let top = 0, bottom = 0, fill = "#e8ece9", label = format(s.value), lc = "#eef1ef";
        if (s.kind === "total") { top = y(s.value); bottom = y(0); running = s.value; }
        else if (s.kind === "neg") { top = y(running); running -= s.value; bottom = y(running); fill = "#8b2a2a"; label = `-${format(s.value)}`; lc = "#f87171"; }
        else { top = y(Math.max(0, s.value)); bottom = y(Math.min(0, s.value)); fill = s.value >= 0 ? "#34c26a" : "#ef4444"; lc = s.value >= 0 ? "#4ad781" : "#f87171"; }
        const h = Math.max(4, bottom - top);
        const next = steps[i + 1];
        return (
          <g key={s.label}>
            <rect x={cx - bw / 2} y={top} width={bw} height={h} rx={8} fill={fill} />
            {next && s.kind !== "result" && (
              <line x1={cx + bw / 2} x2={(W / steps.length) * (i + 1.5) - bw / 2} y1={y(running)} y2={y(running)} stroke="#3a433f" strokeDasharray="4 5" />
            )}
            <text x={cx} y={top - 10} textAnchor="middle" fontSize="15" fontWeight="700" fill={lc}>{label}</text>
            <text x={cx} y={H - 30} textAnchor="middle" fontSize="13" fill="#aab3ae">{s.label}</text>
            {s.sub && <text x={cx} y={H - 12} textAnchor="middle" fontSize="11.5" fill="#5d6661">{s.sub}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function GoalBars({ items, goal, format, height = 230 }: { items: Pt[]; goal: number; format: (v: number) => string; height?: number }) {
  const W = 1000, H = height, padT = 34, padB = 26;
  const max = Math.max(goal * 1.35, ...items.map((i) => i.value)) || 1;
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const slot = W / Math.max(1, items.length);
  const bw = Math.min(70, slot * 0.56);
  return (
    <svg className="svgc" viewBox={`0 0 ${W} ${H}`}>
      {items.map((it, i) => {
        const cx = slot * (i + 0.5);
        const col = it.value >= goal ? "#2fa65a" : it.value >= goal * 0.8 ? "#c9a227" : "#c23b3b";
        return (
          <g key={it.label + i}>
            <rect x={cx - bw / 2} y={y(it.value)} width={bw} height={Math.max(3, H - padB - y(it.value))} rx={8} fill={col} />
            <text x={cx} y={y(it.value) - 9} textAnchor="middle" fontSize="13" fontWeight="700" fill="#eef1ef">{format(it.value)}</text>
            <text className="xlab" x={cx} y={H - 6} textAnchor="middle" fontSize="12">{it.label}</text>
          </g>
        );
      })}
      <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="#f7c928" strokeDasharray="6 6" strokeWidth="1.5" />
      <text x={W} y={y(goal) - 8} textAnchor="end" fontSize="12" fill="#f7c928">meta {format(goal)}</text>
    </svg>
  );
}

export function Bars({ items, format, color = "#34c26a", height = 200, highlightLast = false }: { items: Pt[]; format: (v: number) => string; color?: string; height?: number; highlightLast?: boolean }) {
  const W = 1000, H = height, padT = 26, padB = 24;
  const max = Math.max(1, ...items.map((i) => i.value));
  const slot = W / Math.max(1, items.length);
  const bw = Math.min(46, slot * 0.62);
  const every = Math.max(1, Math.ceil(items.length / 10));
  return (
    <svg className="svgc" viewBox={`0 0 ${W} ${H}`}>
      {items.map((it, i) => {
        const h = ((H - padT - padB) * it.value) / max;
        const cx = slot * (i + 0.5);
        const last = highlightLast && i === items.length - 1;
        return (
          <g className="pt" key={i}>
            <rect x={cx - bw / 2} y={H - padB - Math.max(2, h)} width={bw} height={Math.max(2, h)} rx={6} fill={last ? "#f7c928" : color} opacity={last ? 1 : 0.9} />
            <g className="tip"><text x={cx} y={H - padB - h - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{format(it.value)}</text></g>
            {i % every === 0 && <text className="xlab" x={cx} y={H - 5} textAnchor="middle">{it.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Medidor com faixas vermelho/amarelo/verde e a meta
export function Meter({ value, goal, max, format }: { value: number; goal: number; max: number; format: (v: number) => string }) {
  const p = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const redEnd = (goal * 0.8) / max;
  const yelEnd = goal / max;
  return (
    <>
      <div className="meter">
        <span style={{ width: `${redEnd * 100}%`, background: "#7f2a2a" }} />
        <span style={{ width: `${(yelEnd - redEnd) * 100}%`, background: "#8a7317" }} />
        <span style={{ flex: 1, background: "#1f6b3b" }} />
        <i className="goal" style={{ left: p(goal) }} />
        <i className="dot" style={{ left: p(value) }} />
      </div>
      <div className="meter-l"><span>0%</span><span className="g">meta {format(goal)}</span><span>{format(max)}</span></div>
    </>
  );
}

export function HRow({ label, value, max, right, tone = "", sub }: { label: ReactNode; value: number; max: number; right: ReactNode; tone?: "" | "s" | "c" | "k" | "p"; sub?: ReactNode }) {
  return (
    <div style={{ padding: "11px 0" }}>
      <div className="row" style={{ justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <span style={{ fontWeight: 550 }}>{label}</span>
        <span style={{ fontWeight: 650 }}>{right}</span>
      </div>
      <div className="hbar"><i className={tone} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} /></div>
      {sub && <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
