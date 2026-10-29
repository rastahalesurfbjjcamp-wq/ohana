"use client";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem("_reload") ?? 0);
      if (Date.now() - last > 30_000) { sessionStorage.setItem("_reload", String(Date.now())); window.location.reload(); }
    } catch {
      window.location.reload();
    }
  }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ background: "#0b0e0d", color: "#e8ece9", fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <p>Recarregando…</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 10, padding: "10px 16px", borderRadius: 10, border: 0, background: "#34c26a", color: "#04140a", fontWeight: 600, cursor: "pointer" }}>Recarregar agora</button>
        </div>
      </body>
    </html>
  );
}
