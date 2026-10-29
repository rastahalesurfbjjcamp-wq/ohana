"use client";
// Menu de três pontinhos
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export function Menu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="menu-b" aria-label="Mais opções" onClick={() => setOpen((o) => !o)}><MoreHorizontal size={18} /></button>
      {open && <div className="menu-p" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}
