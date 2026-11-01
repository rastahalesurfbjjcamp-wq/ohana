import { redirect } from "next/navigation";
import { currentPartner } from "@/lib/partnerAuth";
import { entrarParceiro } from "../acoes";
import { AuthCard } from "../AuthCard";

export const dynamic = "force-dynamic";

export default async function Entrar({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await currentPartner()) redirect("/parceiro");
  const { e } = await searchParams;
  return (
    <AuthCard action={entrarParceiro} sub="Área do parceiro">
      <p className="mut" style={{ fontSize: 14, lineHeight: 1.55, textAlign: "center" }}>Veja sua comissão, seu cupom e peça seus saques.</p>
      {e && <div className="err">{e === "muitas" ? "Muitas tentativas. Espere 15 minutos." : "E-mail ou senha incorretos."}</div>}
      <div className="field"><label htmlFor="email">E-mail</label><input className="in" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Senha</label><input className="in" id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <button className="btn pri" type="submit" style={{ justifyContent: "center", marginTop: 6 }}>Entrar</button>
      <p className="alt">Ainda não tem conta? <a href="/parceiro/cadastro">Criar conta</a></p>
    </AuthCard>
  );
}
