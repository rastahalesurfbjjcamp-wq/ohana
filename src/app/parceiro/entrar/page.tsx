import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { currentPartner } from "@/lib/partnerAuth";
import { entrarParceiro } from "../acoes";
import { AuthCard } from "../AuthCard";

export const dynamic = "force-dynamic";

export default async function Entrar({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await currentPartner()) redirect("/parceiro");
  const { e } = await searchParams;
  const h = await headers();
  const amb = (h.get("x-forwarded-host") ?? h.get("host") ?? "").startsWith("embaixador.");
  return (
    <AuthCard action={entrarParceiro} sub={amb ? "Área do embaixador" : "Área do parceiro"}>
      <p className="mut" style={{ fontSize: 14, lineHeight: 1.55, textAlign: "center" }}>Veja sua comissão, seu cupom e peça seus saques.</p>
      {e && <div className="err">{e === "muitas" ? "Muitas tentativas. Espere 15 minutos." : e === "analise" ? "Seu cadastro de embaixador ainda está em análise. Você recebe o aviso no WhatsApp quando for aprovado." : "E-mail ou senha incorretos."}</div>}
      <div className="field"><label htmlFor="email">E-mail</label><input className="in" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Senha</label><input className="in" id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <button className="btn pri" type="submit" style={{ justifyContent: "center", marginTop: 6 }}>Entrar</button>
      {amb ? <p className="alt">Ainda não é embaixador? <Link href="/">Faça seu cadastro</Link></p> : <p className="alt">Ainda não tem conta? <a href="/parceiro/cadastro">Criar conta</a></p>}
    </AuthCard>
  );
}
