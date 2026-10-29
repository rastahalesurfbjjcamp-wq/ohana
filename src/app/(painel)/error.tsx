"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { isStale, reloadOnce } from "@/components/ChunkGuard";

export default function PainelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [auto, setAuto] = useState(false);
  const [name, setName] = useState("Hub");
  useEffect(() => {
    setName(document.querySelector(".brand b")?.textContent?.replace(/ Hub$/, "") || "Hub");
    console.error(error);
    if (isStale(String(error?.message))) setAuto(reloadOnce());
  }, [error]);
  return (
    <div className="splash">
      <div className="splash-in">
                <div className="hub-logo" aria-label={`${name} Hub`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lion.png" alt="" />
          <div className="hl-r"><b>{name} Hub</b><i /><i /><i /></div>
        </div>
        {auto ? (
          <><div className="splash-bar"><i /></div><div className="splash-txt">O sistema foi atualizado. Recarregando…</div></>
        ) : (
          <>
            <div className="splash-txt" style={{ marginBottom: 14 }}>Essa tela não carregou direito. Geralmente resolve tentando de novo.</div>
            <div className="row" style={{ gap: 8, justifyContent: "center" }}>
              <button className="btn pri" type="button" onClick={() => reset()}><RefreshCw size={15} /> Tentar de novo</button>
              <button className="btn" type="button" onClick={() => window.location.reload()}>Recarregar a página</button>
            </div>
            {error?.digest && <div className="dim" style={{ fontSize: 11, marginTop: 12 }}>código {error.digest}</div>}
          </>
        )}
      </div>
    </div>
  );
}
