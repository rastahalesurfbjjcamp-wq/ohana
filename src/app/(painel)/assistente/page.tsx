import Link from "next/link";
import { Bot, Clock, MessageCircle, UserRoundCheck } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { creds } from "@/lib/integrations";
import { getSettings } from "@/lib/settings";
import { Header, Kpi, Panel } from "@/components/ui";
import { ToggleCard } from "@/components/fields";
import { AutoToggle } from "@/components/AutoToggle";
import { AssistantTester } from "@/components/AssistantTester";
import { saveAssistantKnowledge, testAssistant, toggleAutomation } from "../acoes4";

export const dynamic = "force-dynamic";

export default async function Assistente({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const [s, c] = await Promise.all([getSettings(), creds()]);
  const since = new Date(Date.now() - 30 * 864e5);
  const iaMsgs = await db.chatMessage.findMany({ where: { by: "ia", createdAt: { gte: since } }, select: { phone: true, createdAt: true } });
  const phones = [...new Set(iaMsgs.map((m) => m.phone))];
  const teamPhones = new Set((await db.chatMessage.findMany({ where: { by: "equipe", createdAt: { gte: since }, phone: { in: phones } }, select: { phone: true }, distinct: ["phone"] })).map((m) => m.phone));
  const solo = phones.filter((p) => !teamPhones.has(p)).length;
  // tempo de resposta: da mensagem do cliente até a resposta da IA (amostra)
  const sample = iaMsgs.slice(-60);
  const waits: number[] = [];
  for (const m of sample) {
    const prev = await db.chatMessage.findFirst({ where: { phone: m.phone, fromMe: false, createdAt: { lt: m.createdAt } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (prev) waits.push((m.createdAt.getTime() - prev.createdAt.getTime()) / 1000);
  }
  waits.sort((a, b) => a - b);
  const median = waits.length ? waits[Math.floor(waits.length / 2)] : null;
  const a = s.assistant;

  return (
    <>
      <Header title="Assistente com IA" lede="Responde no WhatsApp a qualquer hora, com os dados reais da loja. Quando não sabe, passa para a equipe.">
        <span className="row" style={{ gap: 10, fontSize: 13.5 }}>{a.enabled ? <span className="up">Ligado no WhatsApp</span> : <span className="mut">Desligado no WhatsApp</span>}<AutoToggle action={toggleAutomation} k="assistente" on={a.enabled} label="Os clientes que chamarem no privado" /></span>
      </Header>
      {sp.ok && <div className="ok">Salvo.</div>}
      {!c.ai.key && <div className="note">Conecte a IA em <Link href="/integracoes" style={{ textDecoration: "underline" }}>Integrações</Link> para o assistente funcionar.</div>}
      <div className="grid g4">
        <Kpi icon={<MessageCircle size={15} />} label="Conversas atendidas" value={phones.length.toLocaleString("pt-BR")} sub="nos últimos 30 dias" />
        <Kpi icon={<Bot size={15} />} tone="k" label="Resolvidas sozinha" value={<span className="up">{phones.length ? `${Math.round((solo / phones.length) * 100)}%` : "–"}</span>} sub="sem ninguém da equipe" />
        <Kpi icon={<Clock size={15} />} tone="s" label="Tempo de resposta" value={median == null ? "–" : median < 90 ? `${Math.round(median)} s` : `${Math.round(median / 60)} min`} sub="de dia e de madrugada" />
        <Kpi icon={<UserRoundCheck size={15} />} tone="p" label="Passadas para a equipe" value={teamPhones.size} sub="reclamação ou pedido de uma pessoa" />
      </div>
      <div className="cols" style={{ gridTemplateColumns: "380px minmax(0, 1fr)", alignItems: "start" }}>
        <AssistantTester action={testAssistant} store={env.storeName()} enabled={a.enabled} />
        <Panel title="O que o assistente sabe" sub="Ele só responde com base nisso. O teste ao lado usa estas regras.">
          <form action={saveAssistantKnowledge} className="know">
            <ToggleCard name="useOrders" defaultChecked={a.useOrders} title="Pedidos e rastreio" sub="Último pedido do cliente pelo número do WhatsApp, pagamento e rastreio da Shopify" />
            <ToggleCard name="useStock" defaultChecked={a.useStock} title="Preço e estoque por tamanho" sub="Produtos ativos da Shopify, atualizado a cada 2 minutos" />
            <ToggleCard name="useSizes" defaultChecked={a.useSizes} title="Tabela de medidas" sub="Para indicar o tamanho certo pela altura e peso">
              <textarea className="in" name="sizeTable" defaultValue={a.sizeTable} style={{ minHeight: 110 }} placeholder={"Ex.: Rashguard P: 1,60 a 1,70 m, até 65 kg\nM: 1,70 a 1,78 m, 65 a 78 kg\nG: 1,78 a 1,85 m, 78 a 90 kg"} />
            </ToggleCard>
            <ToggleCard name="useExchange" defaultChecked={a.useExchange} title="Política de troca" sub="Manda o link da página de troca">
              <textarea className="in" name="exchangeText" defaultValue={a.exchangeText} style={{ minHeight: 80 }} placeholder="Ex.: Troca de tamanho em até 7 dias pelo link rastahale.com.br/pages/trocas. O cliente paga só o frete de volta." />
            </ToggleCard>
            <ToggleCard name="handoff" defaultChecked={a.handoff} title="Passar para a equipe" sub="Reclamação, pedido atrasado ou cliente pedindo uma pessoa. Avisa no grupo de resultados." />
            <div className="field" style={{ marginTop: 6 }}>
              <label>Regras gerais e jeito de falar</label>
              <textarea className="in" name="instructions" defaultValue={a.instructions} style={{ minHeight: 110 }} />
            </div>
            <div><button className="btn pri" type="submit">Salvar</button></div>
          </form>
        </Panel>
      </div>
    </>
  );
}
