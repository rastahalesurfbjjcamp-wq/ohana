import { MessageCircle } from "lucide-react";
import { Header, Panel } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { partnerArea } from "../data";
import { products } from "@/lib/store";
import { ProductLink, type PItem } from "./ProductLink";

const slug = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const dynamic = "force-dynamic";

export default async function Divulgar() {
  const { p, link, shortLink, first } = await partnerArea();
  const tag = p.kind === "embaixador" ? "Embaixador" : "athlete";
  const bio = `${p.kind === "embaixador" ? `Embaixador @rastahale` : `@rastahale athlete`} 🏷️ ${p.code}${shortLink ? `\n${shortLink}` : ""}`;
  const handle = (p.instagram ?? p.name ?? p.code).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "").toLowerCase().normalize("NFD").replace(/[^a-z0-9._ ]/g, "").trim().replace(/\s+/g, ".");
  const items: PItem[] = (await products().catch(() => []))
    .filter((x) => x.published !== false && (x.bundle || x.totalInventory > 0))
    .map((x) => ({ handle: x.handle || slug(x.title), title: x.title, image: x.image, price: Math.min(...x.variants.map((v) => v.price).filter((v) => v > 0), Infinity) }))
    .map((x) => ({ ...x, price: Number.isFinite(x.price) ? x.price : 0 }))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  const share = `Usa meu cupom ${p.code} na Rasta Hale${link ? `: ${link}` : ""}`;
  return (
    <>
      <Header title="Divulgar" lede="Seu cupom e seu link. Toda venda feita com eles gera comissão para você." />
      <div className="grid g2">
        <Panel title="Cupom e link">
          <small className="pt-lab">Seu cupom</small>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
            <div className="pt-code">{p.code}</div>
            <CopyButton text={p.code} label="Copiar cupom" className="btn sm" />
          </div>
          {link && (
            <>
              <small className="pt-lab" style={{ display: "block", marginTop: 18 }}>Seu link</small>
              <div className="pt-link"><code>{link}</code><CopyButton text={link} label="Copiar link" className="btn sm pri" /></div>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener"><MessageCircle size={15} /> Mandar no WhatsApp</a>
                <CopyButton text={share} label="Copiar mensagem" className="btn" />
              </div>
              <p className="dim" style={{ fontSize: 12.5, marginTop: 12 }}>O link abre a loja com o seu cupom e guarda a sua indicação por 1 dia. Se a pessoa voltar e comprar nesse prazo, a venda é sua, mesmo que o cupom não apareça no pedido.</p>
            </>
          )}
        </Panel>
        <Panel title="Dica" sub="Como ganhar mais">
          <div className="pt-tip">Quanto mais você divulgar o seu link, mais você ganha. Deixe na bio, use nos stories e mande sempre que alguém perguntar da sua roupa.</div>
          <ul className="pt-list">
            <li>Link na bio o tempo todo</li>
            <li>Story com o cupom quando postar treino ou sessão</li>
            <li>Mande o link direto para quem pedir</li>
          </ul>
        </Panel>
      </div>

      <Panel title="Divulgar um produto" sub="Vai postar uma peça? Gere o link dela aqui">
        <div className="pt-prod">
          <div className="stack" style={{ gap: 12 }}>
            <div className="pt-tip">Sempre que for mostrar uma peça, use o link gerado aqui. Ele leva a pessoa direto para o produto, já com o seu cupom, e guarda a sua indicação por 1 dia.</div>
            <div className="pt-warn">Se você mandar o link comum da loja, copiado do navegador, a venda só conta para você se a pessoa digitar o seu cupom na hora de pagar.</div>
            <small className="pt-lab" style={{ marginTop: 4 }}>Forma certa</small>
            <ol className="pt-list" style={{ marginTop: 0 }}>
              <li>Busque a peça que você vai mostrar</li>
              <li>Copie o link que aparece</li>
              <li>Coloque no story com a figurinha de link, ou mande no direct e no WhatsApp</li>
              <li>Fale o seu cupom {p.code} no vídeo ou na legenda</li>
            </ol>
          </div>
          <ProductLink code={p.code} items={items} />
        </div>
      </Panel>

      <Panel title="Coloque no seu perfil" sub="Mostre que você faz parte da Rasta Hale, com o seu cupom e o seu link">
        <div className="pt-bio">
          <div className="pt-ig">
            <span className="pt-ig-tag">Exemplo</span>
            <div className="pt-ig-top">
              <div className="pt-ig-av">{first.slice(0, 1).toUpperCase()}</div>
              <div className="pt-ig-st"><div><b>128</b><span>posts</span></div><div><b>3.420</b><span>seguidores</span></div><div><b>612</b><span>seguindo</span></div></div>
            </div>
            <div className="pt-ig-name">{p.name ?? p.code}</div>
            <div className="pt-ig-at">@{handle}</div>
            <div className="pt-ig-bio">{p.kind === "embaixador" ? <>Embaixador <span className="at">@rastahale</span></> : <><span className="at">@rastahale</span> {tag}</>} 🏷️ <b>{p.code}</b></div>
            {shortLink && <div className="pt-ig-link">{shortLink}</div>}
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <small className="pt-lab">Texto da bio</small>
            <pre className="pt-pre">{bio}</pre>
            <div className="row" style={{ gap: 8 }}>
              <CopyButton text={bio} label="Copiar bio" className="btn pri" />
              <CopyButton text={p.code} label="Copiar cupom" className="btn" />
              {link && <CopyButton text={link} label="Copiar link" className="btn" />}
            </div>
            <p className="dim" style={{ fontSize: 12.5 }}>No Instagram: Editar perfil, cole o texto na Bio e o link em Links.</p>
          </div>
        </div>
      </Panel>
    </>
  );
}
