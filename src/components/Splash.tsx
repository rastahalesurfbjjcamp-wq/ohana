// Tela de carregamento com a logo no meio
export function Splash({ name, text = "Carregando", full = false }: { name: string; text?: string; full?: boolean }) {
  return (
    <div className={`splash${full ? " full" : ""}`} role="status" aria-live="polite">
      <div className="splash-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="splash-img" src="/brand/logo.png" alt={name} />
        <div className="splash-hub">{name} Hub</div>
        <div className="splash-bar"><i /></div>
        <div className="splash-txt">{text}</div>
      </div>
    </div>
  );
}
