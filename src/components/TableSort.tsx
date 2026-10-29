"use client";
// Ordena qualquer tabela do painel clicando no título da coluna (maior para menor e vice-versa).
import { useEffect } from "react";
import { usePathname } from "next/navigation";

function value(td: Element | undefined): number | string {
  if (!td) return "";
  const own = (td as HTMLElement).dataset.sort;
  if (own != null && own !== "") return Number.isFinite(Number(own)) ? Number(own) : own.toLowerCase();
  const input = td.querySelector("input:not([type=checkbox]):not([type=hidden])") as HTMLInputElement | null;
  const t = (input?.value || td.textContent || "").trim();
  const dt = t.match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?(?:,?\s+(\d{2}):(\d{2}))?/);
  if (dt) {
    const y = dt[3] ? (dt[3].length === 2 ? 2000 + Number(dt[3]) : Number(dt[3])) : new Date().getFullYear();
    return new Date(y, Number(dt[2]) - 1, Number(dt[1]), Number(dt[4] ?? 0), Number(dt[5] ?? 0)).getTime();
  }
  const n = t.replace(/R\$|\s|pts|peças|%/g, "").match(/^[-+]?[\d.]*\d(,\d+)?/);
  if (n) return Number(n[0].replace(/\./g, "").replace(",", "."));
  return t.toLowerCase();
}

export function TableSort() {
  const path = usePathname();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const th = (e.target as HTMLElement).closest("table.tb thead th") as HTMLTableCellElement | null;
      if (!th || (e.target as HTMLElement).closest("input,button,a,select,label")) return;
      const table = th.closest("table")!;
      if (table.dataset.nosort != null || th.dataset.nosort != null || !th.textContent?.trim()) return;
      const idx = Array.from(th.parentElement!.children).indexOf(th);
      const body = table.tBodies[0];
      if (!body) return;
      const dir = th.dataset.dir === "desc" ? "asc" : "desc"; // primeiro clique: maior para menor
      table.querySelectorAll("thead th").forEach((x) => { delete (x as HTMLElement).dataset.dir; });
      th.dataset.dir = dir;
      const rows = Array.from(body.rows);
      rows.sort((a, b) => {
        const va = value(a.cells[idx]);
        const vb = value(b.cells[idx]);
        let r: number;
        if (typeof va === "number" && typeof vb === "number") r = va - vb;
        else if (typeof va === "number") r = -1;
        else if (typeof vb === "number") r = 1;
        else r = va.localeCompare(vb, "pt-BR");
        return dir === "asc" ? r : -r;
      });
      for (const r of rows) body.appendChild(r);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [path]);
  return null;
}
