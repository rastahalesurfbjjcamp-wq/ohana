// Cadastro da equipe: a pessoa cria o próprio acesso e o administrador aprova no Hub (Equipe e acessos)
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  campos: "Preencha nome, e-mail e senha.",
  email: "Confira o e-mail.",
  curta: "A senha precisa ter pelo menos 8 caracteres.",
  igual: "As duas senhas não estão iguais.",
  existe: "Esse e-mail já tem acesso. Entre em rastahale.tech/admin ou fale com o administrador.",
};

async function cadastrar(f: FormData) {
  "use server";
  const name = String(f.get("name") ?? "").trim().slice(0, 80);
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const pass = String(f.get("password") ?? "");
  let phone = String(f.get("phone") ?? "").replace(/\D/g, "");
  if (!name || !email || !pass) redirect("/admin/cadastro?e=campos");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/admin/cadastro?e=email");
  if (pass.length < 8) redirect("/admin/cadastro?e=curta");
  if (pass !== String(f.get("again") ?? "")) redirect("/admin/cadastro?e=igual");
  if (await db.user.findUnique({ where: { email } })) redirect("/admin/cadastro?e=existe");
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  // entra como equipe com acesso a tudo (menos Equipe e Integrações), mas só depois que o administrador aprovar
  await db.user.create({ data: { name, email, role: "TEAM", areas: [], passwordHash: await bcrypt.hash(pass, 10), active: false, pendingAt: new Date(), phone: phone.length >= 12 ? phone : null } });
  await import("@/lib/pushcut").then((x) => x.pushcut("Novo acesso pedido no Hub", `${name} (${email}) quer entrar na equipe. Aprove em Equipe e acessos.`)).catch(() => null);
  redirect("/admin/cadastro?ok=1");
}

export default async function CadastroEquipe({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="login">
      <form action={cadastrar} className="pnl card stack">
        <div className="login-head">
          <div className="hub-logo static">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lion.png" alt="" />
            <div className="hl-r"><b>{env.storeName()} Hub</b><i /><i /><i /></div>
          </div>
          <small>Acesso da equipe</small>
        </div>
        {sp.ok ? (
          <>
            <div className="ok">Pedido enviado. Assim que o administrador aprovar, você entra com o seu e-mail e senha.</div>
            <a className="btn pri" href="/admin" style={{ justifyContent: "center" }}>Ir para a entrada</a>
          </>
        ) : (
          <>
            <p className="mut" style={{ fontSize: 14, lineHeight: 1.55, textAlign: "center" }}>Crie seu acesso ao Hub. Depois que o administrador aprovar, você já entra.</p>
            {sp.e && <div className="err">{ERR[sp.e] ?? "Não deu certo, tente de novo."}</div>}
            <div className="field"><label htmlFor="name">Nome</label><input className="in" id="name" name="name" autoComplete="name" required /></div>
            <div className="field"><label htmlFor="email">E-mail</label><input className="in" id="email" name="email" type="email" autoComplete="email" required /></div>
            <div className="field"><label htmlFor="phone">WhatsApp</label><input className="in" id="phone" name="phone" inputMode="tel" placeholder="(21) 99999-9999" /></div>
            <div className="field"><label htmlFor="password">Senha</label><input className="in" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
            <div className="field"><label htmlFor="again">Repita a senha</label><input className="in" id="again" name="again" type="password" autoComplete="new-password" minLength={8} required /></div>
            <button className="btn pri" type="submit" style={{ justifyContent: "center", marginTop: 6 }}>Pedir acesso</button>
            <p className="dim" style={{ fontSize: 13, textAlign: "center" }}>Já tem acesso? <a href="/admin" style={{ color: "var(--lagoon)" }}>Entrar</a></p>
          </>
        )}
      </form>
    </div>
  );
}
