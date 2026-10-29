"use client";
// Depois de uma atualização do sistema, a aba aberta pode pedir arquivos que não existem mais.
// Quando isso acontece, recarrega a página sozinho (uma vez a cada 30 segundos, no máximo).
import { useEffect } from "react";

export const isStale = (m: string) => /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Failed to find Server Action|deployment|Failed to fetch/i.test(m);

export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem("_reload") ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem("_reload", String(Date.now()));
  } catch {
    // sem sessionStorage: recarrega mesmo assim
  }
  window.location.reload();
  return true;
}

export function ChunkGuard() {
  useEffect(() => {
    const onErr = (e: ErrorEvent) => { if (isStale(String(e.message ?? e.error))) reloadOnce(); };
    const onRej = (e: PromiseRejectionEvent) => { if (isStale(String(e.reason?.message ?? e.reason))) reloadOnce(); };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);
  return null;
}
