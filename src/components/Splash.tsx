// Tela de carregamento com a logo no meio
export function Splash({ name, text = "Carregando", full = false }: { name: string; text?: string; full?: boolean }) {
  return (
    <div className={`splash${full ? " full" : ""}`} role="status" aria-live="polite">
      <div className="splash-in">
                <div className="hub-logo" aria-label={`${name} Hub`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lion.png" alt="" />
          <div className="hl-r"><b>{name} Hub</b><i /><i /><i /></div>
        </div>
        <div className="splash-bar"><i /></div>
        <div className="splash-txt">{text}</div>
      </div>
    </div>
  );
}
