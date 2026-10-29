import { redirect } from "next/navigation";
import { getSession, login } from "@/lib/auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

async function entrar(formData: FormData) {
  "use server";
  const s = await login(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!s) redirect("/login?erro=1");
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getSession()) redirect("/");
  const { erro } = await searchParams;
  return (
    <div className="login">
      <form action={entrar} className="pnl card stack">
        <div className="login-head">
          <div className="hub-logo static" aria-label={`${env.storeName()} Hub`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lion.png" alt="" />
            <div className="hl-r"><b>{env.storeName()} Hub</b><i /><i /><i /></div>
          </div>
          <small>Comunidade e vendas</small>
        </div>
        {erro && <div className="err">E-mail ou senha incorretos.</div>}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input className="in" id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input className="in" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn pri" type="submit" style={{ justifyContent: "center", marginTop: 6 }}>
          Entrar
        </button>
      </form>
    </div>
  );
}
