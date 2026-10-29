import { Brand } from "@/components/Brand";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Mic, QrCode, ShieldCheck, X } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { creds, mask, storedProviders, type Provider } from "@/lib/integrations";
import { Header } from "@/components/ui";
import { disconnect, retest, saveProvider, wabaTest } from "./actions";
import { callbackUrl } from "@/lib/shopifyOauth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type Field = { name: string; label: string; secret?: boolean; placeholder?: string; current?: string };
type Card = { p: Provider; title: string; what: string; fields: Field[]; steps: string[] };

const SHOPIFY_MSG: Record<string, [string, boolean]> = {
  conectada: ["Shopify conectada com sucesso.", true],
  "faltam-dados": ["Preencha o endereço da loja, o Client ID e o Client secret do app antes de conectar.", false],
  "sessao-expirou": ["A conexão demorou demais. Clique em Conectar de novo.", false],
  "assinatura-invalida": ["A Shopify respondeu com uma assinatura que não confere. Confira o Client secret.", false],
  falhou: ["A Shopify não liberou o acesso. Tente de novo.", false],
};

export default async function Integracoes({ searchParams }: { searchParams: Promise<{ shopify?: string; abrir?: string }> }) {
  const sp = await searchParams;
  const [c, stored, statusRow, wa] = await Promise.all([
    creds(),
    storedProviders(),
    db.setting.findUnique({ where: { key: "_int_status" } }),
    db.setting.findUnique({ where: { key: "_whatsapp" } }),
  ]);
  const [settings, users, session] = await Promise.all([getSettings(), db.user.findMany({ select: { id: true, name: true, role: true, phone: true } }), getSession()]);
  const status = (statusRow?.value as Record<string, { ok: boolean; msg: string; at: string }>) ?? {};
  const waOn = (wa?.value as { state?: string } | undefined)?.state === "open";

  const cards: Card[] = [
    {
      p: "shopify",
      title: "Shopify",
      what: "Pedidos, produtos, estoque, clientes, conversão e origem das vendas.",
      fields: [
        { name: "domain", label: "Endereço da loja na Shopify", placeholder: "minhaloja.myshopify.com", current: c.shopify.domain },
        { name: "clientId", label: "Client ID do app", placeholder: "do Dev Dashboard da Shopify", current: c.shopify.clientId },
        { name: "clientSecret", label: "Client secret do app", secret: true, placeholder: "do Dev Dashboard da Shopify", current: mask(c.shopify.clientSecret) },
      ],
      steps: [
        "Em dev.shopify.com, crie um app (nome: Hub).",
        `Na versão do app, em URLs de redirecionamento, coloque: ${callbackUrl()}`,
        "Em Configurações do app, copie o Client ID e o Client secret e cole aqui. Salve e clique em Conectar com a Shopify.",
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
      p: "appmax",
      title: "Appmax (assinatura do clube)",
      what: "Cobrança mensal do clube de fidelidade por Pix e cartão, na própria página de assinatura.",
      fields: [
        { name: "clientId", label: "Client ID", placeholder: "credenciais de API da Appmax", current: c.appmax.clientId },
        { name: "clientSecret", label: "Client secret", secret: true, placeholder: "credenciais de API da Appmax", current: mask(c.appmax.clientSecret) },
        { name: "mode", label: "Ambiente (producao ou sandbox)", placeholder: "producao", current: c.appmax.mode },
      ],
      steps: [
        "No painel da Appmax, gere as credenciais de API (Client ID e Client secret) da loja e cole aqui.",
        `Cadastre o endereço de avisos (webhook): ${env.appUrl().replace(/\/$/, "")}/api/webhooks/appmax, com os eventos de pedido (Pix pago, aprovado, Pix expirado) e de assinatura (cobrança paga, recusada, cancelamento).`,
        `A página de assinatura fica em ${env.appUrl().replace(/\/$/, "")}/assinar. Para testar antes, use o ambiente sandbox.`,
      ],
    },
    {
      p: "waba",
      title: "WhatsApp · API oficial da Meta",
      what: "Mensagens com selo de empresa e botões, sem risco de bloqueio do número. Ideal para recuperação de carrinho e disparos grandes.",
      fields: [
        { name: "phoneId", label: "ID do número de telefone", placeholder: "Gerenciador do WhatsApp, Números de telefone", current: c.waba.phoneId },
        { name: "wabaId", label: "ID da conta do WhatsApp Business", placeholder: "para listar os modelos aprovados", current: c.waba.wabaId },
        { name: "token", label: "Token (deixe vazio para usar o mesmo do Meta Ads)", secret: true, placeholder: "EAA...", current: mask(c.waba.token) },
      ],
      steps: [
        "No app Rasta Hale Hub (developers.facebook.com), adicione o caso de uso WhatsApp e escolha a conta do WhatsApp Business do portfólio.",
        "Adicione o número e confirme pelo código. Use um número que não esteja no WhatsApp do celular (o da Evolution continua para os grupos).",
        "Em Usuários do sistema, atribua a conta do WhatsApp ao rastahalehub e gere o token com whatsapp_business_messaging e whatsapp_business_management (ou gere de novo o do Meta Ads com essas permissões).",
        `Em WhatsApp, Configuração, cadastre o webhook ${env.appUrl().replace(/\/$/, "")}/api/webhooks/whatsapp com o token de verificação ${c.waba.verify} e assine "messages".`,
        "Cole aqui o ID do número e o ID da conta, salve e mande um teste.",
      ],
    },
    {
      p: "ai",
      title: "Inteligência artificial (Claude)",
      what: "Assistente no WhatsApp, diagnóstico, comandos no grupo de resultados e dica do dia.",
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

  const open = sp.abrir ?? (sp.shopify ? "shopify" : undefined);
  const stateOf = (p: Provider) => {
    const card = cards.find((x) => x.p === p)!;
    const st = status[p];
    const configured = card.fields.every((f) => !!f.current);
    return st?.ok ? ["Conectado", "c-l"] : configured ? ["Não testado", "c-s"] : ["Conectar", "c-n"];
  };
  const Tile = ({ p, letter, tone, title, sub }: { p?: Provider; letter: ReactNode; tone: string; title: string; sub: string }) => {
    const [l, t] = p ? stateOf(p) : ["Em breve", "c-n"];
    const inner = (
      <>
        <span className={`tile ${tone}`} style={{ fontWeight: 800, fontSize: 15 }}>{letter}</span>
        <div style={{ flex: 1, minWidth: 0 }}><b>{title}</b><small>{sub}</small></div>
        <span className={`chip ${t}`}>{l}</span>
      </>
    );
    return p ? <Link href={open === p ? "/integracoes" : `/integracoes?abrir=${p}`} className={`itile${open === p ? " on" : ""}`}>{inner}</Link> : <div className="itile off">{inner}</div>;
  };
  const card = open ? cards.find((x) => x.p === open) : undefined;
  const Detail = () => {
    if (!card) return null;
    const st = status[card.p];
    const configured = card.fields.every((f) => !!(f.secret ? f.current : f.current));
    return (
      <section className="pnl" style={{ padding: 22 }}>
        <div className="row" style={{ justifyContent: "flex-end", marginBottom: -28 }}><Link className="menu-b" href="/integracoes" aria-label="Fechar"><X size={16} /></Link></div>
              <div className="stack">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <h3 style={{ fontSize: 15 }}>{card.title}</h3>
                      <p className="mut" style={{ fontSize: 13, marginTop: 4 }}>{card.what}</p>
                    </div>
                    <span className={`chip ${st?.ok ? "c-l" : configured ? "c-s" : "c-n"}`}>{st?.ok ? "conectado" : configured ? "não testado" : "não conectado"}</span>
                  </div>
                  {card.p === "shopify" && sp.shopify && SHOPIFY_MSG[sp.shopify] && (
                    <div className={SHOPIFY_MSG[sp.shopify][1] ? "ok" : "err"}>{SHOPIFY_MSG[sp.shopify][0]}</div>
                  )}
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
                      <button className="btn pri" type="submit">{card.p === "shopify" ? "Salvar" : "Salvar e testar"}</button>
                    </div>
                  </form>
                  {card.p === "shopify" && c.shopify.clientId && c.shopify.clientSecret && (
                    <a className="btn pri" href="/api/shopify/install" style={{ justifyContent: "center" }}>Conectar com a Shopify</a>
                  )}
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
  };

  return (
    <>
      <Header title="Integrações" lede="Tudo que o Hub puxa e conecta. As chaves ficam guardadas criptografadas e nunca aparecem inteiras de novo." />
      <div className="cols c-1-1">
        <section className="pnl" style={{ padding: 22 }}>
          <div className="row" style={{ gap: 12, flexWrap: "nowrap" }}>
            <span className="tile brand"><Brand name="whatsapp" /></span>
            <div style={{ flex: 1 }}><b style={{ fontSize: 15 }}>WhatsApp · Evolution</b><div className="dim" style={{ fontSize: 12.5 }}>grupos da comunidade, atendimento, disparos e relatório</div></div>
            <span className={`chip ${waOn ? "c-l" : "c-s"}`}>{waOn ? "Conectado" : "Aguardando QR"}</span>
          </div>
          <div className="mini3">
            <div><small>Proteção do número</small><b className="up">Ativa</b><div className="pips" style={{ marginTop: 8 }}><i /><i /><i /></div></div>
            <div><small>Limite por hora</small><b>{settings.sending.maxPerHour}</b><span className="dim" style={{ fontSize: 12 }}>com intervalo aleatório</span></div>
            <div><small>Intervalo</small><b>{Math.round(settings.sending.minDelayMs / 1000)} a {Math.round(settings.sending.maxDelayMs / 1000)} s</b><span className="dim" style={{ fontSize: 12 }}>entre mensagens</span></div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <Link className={`btn${waOn ? "" : " pri"}`} href="/configuracoes"><QrCode size={15} /> {waOn ? "Ver conexão" : "Conectar pelo QR code"}</Link>
            <Link className="btn ghost" href="/configuracoes"><ShieldCheck size={15} /> Ajustar proteção</Link>
          </div>
        </section>
        <section className="pnl" style={{ padding: 22 }}>
          <div className="row" style={{ gap: 12, flexWrap: "nowrap" }}>
            <span className="tile brand"><Brand name="whatsapp" /></span>
            <div style={{ flex: 1 }}><b style={{ fontSize: 15 }}>WhatsApp · API oficial da Meta</b><div className="dim" style={{ fontSize: 12.5 }}>selo de empresa, botões e sem risco de bloqueio</div></div>
            <span className={`chip ${stateOf("waba")[1]}`}>{stateOf("waba")[0]}</span>
          </div>
          <p className="mut" style={{ fontSize: 13, lineHeight: 1.55, marginTop: 14 }}>Pronta para conectar. Serve para recuperação de carrinho com botão e disparos grandes. A Meta cobra por conversa de marketing; respostas a quem chamou primeiro são grátis por 24 horas.</p>
          {status.waba?.msg && <p className={status.waba.ok ? "up" : "dn"} style={{ fontSize: 12.5, marginTop: 8 }}>{status.waba.msg}</p>}
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Link className="btn" href={open === "waba" ? "/integracoes" : "/integracoes?abrir=waba"}>{open === "waba" ? "Fechar" : "Configurar"}</Link>
            {c.waba.phoneId && (
              <form action={wabaTest} className="row" style={{ gap: 8 }}>
                <input className="in" name="phone" placeholder="55 21 99999-9999" style={{ height: 36, width: 170 }} />
                <button className="btn pri" type="submit">Mandar teste</button>
              </form>
            )}
          </div>
        </section>
      </div>

      {open === "waba" && <div style={{ marginTop: 16 }}><Detail /></div>}

      <h3 className="isec">Loja e vendas</h3>
      <div className="igrid">
        <Tile p="shopify" letter={<Brand name="shopify" />} tone="brand" title="Shopify" sub="pedidos, carrinhos, clientes, estoque, cupons" />
        <div className="itile off"><span className="tile t-p" style={{ fontWeight: 800 }}>A</span><div style={{ flex: 1 }}><b>Gateway de pagamento</b><small>Pix e cartão chegam pela Shopify</small></div><span className={`chip ${status.shopify?.ok ? "c-l" : "c-n"}`}>{status.shopify?.ok ? "Pela Shopify" : "Precisa da Shopify"}</span></div>
        <Tile p="appmax" letter="A" tone="t-s" title="Appmax (clube)" sub="assinatura mensal por Pix e cartão" />
        <div className="itile off"><span className="tile t-s" style={{ fontWeight: 800 }}>C</span><div style={{ flex: 1 }}><b>Correios e transportadoras</b><small>rastreio que a Olist manda para a Shopify</small></div><span className={`chip ${status.shopify?.ok ? "c-l" : "c-n"}`}>{status.shopify?.ok ? "Pela Shopify" : "Precisa da Shopify"}</span></div>
      </div>
      {(open === "shopify" || open === "appmax") && <Detail />}

      <h3 className="isec">Anúncios</h3>
      <div className="igrid">
        <Tile p="meta" letter={<Brand name="meta" />} tone="brand" title="Meta Ads" sub={c.meta.adAccount ? `conta ${c.meta.adAccount} · gasto e campanhas` : "gasto, campanhas e leads"} />
        <Tile letter={<Brand name="google" />} tone="brand" title="Google Ads" sub="gasto e campanhas" />
        <Tile letter={<Brand name="tiktok" />} tone="brand" title="TikTok Ads" sub="gasto e campanhas" />
      </div>
      {open === "meta" && <Detail />}

      <h3 className="isec">Inteligência</h3>
      <div className="igrid">
        <Tile p="ai" letter={<Brand name="claude" />} tone="brand" title="Claude (IA)" sub="assistente, diagnóstico, comandos e dica do dia" />
        <Tile p="transcribe" letter={<Mic size={17} />} tone="t-s" title="Transcrição de áudio" sub="entende áudios no grupo e no atendimento" />
      </div>
      {(open === "ai" || open === "transcribe") && <Detail />}

      <h3 className="isec">Equipe · {users.length} acesso{users.length > 1 ? "s" : ""}</h3>
      <div className="igrid">
        {users.map((u) => (
          <Link key={u.id} href="/configuracoes" className="itile">
            <span className="av-s" style={{ width: 42, height: 42 }}>{u.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</span>
            <div style={{ flex: 1 }}><b>{u.name}{u.name === session?.name ? " (você)" : ""}</b><small>{u.role === "ADMIN" ? "Administrador · acesso total" : "Equipe"}{u.phone ? " · número para comandos" : ""}</small></div>
            <span className="chip c-l">Ativo</span>
          </Link>
        ))}
        <Link href="/configuracoes" className="itile"><span className="tile t-s"><Bell size={17} /></span><div style={{ flex: 1 }}><b>Alertas no WhatsApp</b><small>atendimento passado para a equipe e relatório no grupo de resultados</small></div><span className="chip c-l">Ligado</span></Link>
      </div>
    </>
  );
}
