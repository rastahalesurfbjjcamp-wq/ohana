import { db } from "@/lib/db";
import { criarSenhaParceiro } from "../../acoes";
import { AuthCard } from "../../AuthCard";

export const dynamic = "force-dynamic";
const VALID_MS = 7 * 864e5;

export default async function ConviteParceiro({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> }) {
  const { token } = await params;
  const { e } = await searchParams;
  const p = await db.referral.findFirst({ where: { inviteToken: token, active: true } });
  const valid = !!p && !!p.inviteAt && Date.now() - p.inviteAt.getTime() <= VALID_MS;
  const ERR: Record<string, string> = { curta: "A senha precisa ter pelo menos 8 caracteres.", igual: "As duas senhas não estão iguais.", expirado: "Esse link venceu. Peça um novo para a equipe." };
  return (
    <AuthCard action={criarSenhaParceiro} sub="Área do parceiro">
      {!valid ? (
        <p className="mut" style={{ fontSize: 14, lineHeight: 1.55, textAlign: "center" }}>Esse convite não vale mais. Peça um novo link para a equipe da Rasta Hale.</p>
      ) : (
        <>
          <p className="mut" style={{ fontSize: 14, lineHeight: 1.55, textAlign: "center" }}>Bem-vindo, {(p!.name ?? "").split(" ")[0]}. Crie sua senha para entrar. Seu login é <b style={{ color: "#fff" }}>{p!.email}</b>.</p>
          {e && <div className="err">{ERR[e] ?? "Não deu certo, tente de novo."}</div>}
          <input type="hidden" name="token" value={token} />
          <div className="field"><label htmlFor="password">Senha</label><input className="in" id="password" type="password" name="password" autoComplete="new-password" minLength={8} required /></div>
          <div className="field"><label htmlFor="again">Repita a senha</label><input className="in" id="again" type="password" name="again" autoComplete="new-password" minLength={8} required /></div>
          <button className="btn pri" type="submit" style={{ justifyContent: "center", marginTop: 6 }}>Criar senha e entrar</button>
        </>
      )}
    </AuthCard>
  );
}
