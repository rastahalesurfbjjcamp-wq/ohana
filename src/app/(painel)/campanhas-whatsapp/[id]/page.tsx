import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, Copy, Pause, Play, Send, Trash2, Workflow, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { brl } from "@/lib/time";
import { Header, Kpi, Panel } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PhonePreview } from "@/components/MessageEditor";
import { RFM_SEGMENTS, describe, type ARule } from "@/lib/audience";
import { mainPath, type Flow, type Node, type Part } from "@/lib/flowTypes";
import { CAMP_STATE, fmtAt } from "@/lib/campaignUi";
import { cancelCampaign, deleteCampaign, duplicateCampaign, pauseCampaign, resumeCampaign, scheduleCampaign, updateCampaign, type CampaignCfg } from "../../acoes12";

export const dynamic = "force-dynamic";

export default async function Campanha({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string; agendada?: string; erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const a = await db.automation.findUnique({ where: { id } });
  const cfg = a?.config as CampaignCfg | null;
  if (!a || !cfg?.campaign) notFound();
  const flow = (a.flow ?? {}) as Flow;
  const sends = mainPath(flow).map((k) => flow.nodes[k]).filter((n): n is Extract<Node, { type: "send" }> => n.type === "send");
  const tplIds = sends.map((n) => n.messageId).filter(Boolean) as string[];
  const [lists, tpls, list, runsAgg, active, msgs, clicked, conv] = await Promise.all([
    db.contactList.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { members: true } } } }),
    db.messageTemplate.findMany({ where: { id: { in: tplIds } } }),
    cfg.listId ? db.contactList.findUnique({ where: { id: cfg.listId }, include: { _count: { select: { members: true } } } }) : null,
    db.automationRun.aggregate({ where: { automationId: id }, _count: true, _sum: { value: true } }),
    db.automationRun.count({ where: { automationId: id, status: "ativo" } }),
    db.autoMsg.groupBy({ by: ["status"], where: { automationId: id }, _count: true }),
    db.automationRun.count({ where: { automationId: id, clicks: { gt: 0 } } }),
    db.automationRun.count({ where: { automationId: id, convertedAt: { not: null } } }),
  ]);
  const tplMap = new Map(tpls.map((t) => [t.id, (t.parts ?? []) as Part[]]));
  const sample = cfg.listId ? await db.listMember.findMany({ where: { listId: cfg.listId }, take: 6, orderBy: { createdAt: "desc" } }) : [];
  const editable = cfg.state === "rascunho" || cfg.state === "agendada";
  const st = CAMP_STATE[cfg.state] ?? CAMP_STATE.rascunho;
  const sent = msgs.reduce((s, x) => s + x._count, 0);
  const read = msgs.find((x) => x.status === "lida")?._count ?? 0;
  const deliv = (msgs.find((x) => x.status === "entregue")?._count ?? 0) + read;
  const count = list?._count.members ?? 0;
  const rfmOfList = list?.dynamic ? ((list.rules ?? []) as ARule[]).find((r) => r.field === "rfm")?.value : undefined;
  const ERR: Record<string, string> = { publico: "Escolha para quem vai a campanha.", mensagem: "A campanha precisa de pelo menos uma mensagem.", data: "Escolha a data e a hora." };

  return (
    <>
      <Header title={a.name} lede={`Campanha de WhatsApp · ${st.label}${cfg.at ? ` · ${fmtAt(cfg.at)}` : ""}`}>
        <Link className="btn" href="/campanhas-whatsapp"><ArrowLeft size={15} /> Campanhas</Link>
        <Link className="btn" href={`/automacoes/${id}/relatorio`}><BarChart3 size={15} /> Relatório</Link>
        <form action={duplicateCampaign}><input type="hidden" name="id" value={id} /><button className="btn" type="submit"><Copy size={15} /> Duplicar</button></form>
      </Header>
      {sp.salvo && <div className="ok">Salvo.</div>}
      {sp.agendada && <div className="ok">Campanha agendada para {fmtAt(cfg.at)}. Na hora, a lista é atualizada e as mensagens saem aos poucos.</div>}
      {sp.erro && <div className="err">{ERR[sp.erro] ?? "Confira os dados."}</div>}

      <div className="grid g4">
        <Kpi label="Público" value={count.toLocaleString("pt-BR")} sub={list ? list.name : "Escolha a lista"} tone="k" />
        <Kpi label="Mensagens enviadas" value={sent.toLocaleString("pt-BR")} sub={cfg.state === "enviando" ? `${active} ainda na fila` : `${runsAgg._count} pessoas entraram`} tone="l" />
        <Kpi label="Leitura" value={sent ? `${Math.round((read / sent) * 100)}%` : "-"} sub={`${sent ? Math.round((deliv / sent) * 100) : 0}% entregues · ${clicked} clicaram`} tone="s" />
        <Kpi label="Vendas" value={brl(runsAgg._sum.value ?? 0, 0)} sub={`${conv} pedidos pagos em até 7 dias`} tone="l" />
      </div>

      <div className="cols" style={{ gridTemplateColumns: "minmax(0, 1fr) 340px", alignItems: "start" }}>
        <div className="stack" style={{ gap: 16 }}>
          <Panel title="Configuração" sub={editable ? "Pode mudar até a hora do envio" : "Já começou, não dá para mudar o público e a data"}>
            <form action={updateCampaign} className="cp-form">
              <input type="hidden" name="id" value={id} />
              <label className="cv-field">Nome<input className="in" name="name" defaultValue={a.name} disabled={!editable} /></label>
              <label className="cv-field">Segmento (matriz RFM)
                <select className="in" name="rfm" defaultValue={rfmOfList ?? ""} disabled={!editable}><option value="">Usar a lista abaixo</option>{RFM_SEGMENTS.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}</select>
              </label>
              <label className="cv-field">Lista
                <select className="in" name="listId" defaultValue={rfmOfList ? "" : cfg.listId ?? ""} disabled={!editable}><option value="">Nenhuma</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l._count.members}){l.dynamic ? " · por regra" : ""}</option>)}</select>
              </label>
              <label className="cv-field">Quando (horário de Brasília)<input className="in" type="datetime-local" name="at" defaultValue={cfg.at ?? ""} disabled={!editable} /></label>
              {editable && <div><button className="btn sm" type="submit">Salvar</button></div>}
            </form>
            {list?.dynamic && <p className="cv-sum" style={{ marginTop: 12, fontSize: 12.5 }}>Quem entra: {describe((list.rules ?? []) as ARule[], list.mode, new Map(lists.map((l) => [l.id, l.name])))}. A lista é atualizada na hora do envio.</p>}
          </Panel>

          <Panel title="Ações">
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {cfg.state === "rascunho" && (
                <>
                  <form action={scheduleCampaign}><input type="hidden" name="id" value={id} /><ConfirmButton className="btn pri" message={`Agendar para ${fmtAt(cfg.at)}? Vai para ${count} pessoas.`}><Send size={15} /> Agendar</ConfirmButton></form>
                  <form action={scheduleCampaign}><input type="hidden" name="id" value={id} /><input type="hidden" name="now" value="1" /><ConfirmButton className="btn" message={`Começar a enviar agora para ${count} pessoas?`}>Enviar agora</ConfirmButton></form>
                </>
              )}
              {(cfg.state === "agendada" || cfg.state === "enviando") && <form action={pauseCampaign}><input type="hidden" name="id" value={id} /><button className="btn" type="submit"><Pause size={15} /> {cfg.state === "agendada" ? "Desagendar" : "Pausar envio"}</button></form>}
              {cfg.state === "pausada" && <form action={resumeCampaign}><input type="hidden" name="id" value={id} /><ConfirmButton className="btn pri" message="Retomar o envio de onde parou?"><Play size={15} /> Retomar</ConfirmButton></form>}
              {(cfg.state === "enviando" || cfg.state === "pausada" || cfg.state === "agendada") && <form action={cancelCampaign}><input type="hidden" name="id" value={id} /><ConfirmButton className="btn ghost danger" message="Cancelar a campanha? Quem ainda não recebeu não recebe mais."><XCircle size={15} /> Cancelar</ConfirmButton></form>}
              <Link className="btn" href={`/automacoes/${id}`}><Workflow size={15} /> Editar sequência</Link>
              {cfg.state !== "enviando" && <form action={deleteCampaign}><input type="hidden" name="id" value={id} /><ConfirmButton className="btn ghost danger" message="Apagar a campanha e o histórico dela?"><Trash2 size={15} /></ConfirmButton></form>}
            </div>
            <small className="dim" style={{ display: "block", marginTop: 10 }}>Na sequência dá para colocar mais mensagens, esperas e condições (por exemplo, mandar um lembrete só para quem não clicou). Quem pedir para sair (SAIR) não recebe.</small>
          </Panel>

          {sample.length > 0 && (
            <Panel title="Algumas pessoas da lista" body={false}>
              <table className="tb"><tbody>{sample.map((m) => <tr key={m.id}><td>{m.name ?? "Sem nome"}</td><td className="dim">{m.phone}</td><td className="dim" style={{ fontSize: 12 }}>{Object.entries((m.fields ?? {}) as Record<string, string>).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ")}</td></tr>)}</tbody></table>
            </Panel>
          )}
        </div>
        <Panel title="Mensagens" sub={`${sends.length} na sequência principal`}>
          {sends.length ? sends.map((n, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              {sends.length > 1 && <b style={{ fontSize: 12.5 }}>Mensagem {i + 1}</b>}
              <PhonePreview parts={n.messageId ? tplMap.get(n.messageId) ?? [] : n.parts} sample />
            </div>
          )) : <div className="dim" style={{ fontSize: 13 }}>Sem mensagem ainda. Clique em Editar sequência.</div>}
        </Panel>
      </div>
    </>
  );
}
