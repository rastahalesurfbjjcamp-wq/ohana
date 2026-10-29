// Markdown simples (títulos, listas, negrito) para textos gerados pela IA.
import type { ReactNode } from "react";

function inline(t: string): ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p));
}

export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((x, i) => <li key={i} style={{ marginBottom: 8, lineHeight: 1.55 }}>{inline(x)}</li>);
    out.push(list.ordered ? <ol key={out.length} style={{ paddingLeft: 20 }}>{items}</ol> : <ul key={out.length} style={{ paddingLeft: 20 }}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = line.match(/^#{1,3}\s+(.*)/);
    const ol = line.match(/^\d+[.)]\s+(.*)/);
    const ul = line.match(/^[-*]\s+(.*)/);
    if (h) { flush(); out.push(<h3 key={out.length} style={{ fontSize: 16, margin: "18px 0 8px" }}>{inline(h[1])}</h3>); }
    else if (ol || ul) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((ol ?? ul)![1]);
    } else { flush(); out.push(<p key={out.length} style={{ lineHeight: 1.6, marginBottom: 8 }}>{inline(line)}</p>); }
  }
  flush();
  return <div style={{ fontSize: 14 }}>{out}</div>;
}
