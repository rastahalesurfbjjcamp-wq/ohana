// Convite da equipe: a pessoa cria a própria senha e já entra no Hub
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
const VALID_MS = 7 * 864e5;

async function definir(f: FormData) {
  "use server";
  const token = String(f.get("token") ?? "");
  const pass = String(f.get("password") ?? "");
  const again = String(f.get("again") ?? "");
  if (pass.length < 8) redirect(`/convite/${token}?e=curta`);
  if (pass !== again) redirect(`/convite/${token}?e=igual`);
  const u = token ? await db.user.findFirst({ where: { inviteToken: token, active: true } }) : null;
  if (!u || !u.inviteAt || Date.now() - u.inviteAt.getTime() > VALID_MS) redirect(`/convite/${token}?e=expirado`);
  await db.user.update({ where: { id: u!.id }, data: { passwordHash: await bcrypt.hash(pass, 10), inviteToken: null, lastLoginAt: new Date() } });
  await createSession({ userId: u!.id, name: u!.name, role: u!.role, areas: u!.areas ?? [] });
  redirect("/");
}

export default async function Convite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> }) {
  const { token } = await params;
  const { e } = await searchParams;
  const u = await db.user.findFirst({ where: { inviteToken: token, active: true } });
  const valid = !!u && !!u.inviteAt && Date.now() - u.inviteAt.getTime() <= VALID_MS;
  const ERR: Record<string, string> = { curta: "A senha precisa ter pelo menos 8 caracteres.", igual: "As duas senhas não estão iguais.", expirado: "Esse link venceu. Peça um novo para quem te convidou." };
  return (
    <div className="login">
      <form action={definir} className="pnl card stack">
        <div className="login-head">
          <div className="hub-logo static">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lion.png" alt="" />
            <div className="hl-r"><b>{env.storeName()} Hub</b><i /><i /><i /></div>
          </div>
          <small>{valid ? `Olá, ${u!.name.split(" ")[0]}` : "Convite"}</small>
        </div>
        {!valid ? (
          <p className="mut" style={{ textAlign: "center", fontSize: 14 }}>Esse convite não vale mais. Peça um novo link para quem te convidou.</p>
        ) : (
          <>
            <p className="mut" style={{ fontSize: 14, textAlign: "center" }}>Crie sua senha para entrar. Seu login é <b>{u!.email}</b>.</p>
            {e && <div className="err">{ERR[e] ?? "Não deu certo, tente de novo."}</div>}
            <input type="hidden" name="token" value={token} />
            <div className="field"><label>Senha</label><input className="in" type="password" name="password" autoComplete="new-password" minLength={8} required /></div>
            <div className="field"><label>Repita a senha</label><input className="in" type="password" name="again" autoComplete="new-password" minLength={8} required /></div>
            <button className="btn pri" type="submit" style={{ justifyContent: "center" }}>Criar senha e entrar</button>
          </>
        )}
      </form>
    </div>
  );
}
