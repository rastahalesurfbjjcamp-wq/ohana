import { Check, Gift, Link2, Wallet } from "lucide-react";
import { ambProgram, BELTS } from "@/lib/ambassador";
import { brlc } from "@/lib/ledger";
import { cadastrarEmbaixador } from "./acoes";
import { IgField } from "./IgField";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seja embaixador Rasta Hale" };

const ERR: Record<string, string> = {
  campos: "Preencha todos os campos.",
  arroba: "Confira o @ do Instagram.",
  arroba2: "Os dois @ não estão iguais.",
  fone: "Confira o WhatsApp com DDD.",
  email: "Confira o e-mail.",
  curta: "A senha precisa ter pelo menos 8 caracteres.",
  igual: "As duas senhas não estão iguais.",
  existe: "Esse @ já tem cadastro. Entre com o seu e-mail e senha.",
  emailuso: "Esse e-mail já tem cadastro. Entre com ele.",
  foneuso: "Esse WhatsApp já tem cadastro. Fale com a gente.",
  nasc: "Confira a data de aniversário.",
};

export default async function Embaixador({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const { e, ok } = await searchParams;
  const p = await ambProgram();
  const first = p.levels[0];
  return (
    <div className="em">
      <header className="em-top">
        <div className="em-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lion.png" alt="" />
          <b>Rasta Hale</b>
        </div>
        <a className="btn sm" href="/parceiro/entrar">Já sou embaixador</a>
      </header>

      <section className="em-hero">
        <small className="em-kicker">Programa de embaixadores</small>
        <h1>Indique a Rasta Hale e ganhe a cada venda</h1>
        <p>Você recebe um cupom e um link só seus. Quem compra com eles ganha {brlc(p.clientOff * 100)} de desconto, e você ganha comissão em dinheiro, direto no Pix.</p>
        <a className="btn pri em-cta" href="#cadastro">Quero ser embaixador</a>
      </section>

      <section className="em-steps">
        <div className="em-step"><Link2 size={18} /><b>1. Cadastre-se</b><span>Preencha o formulário. A equipe analisa e aprova o seu cadastro.</span></div>
        <div className="em-step"><Gift size={18} /><b>2. Divulgue</b><span>Mande o seu link e o seu cupom. Quem comprar ganha {brlc(p.clientOff * 100)} de desconto.</span></div>
        <div className="em-step"><Wallet size={18} /><b>3. Receba</b><span>A partir de {brlc(p.minWithdrawCents)} acumulados, você pede o saque pelo painel.</span></div>
      </section>

      <section className="em-sec">
        <h2>Níveis</h2>
        <p className="em-lede">Todo embaixador começa no {first.name}. Quanto mais você indica, mais sobe de nível e maior fica a sua comissão.</p>
        <div className="em-levels">
          {p.levels.map((l, i) => (
            <div key={l.key} className={`em-lv lv-${l.key}${l.soon ? " soon" : ""}`}>
              <div className="em-lv-h"><i /> <b>{l.name}</b></div>
              {l.soon ? <div className="em-lv-v">Em breve</div> : <div className="em-lv-v">{l.pct.toLocaleString("pt-BR")}%<small> de comissão</small></div>}
              <div className="em-lv-r">{l.soon ? "Benefícios sendo preparados" : i === 0 ? "Ao ser aprovado" : `Ao acumular ${brlc(l.reachCents ?? 0)} em comissão`}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="em-sec">
        <h2>Como funciona</h2>
        <ul className="em-rules">
          <li><Check size={15} /> A comissão é sobre o valor da compra, já com o desconto e sem o frete.</li>
          <li><Check size={15} /> Só conta pedido pago. Pedido cancelado ou devolvido não conta.</li>
          <li><Check size={15} /> A venda é sua quando a pessoa usa o seu cupom ou compra pelo seu link em até 1 dia.</li>
          <li><Check size={15} /> Saque a partir de {brlc(p.minWithdrawCents)}, pago no Pix.</li>
          <li><Check size={15} /> No seu painel você acompanha vendas, comissão, nível e saques.</li>
        </ul>
      </section>

      <section className="em-sec" id="cadastro">
        {ok ? (
          <div className="em-done">
            <h2>Cadastro recebido</h2>
            <p>A equipe vai analisar e você recebe o aviso no WhatsApp assim que for aprovado. Depois disso é só entrar com o seu e-mail e senha.</p>
            <a className="btn" href="/parceiro/entrar">Ir para o login</a>
          </div>
        ) : (
          <form action={cadastrarEmbaixador} className="em-form">
            <div className="em-fh"><h2>Cadastro</h2><span>Leva 1 minuto. Seu cadastro passa pela aprovação da equipe.</span></div>
            {e && <div className="err">{ERR[e] ?? "Não deu certo, tente de novo."}</div>}
            <IgField />
            <div className="em-grid">
              <div className="field"><label htmlFor="name">Nome completo</label><input className="in" id="name" name="name" autoComplete="name" required /></div>
              <div className="field"><label htmlFor="phone">WhatsApp</label><input className="in" id="phone" name="phone" inputMode="tel" placeholder="(21) 99999-9999" required /></div>
            </div>
            <div className="em-grid">
              <div className="field"><label htmlFor="email">E-mail</label><input className="in" id="email" name="email" type="email" autoComplete="email" required /></div>
              <div className="field"><label htmlFor="birth">Data de aniversário</label><input className="in" id="birth" name="birth" type="date" min="1930-01-01" max={new Date().toISOString().slice(0, 10)} required /></div>
            </div>
            <div className="em-grid">
              <div className="field">
                <label htmlFor="belt">Faixa</label>
                <select className="in" id="belt" name="belt" required defaultValue="">
                  <option value="" disabled>Escolha</option>
                  {BELTS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Dá aula?</label>
                <div className="em-yn">
                  <label><input type="radio" name="teacher" value="sim" required /> Sim</label>
                  <label><input type="radio" name="teacher" value="nao" /> Não</label>
                </div>
              </div>
            </div>
            <div className="em-grid">
              <div className="field"><label htmlFor="password">Senha</label><input className="in" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
              <div className="field"><label htmlFor="again">Confirme a senha</label><input className="in" id="again" name="again" type="password" autoComplete="new-password" minLength={8} required /></div>
            </div>
            <button className="btn pri em-send" type="submit">Enviar cadastro</button>
          </form>
        )}
      </section>
      <footer className="em-foot">Rasta Hale · Surf e Jiu-Jitsu</footer>
    </div>
  );
}
