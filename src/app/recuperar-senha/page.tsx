// Esqueci minha senha: código de 6 números pelo WhatsApp, depois a pessoa cria a senha nova
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createHash, randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
const VALID_MS = 15 * 60_000;
const key = (id: string) => `_reset:${id}`;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
type Reset = { hash: string; at: number; tries: number };
const enc = (e: string) => encodeURIComponent(e);

async function pedirCodigo(f: FormData) {
  "use server";
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const u = email ? await db.user.findUnique({ where: { email } }) : null;
  if (u && u.active) {
    const prev = (await db.setting.findUnique({ where: { key: key(u.id) } }))?.value as Reset | undefined;
    if (!prev || Date.now() - prev.at > 60_000) {
      const code = String(randomInt(100000, 1000000));
      const value: Reset = { hash: sha(`${u.id}:${code}`), at: Date.now(), tries: 0 };
      await db.setting.upsert({ where: { key: key(u.id) }, create: { key: key(u.id), value }, update: { value } });
      const { evolution } = await import("@/lib/evolution");
      // vai para o WhatsApp cadastrado da pessoa; o administrador sem número recebe no próprio número do Hub
      let to = u.phone || (u.role === "ADMIN" ? await evolution.ownerPhone() : null);
      if (to && (to.length === 10 || to.length === 11)) to = `55${to}`; // número sem o código do país
      if (to) await evolution.sendText(to, `Código para trocar a senha do ${env.storeName()} Hub: *${code}*\n\nVale por 15 minutos. Se não foi você, ignore esta mensagem.`).catch((e) => console.error("[senha]", String(e).slice(0, 160)));
      else console.error("[senha] sem WhatsApp para", email);
    }
  }
  // mesma resposta sempre, para não revelar quais e-mails existem
  redirect(`/admin/senha?etapa=codigo&email=${enc(email)}`);
}

async function trocarSenha(f: FormData) {
  "use server";
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const code = String(f.get("code") ?? "").replace(/\D/g, "");
  const pass = String(f.get("password") ?? "");
  const back = (e: string) => redirect(`/admin/senha?etapa=codigo&email=${enc(email)}&e=${e}`);
  if (pass.length < 8) back("curta");
  if (pass !== String(f.get("again") ?? "")) back("igual");
  const u = email ? await db.user.findUnique({ where: { email } }) : null;
  const r = u ? ((await db.setting.findUnique({ where: { key: key(u.id) } }))?.value as Reset | undefined) : undefined;
  if (!u || !u.active || !r || Date.now() - r.at > VALID_MS || r.tries >= 5) back("codigo");
  if (sha(`${u!.id}:${code}`) !== r!.hash) {
    await db.setting.update({ where: { key: key(u!.id) }, data: { value: { ...r!, tries: r!.tries + 1 } } });
    back("codigo");
  }
  await db.user.update({ where: { id: u!.id }, data: { passwordHash: await bcrypt.hash(pass, 10), lastLoginAt: new Date(), inviteToken: null } });
  await db.setting.delete({ where: { key: key(u!.id) } }).catch(() => null);
  await createSession({ userId: u!.id, name: u!.name, role: u!.role, areas: u!.areas ?? [] });
  redirect("/");
}

const ERR: Record<string, string> = { codigo: "Código errado ou vencido. Peça um novo.", curta: "A senha precisa ter pelo menos 8 caracteres.", igual: "As duas senhas não estão iguais." };

export default async function RecuperarSenha({ searchParams }: { searchParams: Promise<{ etapa?: string; email?: string; e?: string }> }) {
  const sp = await searchParams;
  const step2 = sp.etapa === "codigo" && !!sp.email;
  return (
    <div className="login">
      <form action={step2 ? trocarSenha : pedirCodigo} className="pnl card stack">
        <div className="login-head">
          <div className="hub-logo static">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lion.png" alt="" />
            <div className="hl-r"><b>{env.storeName()} Hub</b><i /><i /><i /></div>
          </div>
          <small>Trocar a senha</small>
        </div>
        {!step2 ? (
          <>
            <p className="mut" style={{ fontSize: 14, lineHeight: 1.55, textAlign: "center" }}>Digite o e-mail do seu acesso. Mandamos um código de 6 números no seu WhatsApp.</p>
            <div className="field"><label htmlFor="email">E-mail</label><input className="in" id="email" name="email" type="email" autoComplete="username" required /></div>
            <button className="btn pri" type="submit" style={{ justifyContent: "center", marginTop: 6 }}>Mandar código</button>
          </>
        ) : (
          <>
            <p className="mut" style={{ fontSize: 14, lineHeight: 1.55, textAlign: "center" }}>Se o e-mail estiver cadastrado, o código chegou no WhatsApp. Digite o código e a senha nova.</p>
            {sp.e && <div className="err">{ERR[sp.e] ?? "Não deu certo, tente de novo."}</div>}
            <input type="hidden" name="email" value={sp.email} />
            <div className="field"><label htmlFor="code">Código</label><input className="in" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></div>
            <div className="field"><label htmlFor="password">Senha nova</label><input className="in" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
            <div className="field"><label htmlFor="again">Repita a senha</label><input className="in" id="again" name="again" type="password" autoComplete="new-password" minLength={8} required /></div>
            <button className="btn pri" type="submit" style={{ justifyContent: "center", marginTop: 6 }}>Trocar senha e entrar</button>
            <p className="dim" style={{ fontSize: 13, textAlign: "center" }}><a href="/admin/senha" style={{ color: "var(--lagoon)" }}>Pedir outro código</a></p>
          </>
        )}
        <p className="dim" style={{ fontSize: 13, textAlign: "center" }}><a href="/admin" style={{ color: "var(--lagoon)" }}>Voltar para a entrada</a></p>
      </form>
    </div>
  );
}
