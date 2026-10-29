import Link from "next/link";
import { db } from "@/lib/db";
import { creds, mask, storedProviders, type Provider } from "@/lib/integrations";
import { Header } from "@/components/ui";
import { disconnect, retest, saveProvider } from "./actions";

export const dynamic = "force-dynamic";

type Field = { name: string; label: string; secret?: boolean; placeholder?: string; current?: string };
type Card = { p: Provider; title: string; what: string; fields: Field[]; steps: string[] };

export default async function Integracoes() {
  const [c, stored, statusRow, wa] = await Promise.all([
    creds(),
    storedProviders(),
    db.setting.findUnique({ where: { key: "_int_status" } }),
    db.setting.findUnique({ where: { key: "_whatsapp" } }),
  ]);
  const status = (statusRow?.value as Record<string, { ok: boolean; msg: string; at: string }>) ?? {};
  const waOn = (wa?.value as { state?: string } | undefined)?.state === "open";

  const cards: Card[] = [
    {
      p: "shopify",
      title: "Shopify",
      what: "Pedidos, produtos, estoque, clientes, conversão e origem das vendas.",
      fields: [
        { name: "domain", label: "Endereço da loja na Shopify", placeholder: "minhaloja.myshopify.com", current: c.shopify.domain },
        { name: "token", label: "Token de acesso da Admin API", secret: true, placeholder: "shpat_...", current: mask(c.shopify.token) },
      ],
      steps: [
        "No admin da Shopify: Configurações, Apps e canais de vendas, Desenvolver apps, Criar um app (nome: Hub).",
        "Configurar escopos da Admin API e marcar: read_orders, read_all_orders, read_products, read_inventory, read_customers, read_reports, read_analytics, read_checkouts.",
        "Instalar app, copiar o token de acesso da Admin API (começa com shpat_) e colar aqui.",
      ],
    },
    {
      p: "meta",
      title: "Meta Ads",
      what: "Gasto com anúncios no relatório, lucro real e o que o Meta diz que vendeu.",
      fields: [
        { name: "adAccount", label: "ID da conta de anúncios", placeholder: "só os números, ex.: 123456789", current: c.meta.adAccount },
        { name: "token", label: "Token de acesso", secret: true, placeholder: "EAA...", current: mask(c.meta.token) },
      ],
      steps: [
        "No Gerenciador de Negócios: Configurações do negócio, Usuários do sistema, Adicionar (função Administrador).",
        "Atribuir ativos: a conta de anúncios, com acesso de leitura.",
        "Gerar novo token com a permissão ads_read, sem prazo de validade, e colar aqui. O ID da conta aparece no Gerenciador de Anúncios.",
      ],
    },
    {
      p: "ai",
      title: "Inteligência artificial (Claude)",
      what: "Comandos no grupo de resultados, dica do dia e, em breve, diagnóstico e assistente.",
      fields: [{ name: "key", label: "Chave da API da Anthropic", secret: true, placeholder: "sk-ant-...", current: mask(c.ai.key) }],
      steps: ["Em console.anthropic.com: API Keys, Create Key, copiar e colar aqui.", "Coloque um limite de gasto mensal em Billing para ter controle."],
    },
    {
      p: "transcribe",
      title: "Transcrição de áudio",
      what: "Entende os áudios mandados no grupo de resultados.",
      fields: [{ name: "key", label: "Chave da OpenAI", secret: true, placeholder: "sk-...", current: mask(c.transcribe.key) }],
      steps: ["Em platform.openai.com: API keys, Create new secret key, copiar e colar aqui. O custo fica em centavos por mês."],
    },
  ];

  return (
    <>
      <Header title="Integrações" lede="Conecte as ferramentas da loja. As chaves ficam guardadas criptografadas e nunca aparecem inteiras de novo." />
      <section className="pnl" style={{ padding: 20 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 15 }}>WhatsApp</h3>
            <p className="mut" style={{ fontSize: 13, marginTop: 4 }}>Grupos, entradas e saídas, agendamentos, disparos e o grupo de resultados.</p>
          </div>
          <div className="row">
            <span className={`chip ${waOn ? "c-l" : "c-c"}`}>{waOn ? "conectado" : "desconectado"}</span>
            <Link className="btn sm" href="/configuracoes">{waOn ? "Ver conexão" : "Conectar pelo QR code"}</Link>
          </div>
        </div>
      </section>
      <div className="grid g2" style={{ alignItems: "start" }}>
        {cards.map((card) => {
          const st = status[card.p];
          const configured = card.fields.every((f) => !!(f.secret ? f.current : f.current));
          return (
            <section className="pnl" key={card.p} style={{ padding: 20 }}>
              <div className="stack">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ fontSize: 15 }}>{card.title}</h3>
                    <p className="mut" style={{ fontSize: 13, marginTop: 4 }}>{card.what}</p>
                  </div>
                  <span className={`chip ${st?.ok ? "c-l" : configured ? "c-s" : "c-n"}`}>{st?.ok ? "conectado" : configured ? "não testado" : "não conectado"}</span>
                </div>
                {st && <div className={st.ok ? "ok" : "err"}>{st.msg}</div>}
                <form action={saveProvider} className="stack" autoComplete="off">
                  <input type="hidden" name="provider" value={card.p} />
                  {card.fields.map((f) => (
                    <div className="field" key={f.name}>
                      <label>{f.label}</label>
                      <input
                        className="in"
                        name={f.name}
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        data-1p-ignore
                        data-lpignore="true"
                        data-form-type="other"
                        style={f.secret ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties) : undefined}
                        placeholder={f.secret && f.current ? `${f.current} (deixe vazio para manter)` : f.placeholder}
                        defaultValue={f.secret ? "" : f.current ?? ""}
                      />
                    </div>
                  ))}
                  <div className="row">
                    <button className="btn pri" type="submit">Salvar e testar</button>
                  </div>
                </form>
                <div className="row">
                  <form action={retest}><input type="hidden" name="provider" value={card.p} /><button className="btn sm">Testar de novo</button></form>
                  {stored.has(card.p) && (
                    <form action={disconnect}><input type="hidden" name="provider" value={card.p} /><button className="btn sm danger">Desconectar</button></form>
                  )}
                </div>
                <details>
                  <summary className="mut" style={{ cursor: "pointer", fontSize: 13 }}>Como conseguir</summary>
                  <ol className="stack explain" style={{ gap: 6, paddingLeft: 18, marginTop: 8 }}>
                    {card.steps.map((s) => <li key={s}>{s}</li>)}
                  </ol>
                </details>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
