// Cartão das telas de entrar, cadastro e convite (mesmo estilo do login do Hub)
export function AuthCard({ action, sub, children }: { action: (f: FormData) => Promise<void>; sub: string; children: React.ReactNode }) {
  return (
    <div className="login pt-auth">
      <form action={action} className="pnl card stack">
        <div className="login-head">
          <div className="hub-logo static" aria-label="Rasta Hale Parceiros">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lion.png" alt="" />
            <div className="hl-r"><b>Rasta Hale</b><i /><i /><i /></div>
          </div>
          <small>{sub}</small>
        </div>
        {children}
      </form>
    </div>
  );
}
