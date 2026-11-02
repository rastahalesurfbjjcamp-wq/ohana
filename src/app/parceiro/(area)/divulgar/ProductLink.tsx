"use client";
import { useMemo, useState } from "react";
import { MessageCircle, Search, X } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";

export type PItem = { handle: string; title: string; image: string | null; price: number };

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Atleta escolhe o produto (ou cola o link da loja) e recebe o link rastreável dele para aquela peça
export function ProductLink({ code, items }: { code: string; items: PItem[] }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<PItem | null>(null);
  const base = `https://rastahale.tech/r/${encodeURIComponent(code)}`;

  // aceita o link colado da loja: .../products/nome-do-produto
  const pasted = q.match(/\/products\/([a-z0-9-]+)/i)?.[1]?.toLowerCase() ?? null;
  const list = useMemo(() => {
    if (pasted) return items.filter((i) => i.handle === pasted);
    const t = norm(q.trim());
    if (!t) return items.slice(0, 8);
    return items.filter((i) => t.split(/\s+/).every((w) => norm(i.title).includes(w))).slice(0, 8);
  }, [q, pasted, items]);

  const handle = sel?.handle ?? (pasted && !list.length ? pasted : null);
  const link = handle ? `${base}?p=/products/${handle}` : "";
  const share = sel ? `${sel.title} na Rasta Hale com o meu cupom ${code}: ${link}` : `Rasta Hale com o meu cupom ${code}: ${link}`;

  return (
    <div className="stack" style={{ gap: 12 }}>
      {!sel && (
        <>
          <div className="pt-search">
            <Search size={15} />
            <input className="in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busque o produto ou cole o link dele da loja" />
          </div>
          <div className="pt-plist">
            {list.map((i) => (
              <button type="button" key={i.handle} className="pt-pitem" onClick={() => setSel(i)}>
                {i.image ? <img src={i.image} alt="" /> : <span className="pt-pimg" />}
                <span className="t">{i.title}</span>
                <span className="v">{brl(i.price)}</span>
              </button>
            ))}
            {!list.length && !pasted && <div className="dim" style={{ fontSize: 13, padding: 8 }}>Nenhum produto com esse nome.</div>}
          </div>
        </>
      )}
      {handle && (
        <div className="pt-gen">
          {sel && (
            <div className="row" style={{ gap: 12, alignItems: "center" }}>
              {sel.image ? <img src={sel.image} alt="" className="pt-gimg" /> : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{sel.title}</div>
                <div className="dim" style={{ fontSize: 12.5 }}>{brl(sel.price)}</div>
              </div>
              <button type="button" className="btn sm ghost" onClick={() => { setSel(null); setQ(""); }}><X size={14} /> Trocar</button>
            </div>
          )}
          <small className="pt-lab" style={{ display: "block", marginTop: 12 }}>Seu link deste produto</small>
          <div className="pt-link"><code>{link}</code><CopyButton text={link} label="Copiar link" className="btn sm pri" /></div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener"><MessageCircle size={15} /> Mandar no WhatsApp</a>
            <CopyButton text={share} label="Copiar mensagem" className="btn" />
          </div>
        </div>
      )}
    </div>
  );
}
