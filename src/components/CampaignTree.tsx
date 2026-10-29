"use client";
// Tabela de campanhas que abre em conjuntos e anúncios.
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type TNode = { key: string; label: string; sub?: string; spend: number | null; metaLeads: number | null; leads: number; inGroup: number; sales: number; value: number; children: TNode[] };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Row({ n, depth, open, toggle, goodCpm, mode }: { n: TNode; depth: number; open: Set<string>; toggle: (k: string) => void; goodCpm: number; mode?: "origem" }) {
  const has = n.children.length > 0;
  const isOpen = open.has(n.key);
  const cpm = n.spend != null && n.inGroup ? n.spend / n.inGroup : null;
  const roas = n.spend ? n.value / n.spend : null;
  return (
    <>
      <tr className={`ct d${depth}`} onClick={() => has && toggle(n.key)} style={{ cursor: has ? "pointer" : "default" }}>
        <td>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap", paddingLeft: depth * 20 }}>
            <span style={{ width: 16, display: "grid", placeItems: "center", flexShrink: 0 }} className="dim">{has ? (isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : null}</span>
            <span className={depth === 0 ? "ct-c" : depth === 1 ? "ct-s" : "ct-a"}>{n.label}</span>
            {n.sub && <span className="dim" style={{ fontSize: 12, whiteSpace: "nowrap" }}>· {n.sub}</span>}
          </div>
        </td>
        {mode === "origem" ? (
          <>
            <td className="r">{n.spend != null ? brl(n.spend) : <span className="dim">–</span>}</td>
            <td className="r dim">{n.metaLeads ?? "–"}</td>
            <td className="r"><b>{n.leads}</b></td>
            <td className="r">{n.value ? brl(n.value) : <span className="dim">–</span>}</td>
            <td className="r" style={{ fontWeight: 650, color: roas == null ? undefined : roas >= 3 ? "var(--lagoon)" : roas < 1 ? "var(--coral)" : undefined }}>{roas != null ? roas.toFixed(1).replace(".", ",") : "–"}</td>
            <td className="r">{depth === 0 && (roas == null ? <span className="chip c-n">sem gasto</span> : roas >= 3 ? <span className="chip c-l">Escalar</span> : roas >= 1.5 ? <span className="chip c-s">Revisar</span> : n.spend! < 50 ? <span className="chip c-n">Aguardar</span> : <span className="chip c-c">Pausar</span>)}</td>
          </>
        ) : (
        <>
        <td className="r">{n.spend != null ? brl(n.spend) : <span className="dim">–</span>}</td>
        <td className="r">{n.metaLeads != null ? n.metaLeads.toLocaleString("pt-BR") : <span className="dim">–</span>}</td>
        <td className="r"><b>{n.leads.toLocaleString("pt-BR")}</b></td>
        <td className="r">{n.inGroup.toLocaleString("pt-BR")}</td>
        <td className="r" style={{ fontWeight: 650, color: cpm == null ? undefined : cpm <= goodCpm ? "var(--lagoon)" : cpm > goodCpm * 1.4 ? "var(--coral)" : undefined }}>{cpm != null ? brl(cpm) : <span className="dim">–</span>}</td>
        <td className="r">{n.value ? brl(n.value) : <span className="dim">–</span>}</td>
        <td className="r">{roas != null ? <span className={`chip ${roas >= 10 ? "c-l" : roas >= 3 ? "c-s" : "c-c"}`}>{roas.toFixed(1).replace(".", ",")}</span> : <span className="dim">–</span>}</td>
        </>
        )}
      </tr>
      {isOpen && n.children.map((c) => <Row key={c.key} n={c} depth={depth + 1} open={open} toggle={toggle} goodCpm={goodCpm} mode={mode} />)}
    </>
  );
}

export function CampaignTree({ nodes, mode }: { nodes: TNode[]; mode?: "origem" }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(nodes.slice(0, 2).map((n) => n.key)));
  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const cpms = nodes.filter((n) => n.spend && n.inGroup).map((n) => n.spend! / n.inGroup).sort((a, b) => a - b);
  const goodCpm = cpms.length ? cpms[Math.floor(cpms.length / 2)] : 0;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="tb ctree">
        <thead>{mode === "origem"
          ? <tr><th>Campanha</th><th className="r">Gasto</th><th className="r">Meta diz</th><th className="r">UTM</th><th className="r">Faturado</th><th className="r">Retorno</th><th /></tr>
          : <tr><th>Campanha · conjunto · anúncio</th><th className="r">Investido</th><th className="r">Leads Meta</th><th className="r">Leads reais</th><th className="r">No grupo</th><th className="r">Custo/membro</th><th className="r">Vendas</th><th className="r">ROAS</th></tr>}</thead>
        <tbody>{nodes.map((n) => <Fragment key={n.key}><Row n={n} depth={0} open={open} toggle={toggle} goodCpm={goodCpm} mode={mode} /></Fragment>)}</tbody>
      </table>
    </div>
  );
}
