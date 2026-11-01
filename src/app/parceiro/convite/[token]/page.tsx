import { db } from "@/lib/db";
import { criarSenhaParceiro } from "../../acoes";

export const dynamic = "force-dynamic";
const VALID_MS = 7 * 864e5;

export default async function ConviteParceiro({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> }) {
  const { token } = await params;
  const { e } = await searchParams;
  const p = await db.referral.findFirst({ where: { inviteToken: token, active: true } });
  const valid = !!p && !!p.inviteAt && Date.now() - p.inviteAt.getTime() <= VALID_MS;
  const ERR: Record<string, string> = { curta: "A senha precisa ter pelo menos 8 caracteres.", igual: "As duas senhas não estão iguais.", expirado: "Esse link venceu. Peça um novo para a equipe." };
  return (
    <div className="pp-auth">
      <form action={criarSenhaParceiro}>
        <div className="pp-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lion.png" alt="" />
          <div><b>RASTA HALE</b><div className="pp-stripe"><i /><i /><i /></div></div>
        </div>
        {!valid ? (
          <>
            <h1 className="tw">Link vencido</h1>
            <p>Esse convite não vale mais. Peça um novo link para a equipe da Rasta Hale.</p>
          </>
        ) : (
          <>
            <h1 className="tw">Bem-vindo, {(p!.name ?? "").split(" ")[0]}</h1>
            <p>Crie sua senha para acessar a área do parceiro. Seu login é <b>{p!.email}</b>.</p>
            {e && <div className="pp-msg err">{ERR[e] ?? "Não deu certo, tente de novo."}</div>}
            <input type="hidden" name="token" value={token} />
            <label>Senha<input className="pp-f" type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
            <label>Repita a senha<input className="pp-f" type="password" name="again" autoComplete="new-password" minLength={8} required /></label>
            <button className="pp-btn" type="submit">Criar senha e entrar</button>
          </>
        )}
      </form>
    </div>
  );
}
