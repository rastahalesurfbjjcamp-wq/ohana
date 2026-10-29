// Tela de carregamento com a marca no meio
export function Splash({ name, text = "Carregando", full = false }: { name: string; text?: string; full?: boolean }) {
  return (
    <div className={`splash${full ? " full" : ""}`} role="status" aria-live="polite">
      <div className="splash-in">
        <div className="splash-logo">{name}</div>
        <div className="splash-bar"><i /></div>
        <div className="splash-txt">{text}</div>
      </div>
    </div>
  );
}
