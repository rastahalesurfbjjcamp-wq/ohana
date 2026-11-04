import { redirect } from "next/navigation";
import { MessageCircle, Plus, RefreshCcw, ShieldCheck, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth";
import { AREAS, ADMIN_ONLY, LITE_HREFS } from "@/lib/access";
import { Header, Panel } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { approveMember, createMember, removeMember, resendInvite, toggleMember, updateMember } from "../acoes15";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = { dados: "Preencha o nome e um e-mail válido.", email: "Já existe um acesso com esse e-mail.", voce: "Você não pode tirar o seu próprio acesso de administrador." };
const ago = (d: Date | null) => {
  if (!d) return "nunca entrou";
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  return m < 60 ? `entrou há ${m} min` : m < 1440 ? `entrou há ${Math.round(m / 60)} h` : `entrou há ${Math.round(m / 1440)} dias`;
};

function Areas({ value, disabled }: { value: string[]; disabled?: boolean }) {
  return (
    <div className="eq-areas">
      {AREAS.map((g) => ({ ...g, items: g.items.filter((i) => !ADMIN_ONLY.includes(i.href) && (process.env.HUB_LITE !== "1" || LITE_HREFS.includes(i.href))) })).filter((g) => g.items.length).map((g) => (
        <fieldset key={g.group} disabled={disabled}>
          <legend>{g.group}</legend>
          {g.items.map((i) => (
            <label key={i.href}><input type="checkbox" name="areas" value={i.href} defaultChecked={value.includes(i.href)} /> {i.label}</label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

export default async function Equipe({ searchParams }: { searchParams: Promise<{ convite?: string; erro?: string; salvo?: string; novo?: string; editar?: string; aprovado?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (session?.role !== "ADMIN") redirect("/");
  const users = await db.user.findMany({ orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  const inv = sp.convite ? users.find((u) => u.id === sp.convite) : undefined;
  const link = (t: string | null) => (t ? `${env.appUrl().replace(/\/$/, "")}/convite/${t}` : "");
  const invText = inv ? `Oi ${inv.name.split(" ")[0]}! Criei seu acesso ao ${env.storeName()} Hub. Abra o link para criar sua senha: ${link(inv.inviteToken)}\n\nSeu login é ${inv.email}. O link vale por 7 dias.` : "";
  return (
    <>
      <Header title="Equipe e acessos" lede="Quem entra no Hub e o que cada pessoa pode ver. A própria pessoa cria a senha pelo link de convite." />
      {sp.erro && <div className="err">{ERR[sp.erro] ?? "Confira os dados."}</div>}
      {sp.salvo && <div className="ok">Acesso atualizado. Vale a partir da próxima página que a pessoa abrir.</div>}
      {inv && inv.inviteToken && (
        <div className="eq-inv">
          <b>Convite de {inv.name}</b>
          <p className="mut">Mande este link para a pessoa. Ela cria a senha e já entra. Vale por 7 dias.</p>
          <div className="eq-link"><code>{link(inv.inviteToken)}</code><CopyButton text={invText} label="Copiar mensagem" className="btn sm" />{inv.phone && <a className="btn sm pri" href={`https://wa.me/${inv.phone}?text=${encodeURIComponent(invText)}`} target="_blank" rel="noopener"><MessageCircle size={14} /> Mandar no WhatsApp</a>}</div>
        </div>
      )}

      {sp.aprovado && <div className="ok">Acesso aprovado. A pessoa já pode entrar em {env.appUrl().replace(/^https?:\/\//, "").replace(/\/$/, "")}/admin.</div>}
      {users.some((u) => u.pendingAt) && (
        <Panel title="Pedidos de acesso" sub="Se cadastraram em /admin/cadastro e esperam sua aprovação. Entram com acesso a tudo, menos Equipe e Integrações." body={false}>
          <table className="tb" data-nosort>
            <tbody>
              {users.filter((u) => u.pendingAt).map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b><br /><small className="dim">{u.email}{u.phone ? ` · ${u.phone}` : ""}</small></td>
                  <td className="dim" style={{ fontSize: 12.5 }}>pedido em {u.pendingAt!.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <form action={approveMember}><input type="hidden" name="id" value={u.id} /><button className="btn sm pri" type="submit">Aprovar</button></form>
                      <form action={removeMember}><input type="hidden" name="id" value={u.id} /><ConfirmButton className="btn sm ghost danger" message={`Recusar o pedido de ${u.name}?`}>Recusar</ConfirmButton></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel title="Pessoas com acesso" sub={`${users.filter((u) => u.active).length} ativas`} body={false} right={<a className="btn sm pri" href="/equipe?novo=1"><Plus size={14} /> Adicionar pessoa</a>}>
        <table className="tb">
          <thead><tr><th>Pessoa</th><th>Acesso</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {users.filter((u) => !u.pendingAt).map((u) => (
              <tr key={u.id}>
                <td><div className="row" style={{ gap: 10 }}><span className="av-s">{u.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</span><span><b>{u.name}{u.id === session.userId ? " (você)" : ""}</b><br /><small className="dim">{u.email}</small></span></div></td>
                <td>{u.role === "ADMIN" ? <span className="chip c-l"><ShieldCheck size={12} /> Administrador</span> : <span className="chip c-n"><UserRound size={12} /> Equipe · {u.areas.length ? `${u.areas.length} telas` : "tudo menos integrações"}</span>}</td>
                <td className="dim" style={{ fontSize: 12.5 }}>{!u.active ? <span className="chip c-c">Desativado</span> : !u.passwordHash ? <span className="chip c-s">Convite enviado</span> : ago(u.lastLoginAt)}</td>
                <td>
                  <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                    <a className="btn sm" href={`/equipe?editar=${u.id}`}>Editar</a>
                    {u.id !== session.userId && (
                      <>
                        <form action={resendInvite}><input type="hidden" name="id" value={u.id} /><button className="btn sm ghost" title={u.passwordHash ? "Gerar link para trocar a senha" : "Gerar novo convite"}><RefreshCcw size={13} /> {u.passwordHash ? "Nova senha" : "Convite"}</button></form>
                        <form action={toggleMember}><input type="hidden" name="id" value={u.id} /><ConfirmButton className="btn sm ghost" message={u.active ? `Desativar o acesso de ${u.name}? A pessoa sai do Hub na hora.` : `Reativar o acesso de ${u.name}?`}>{u.active ? "Desativar" : "Reativar"}</ConfirmButton></form>
                        {!u.active && <form action={removeMember}><input type="hidden" name="id" value={u.id} /><ConfirmButton className="btn sm ghost danger" message={`Apagar ${u.name} de vez?`}>Apagar</ConfirmButton></form>}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {sp.novo && (
        <Panel title="Adicionar pessoa" sub="Depois de salvar, aparece o link de convite para mandar.">
          <form action={createMember} className="stack" style={{ gap: 12 }}>
            <div className="eq-row">
              <label className="cv-field">Nome<input className="in" name="name" required /></label>
              <label className="cv-field">E-mail (é o login)<input className="in" name="email" type="email" required /></label>
              <label className="cv-field">WhatsApp (para mandar o convite)<input className="in" name="phone" placeholder="5521999999999" /></label>
              <label className="cv-field">Tipo de acesso<select className="in" name="role" defaultValue="TEAM"><option value="TEAM">Equipe (escolho as telas)</option><option value="ADMIN">Administrador (tudo)</option></select></label>
            </div>
            <div className="cv-field">Telas liberadas para a equipe <small className="dim">Sem nenhuma marcada, vê tudo menos Integrações e Equipe.</small></div>
            <Areas value={[]} />
            <div><button className="btn pri" type="submit">Criar acesso e gerar convite</button></div>
          </form>
        </Panel>
      )}

      {sp.editar && (() => {
        const u = users.find((x) => x.id === sp.editar);
        if (!u) return null;
        return (
          <Panel title={`Editar ${u.name}`} sub={u.email}>
            <form action={updateMember} className="stack" style={{ gap: 12 }}>
              <input type="hidden" name="id" value={u.id} />
              <div className="eq-row">
                <label className="cv-field">Nome<input className="in" name="name" defaultValue={u.name} /></label>
                <label className="cv-field">WhatsApp<input className="in" name="phone" defaultValue={u.phone ?? ""} /></label>
                <label className="cv-field">Tipo de acesso<select className="in" name="role" defaultValue={u.role}><option value="TEAM">Equipe (escolho as telas)</option><option value="ADMIN">Administrador (tudo)</option></select></label>
              </div>
              <div className="cv-field">Telas liberadas (vale só para equipe)</div>
              <Areas value={u.areas} />
              <div><button className="btn pri" type="submit">Salvar</button></div>
            </form>
          </Panel>
        );
      })()}
    </>
  );
}
