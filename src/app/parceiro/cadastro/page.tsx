import { redirect } from "next/navigation";
import { currentPartner } from "@/lib/partnerAuth";
import { cadastrarParceiro } from "../acoes";
import { AuthCard } from "../AuthCard";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  campos: "Preencha todos os campos.",
  arroba: "Confira o @ do Instagram.",
  fone: "Confira o WhatsApp com DDD.",
  email: "Confira o e-mail.",
  curta: "A senha precisa ter pelo menos 8 caracteres.",
  igual: "As duas senhas não estão iguais.",
  existe: "Esse @ já tem conta. Entre com o seu e-mail e senha.",
  emailuso: "Esse e-mail já tem conta. Entre com ele.",
  confere: "Esse @ já está cadastrado com outro WhatsApp. Use o mesmo número que a equipe tem ou fale com a gente.",
  foneuso: "Esse WhatsApp já está em outro cadastro. Fale com a equipe.",
};

export default async function Cadastro({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await currentPartner()) redirect("/parceiro");
  const { e } = await searchParams;
  return (
    <AuthCard action={cadastrarParceiro} sub="Criar conta de parceiro">
      <p className="mut" style={{ fontSize: 14, lineHeight: 1.55, textAlign: "center" }}>Se você já tem cupom na loja, a gente encontra pelo seu @. Se não tiver, seu cupom é criado agora.</p>
      {e && <div className="err">{ERR[e] ?? "Não deu certo, tente de novo."}</div>}
      <div className="field"><label htmlFor="ig">@ do Instagram</label><div className="pre">@<input className="in" id="ig" name="instagram" placeholder="seuarroba" autoCapitalize="none" required /></div></div>
      <div className="field"><label htmlFor="name">Nome completo</label><input className="in" id="name" name="name" autoComplete="name" required /></div>
      <div className="field"><label htmlFor="phone">WhatsApp</label><input className="in" id="phone" name="phone" inputMode="tel" placeholder="(21) 99999-9999" required /></div>
      <div className="field"><label htmlFor="email">E-mail</label><input className="in" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Senha</label><input className="in" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
      <div className="field"><label htmlFor="again">Repita a senha</label><input className="in" id="again" name="again" type="password" autoComplete="new-password" minLength={8} required /></div>
      <button className="btn pri" type="submit" style={{ justifyContent: "center", marginTop: 6 }}>Criar conta</button>
      <p className="alt">Já tem conta? <a href="/parceiro/entrar">Entrar</a></p>
    </AuthCard>
  );
}
