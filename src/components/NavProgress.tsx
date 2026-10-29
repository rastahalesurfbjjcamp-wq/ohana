"use client";
// Ao trocar de tela ou de data, a tela atual fica visível e aparece uma barra fina no topo.
// Só se demorar mais que 0,8 s aparece a logo carregando.
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Splash } from "./Splash";

export const startNav = () => window.dispatchEvent(new Event("hub:nav"));

export function NavProgress({ name }: { name: string }) {
  const path = usePathname();
  const params = useSearchParams();
  const [on, setOn] = useState(false);
  const [slow, setSlow] = useState(false);
  const timers = useRef<number[]>([]);
  const clear = () => { timers.current.forEach((t) => clearTimeout(t)); timers.current = []; };

  useEffect(() => {
    const start = () => {
      clear();
      setOn(true);
      timers.current.push(window.setTimeout(() => setSlow(true), 800));
      timers.current.push(window.setTimeout(() => { setOn(false); setSlow(false); }, 20000));
    };
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    window.addEventListener("hub:nav", start);
    document.addEventListener("click", click);
    return () => { window.removeEventListener("hub:nav", start); document.removeEventListener("click", click); };
  }, []);

  // chegou na tela nova
  useEffect(() => { clear(); setOn(false); setSlow(false); }, [path, params]);

  return (
    <>
      {on && <div className="navbar-prog" aria-hidden="true"><i /></div>}
      {slow && <div className="nav-splash"><Splash name={name} /></div>}
    </>
  );
}
