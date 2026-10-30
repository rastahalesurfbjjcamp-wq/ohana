import { redirect } from "next/navigation";
import { getSession, login } from "@/lib/auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

// Demonstração: entra direto como visitante
async function entrarDemo() {
  "use server";
  if (process.env.DEMO_MODE !== "1") redirect("/login");
  const { db } = await import("@/lib/db");
  const { createSession } = await import("@/lib/auth");
  const { DEMO_EMAIL, ensureDemoSeed } = await import("@/lib/demo/seed");
  let u = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!u) { await ensureDemoSeed(true); u = await db.user.findUnique({ where: { email: DEMO_EMAIL } }); }
  if (!u) redirect("/login?erro=1");
  await createSession({ userId: u.id, name: u.name, role: u.role });
  redirect("/");
}

async function entrar(formData: FormData) {
  "use server";
  const s = await login(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!s) redirect("/login?erro=1");
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getSession()) redirect("/");
  const { erro } = await searchParams;
  if (process.env.DEMO_MODE === "1") {
    return (
      <div className="login">
        <form action={entrarDemo} className="pnl card stack">
          <div className="login-head">
            <div className="hub-logo static" aria-label={`${env.storeName()} Hub`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lion.png" alt="" />
              <div className="hl-r"><b>{env.storeName()} Hub</b><i /><i /><i /></div>
            </div>
            <small>Demonstração</small>
          </div>
          <p className="mut" style={{ fontSize: 14, lineHeight: 1.55, textAlign: "center" }}>Veja por dentro o painel de uma loja de surf e luta: vendas, lucro, anúncios, comunidade no WhatsApp, clube de fidelidade e atletas. Os dados são fictícios.</p>
          <button className="btn pri" type="submit" style={{ justifyContent: "center", marginTop: 6 }}>Entrar na demonstração</button>
          <p className="dim" style={{ fontSize: 12, textAlign: "center" }}>Pode clicar em tudo. Toda noite a demonstração volta ao original.</p>
        </form>
      </div>
    );
  }
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
