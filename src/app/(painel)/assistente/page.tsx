import { db } from "@/lib/db";
import { creds } from "@/lib/integrations";
import { getSettings } from "@/lib/settings";
import { Header, Kpi, Panel } from "@/components/ui";
import { saveAssistant } from "../acoes3";

export const dynamic = "force-dynamic";

export default async function Assistente({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const [s, c] = await Promise.all([getSettings(), creds()]);
  const since = new Date(Date.now() - 7 * 864e5);
  const [ai, team, handoffs] = await Promise.all([
    db.chatMessage.count({ where: { by: "ia", createdAt: { gte: since } } }),
    db.chatMessage.count({ where: { by: "equipe", createdAt: { gte: since } } }),
    db.chatThread.count({ where: { aiEnabled: false, lastAt: { gte: since } } }),
  ]);
  return (
    <>
      <Header title="Assistente IA" lede="Responde no WhatsApp dúvidas de tamanho, preço, estoque e status do pedido com os dados reais da loja. Quando é troca, reclamação ou algo que não sabe, chama a equipe no grupo de resultados." />
      {sp.ok && <div className="ok">Salvo.</div>}
      {!c.ai.key && <div className="note">Conecte a IA em Integrações para o assistente funcionar.</div>}
      <div className="grid g4">
        <Kpi label="Situação" value={s.assistant.enabled ? <span className="up">ligado</span> : "desligado"} />
        <Kpi label="Respostas da IA (7 dias)" value={ai} />
        <Kpi label="Respostas da equipe (7 dias)" value={team} />
        <Kpi label="Passadas para a equipe" value={handoffs} />
      </div>
      <Panel title="Configurar">
        <form action={saveAssistant} className="stack">
          <label className="check"><input type="checkbox" name="enabled" defaultChecked={s.assistant.enabled} /> Responder automaticamente no privado</label>
          <div className="field">
            <label>Regras da loja que a IA deve seguir</label>
            <textarea className="in" name="instructions" defaultValue={s.assistant.instructions} style={{ minHeight: 160 }} />
            <span className="hint">Ex.: política de troca, prazo de envio, formas de pagamento, tabela de medidas, tom de voz. Preço, estoque por tamanho e pedido do cliente a IA já busca sozinha na Shopify.</span>
          </div>
          <div><button className="btn pri" type="submit">Salvar</button></div>
        </form>
      </Panel>
    </>
  );
}
