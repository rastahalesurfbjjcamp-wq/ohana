import { NumberInput } from "@/components/NumberInput";
import Link from "next/link";
import { Smartphone } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";
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
                <Link className="btn sm pri" href="/grupos">Escolher os grupos</Link>
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
                <p className="mut">Clique para gerar o QR code e conecte o WhatsApp do número que está nos grupos.</p>
                {isAdmin && <form action={waCreate}><button className="btn pri" type="submit"><Smartphone size={15} /> Conectar WhatsApp</button></form>}
              </>
            )}
            {wa.state !== "open" && wa.state !== "not_created" && wa.state !== "error" && (
              <>
                <AutoRefresh seconds={5} />
                <p className="mut">No celular do número dos grupos: WhatsApp, Dispositivos conectados, Conectar um dispositivo, e aponte para o QR code. Quando conectar, esta página muda sozinha e os grupos aparecem em Grupos para você escolher.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {wa.qr ? <img className="qr" src={wa.qr.startsWith("data:") ? wa.qr : `data:image/png;base64,${wa.qr}`} alt="QR code do WhatsApp" /> : <span className="dim">Gerando QR code...</span>}
              </>
            )}
            {wa.state === "error" && <div className="err">Não consegui falar com a Evolution API: {wa.error}</div>}
          </div>
        </Panel>
        <Panel title="Integrações" sub="Shopify, Meta Ads, IA e transcrição agora se conectam pela aba Integrações.">
          <Link className="btn pri" href="/integracoes">Abrir Integrações</Link>
        </Panel>
      </div>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Proteção do número" sub="Limites para o WhatsApp não bloquear o número.">
          <form action={saveSending} className="stack">
            <div className="row">
              <div className="field" style={{ width: 170 }}>
                <label>Máximo por hora</label>
                <NumberInput name="maxPerHour" defaultValue={s.sending.maxPerHour} step={5} min={1} suffix="/h" />
              </div>
              <div className="field" style={{ width: 150 }}>
                <label>Intervalo mínimo (s)</label>
                <NumberInput name="minDelay" defaultValue={s.sending.minDelayMs / 1000} suffix="seg" />
              </div>
              <div className="field" style={{ width: 150 }}>
                <label>Intervalo máximo (s)</label>
                <NumberInput name="maxDelay" defaultValue={s.sending.maxDelayMs / 1000} suffix="seg" />
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
