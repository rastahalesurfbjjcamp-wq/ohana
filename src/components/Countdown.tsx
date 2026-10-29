"use client";
import { useEffect, useState } from "react";

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, Date.parse(to) - now);
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return (
    <div className="cdown">
      {[[d, "dias"], [h, "horas"], [m, "min"]].map(([v, l]) => <div key={l as string}><b>{v}</b><small>{l}</small></div>)}
    </div>
  );
}
