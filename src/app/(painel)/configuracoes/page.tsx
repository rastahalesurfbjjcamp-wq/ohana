import { Smartphone } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { evolution } from "@/lib/evolution";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { Header, Panel } from "@/components/ui";
import { saveSending, saveUser, waCreate, waLogout, waWebhook } from "../actions";

export const dynamic = "force-dynamic";

async function whatsapp() {
  try {
    const state = await evolution.connectionState();
    let qr: string | undefined;
    if (state !== "open" && state !== "not_created") {
      const c = await evolution.connect();
      qr = c.base64 ?? undefined;
    }
    return { state, qr, error: "" };
  } catch (e) {
    return { state: "error", qr: undefined, error: String(e).replace(/^Error: /, "").slice(0, 300) };
  }
}

const CHECK = (ok: boolean) => <span className={`chip ${ok ? "c-l" : "c-n"}`}>{ok ? "configurado" : "falta"}</span>;

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  const [wa, s, users] = await Promise.all([whatsapp(), getSettings(), db.user.findMany({ orderBy: { createdAt: "asc" } })]);
  const isAdmin = session?.role === "ADMIN";

  return (
    <>
      <Header title="Configurações" lede="WhatsApp, limites de envio e acessos do painel." />
      {sp.ok === "webhook" && <div className="ok">Webhook atualizado na Evolution.</div>}
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="WhatsApp" sub={`Instância “${env.evolutionInstance()}” na Evolution API`}>
          <div className="stack">
            {wa.state === "open" && (
              <div className="row">
                <span className="chip c-l"><i className="live" /> Conectado</span>
                {isAdmin && (
                  <>
                    <form action={waWebhook}><button className="btn sm" type="submit">Reconfigurar webhook</button></form>
                    <form action={waLogout}><button className="btn sm danger" type="submit">Desconectar número</button></form>
                  </>
                )}
              </div>
            )}
            {wa.state === "not_created" && (
              <>
                <p className="mut">A instância ainda não existe. Crie e depois leia o QR code com o WhatsApp do número dos grupos.</p>
                {isAdmin && <form action={waCreate}><button className="btn pri" type="submit"><Smartphone size={15} /> Criar instância</button></form>}
              </>
            )}
            {wa.state !== "open" && wa.state !== "not_created" && wa.state !== "error" && (
              <>
                <p className="mut">No celular: WhatsApp, Dispositivos conectados, Conectar um dispositivo. Depois recarregue esta página.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {wa.qr ? <img className="qr" src={wa.qr.startsWith("data:") ? wa.qr : `data:image/png;base64,${wa.qr}`} alt="QR code do WhatsApp" /> : <span className="dim">Gerando QR code, recarregue em alguns segundos.</span>}
              </>
            )}
            {wa.state === "error" && <div className="err">Não consegui falar com a Evolution API: {wa.error}</div>}
          </div>
        </Panel>
        <Panel title="Integrações" sub="As chaves ficam nas variáveis do servidor (Easypanel), nunca aqui.">
          <table className="tb">
            <tbody>
              <tr><td>Shopify</td><td className="r">{CHECK(!!env.shopifyDomain() && !!env.shopifyToken())}</td></tr>
              <tr><td>Meta Ads</td><td className="r">{CHECK(!!env.metaToken() && !!env.metaAdAccount())}</td></tr>
              <tr><td>IA (comandos e dica do dia)</td><td className="r">{CHECK(!!env.anthropicKey())}</td></tr>
              <tr><td>Transcrição de áudio</td><td className="r">{CHECK(!!env.transcribeKey())}</td></tr>
            </tbody>
          </table>
        </Panel>
      </div>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Proteção do número" sub="Limites para o WhatsApp não bloquear o número.">
          <form action={saveSending} className="stack">
            <div className="row">
              <div className="field" style={{ width: 170 }}>
                <label>Máximo por hora</label>
                <input className="in" name="maxPerHour" defaultValue={s.sending.maxPerHour} inputMode="numeric" />
              </div>
              <div className="field" style={{ width: 150 }}>
                <label>Intervalo mínimo (s)</label>
                <input className="in" name="minDelay" defaultValue={s.sending.minDelayMs / 1000} inputMode="numeric" />
              </div>
              <div className="field" style={{ width: 150 }}>
                <label>Intervalo máximo (s)</label>
                <input className="in" name="maxDelay" defaultValue={s.sending.maxDelayMs / 1000} inputMode="numeric" />
              </div>
            </div>
            <div>{isAdmin && <button className="btn" type="submit">Salvar</button>}</div>
          </form>
        </Panel>
        <Panel title="Acessos" sub="O WhatsApp de cada acesso pode dar comandos no grupo de resultados.">
          <div className="stack">
            {users.map((u) => (
              <form key={u.id} action={saveUser} className="stack" style={{ gap: 10, paddingBottom: 14, borderBottom: "1px solid var(--line2)" }}>
                <input type="hidden" name="id" value={u.id} />
                <div className="row" style={{ gap: 8 }}>
                  <b>{u.email}</b>
                  <span className="chip c-n">{u.role === "ADMIN" ? "administrador" : "equipe"}</span>
                </div>
                <div className="row">
                  <input className="in" name="name" defaultValue={u.name} placeholder="Nome" style={{ width: 160 }} />
                  <input className="in" name="phone" defaultValue={u.phone ?? ""} placeholder="WhatsApp com DDI, ex. 5521999998888" style={{ width: 240 }} />
                  <input className="in" name="password" type="password" placeholder="Nova senha (opcional)" autoComplete="new-password" style={{ width: 190 }} />
                  {isAdmin && <button className="btn sm" type="submit">Salvar</button>}
                </div>
              </form>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
