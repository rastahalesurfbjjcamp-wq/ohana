import { redirect } from "next/navigation";
import { currentPartner } from "@/lib/partnerAuth";
import { entrarParceiro } from "../acoes";

export const dynamic = "force-dynamic";

export default async function Entrar({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await currentPartner()) redirect("/parceiro");
  const { e } = await searchParams;
  return (
    <div className="pp-auth">
      <form action={entrarParceiro}>
        <div className="pp-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lion.png" alt="" />
          <div><b>RASTA HALE</b><div className="pp-stripe"><i /><i /><i /></div></div>
        </div>
        <h1 className="tw">Área do parceiro</h1>
        <p>Entre para ver sua comissão, seu link de indicação e pedir saque.</p>
        {e && <div className="pp-msg err">{e === "muitas" ? "Muitas tentativas. Espere 15 minutos." : "E-mail ou senha incorretos."}</div>}
        <label>E-mail<input className="pp-f" name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input className="pp-f" name="password" type="password" autoComplete="current-password" required /></label>
        <button className="pp-btn" type="submit">Entrar</button>
        <p style={{ fontSize: 12.5 }}>Esqueceu a senha? Peça um novo link para a equipe da Rasta Hale.</p>
      </form>
    </div>
  );
}
