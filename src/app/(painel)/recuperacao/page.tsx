import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { brl, pct } from "@/lib/time";
import { Header, Kpi, Panel } from "@/components/ui";
import { saveRecovery, stopCase } from "../acoes3";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { carrinho: "Carrinho abandonado", pix: "Pix ou boleto pendente", rastreio: "Aviso de rastreio", avaliacao: "Pedido de avaliação" };
const ST: Record<string, [string, string]> = {
  ativo: ["em andamento", "c-k"], recuperado: ["recuperado", "c-l"], concluido: ["concluído", "c-n"], sem_resposta: ["sem resposta", "c-n"], parado: ["parado", "c-n"],
};

function StepFields({ prefix, i, step }: { prefix: string; i: number; step?: { delayMin: number; text: string } }) {
  const hours = step && step.delayMin >= 60 && step.delayMin % 60 === 0;
  return (
    <div className="stack" style={{ gap: 6, padding: 12, border: "1px solid var(--line)", borderRadius: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <b style={{ fontSize: 13 }}>Mensagem {i + 1}</b>
        <span className="dim" style={{ fontSize: 12 }}>enviar</span>
        <input className="in" name={`${prefix}${i}_delay`} defaultValue={step ? (hours ? step.delayMin / 60 : step.delayMin) : ""} style={{ width: 70, height: 32 }} inputMode="numeric" />
        <select className="in" name={`${prefix}${i}_unit`} defaultValue={hours ? "h" : "m"} style={{ width: 110, height: 32 }}>
          <option value="m">minutos</option>
          <option value="h">horas</option>
        </select>
        <span className="dim" style={{ fontSize: 12 }}>depois</span>
      </div>
      <textarea className="in" name={`${prefix}${i}_text`} defaultValue={step?.text ?? ""} style={{ minHeight: 70 }} placeholder="Deixe vazio para não usar" />
    </div>
  );
}

export default async function Recuperacao({ searchParams }: { searchParams: Promise<{ k?: string; ok?: string }> }) {
  const sp = await searchParams;
  const k = sp.k ?? "todos";
  const s = await getSettings();
  const since = new Date(Date.now() - 30 * 864e5);
  const [cases, monthCases] = await Promise.all([
    db.recoveryCase.findMany({ where: k === "todos" ? {} : { kind: k }, orderBy: { createdAt: "desc" }, take: 120 }),
    db.recoveryCase.findMany({ where: { createdAt: { gte: since }, kind: { in: ["carrinho", "pix"] } } }),
  ]);
  const recovered = monthCases.filter((c) => c.status === "recuperado");
  const contacted = monthCases.filter((c) => c.sentCount > 0);
  const value = recovered.reduce((a, c) => a + (c.recoveredValue ?? c.value), 0);
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const anyOn = s.recovery.cartEnabled || s.recovery.pixEnabled || s.recovery.trackingEnabled;

  return (
    <>
      <Header title="Recuperação" lede="Mensagens automáticas no WhatsApp para quem abandonou o carrinho, gerou Pix ou boleto e não pagou, e para avisar o rastreio. Cada uma pode ser ligada e editada aqui." />
      {sp.ok && <div className="ok">Salvo.</div>}
      {!anyOn && <div className="note">Tudo desligado por enquanto. Ligue cada automação abaixo quando quiser começar. Só entram carrinhos e pedidos criados depois de ligar.</div>}
      <div className="grid g4">
        <Kpi label="Recuperado (30 dias)" value={<span className="up">{brl(value, 0)}</span>} sub={`${recovered.length} vendas`} />
        <Kpi label="Taxa de recuperação" value={contacted.length ? pct(recovered.length / contacted.length, 0) : "–"} sub={`${contacted.length} pessoas avisadas`} />
        <Kpi label="Em andamento" value={monthCases.filter((c) => c.status === "ativo").length} />
        <Kpi label="Carrinhos x Pix" value={`${monthCases.filter((c) => c.kind === "carrinho").length} / ${monthCases.filter((c) => c.kind === "pix").length}`} sub="nos últimos 30 dias" />
      </div>
      <div className="tabs">
        {[["todos", "Tudo"], ["carrinho", "Carrinhos"], ["pix", "Pix e boleto"], ["rastreio", "Rastreio"], ["avaliacao", "Avaliação"]].map(([key, label]) => (
          <a key={key} href={`/recuperacao?k=${key}`} className={k === key ? "on" : ""}>{label}</a>
        ))}
      </div>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel title="Casos" body={false}>
          {cases.length ? (
            <table className="tb">
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b style={{ fontWeight: 550 }}>{c.name ?? formatPhone(c.phone)}</b>
                      <div className="dim" style={{ fontSize: 12 }}>
                        {KIND[c.kind] ?? c.kind}{c.orderName ? ` · ${c.orderName}` : ""}{c.product ? ` · ${c.product}` : ""}
                      </div>
                      <div className="dim" style={{ fontSize: 12 }}>{fmt.format(c.createdAt)} · {c.sentCount} mensagem(ns)</div>
                    </td>
                    <td className="r">{c.value ? brl(c.value, 0) : ""}</td>
                    <td><span className={`chip ${(ST[c.status] ?? ST.parado)[1]}`}>{(ST[c.status] ?? [c.status])[0]}</span></td>
                    <td className="r" style={{ width: 80 }}>
                      {c.status === "ativo" && (
                        <form action={stopCase}><input type="hidden" name="id" value={c.id} /><button className="btn sm">Parar</button></form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Nenhum caso ainda. Eles aparecem aqui assim que as automações forem ligadas e a Shopify estiver conectada.</div>
          )}
        </Panel>
        <Panel title="Configurar mensagens" sub="{nome}, {produto}, {valor}, {pedido}, {link} e {rastreio} são trocados pelos dados de cada pessoa.">
          <form action={saveRecovery} className="stack">
            <label className="check"><input type="checkbox" name="cartEnabled" defaultChecked={s.recovery.cartEnabled} /> <b>Carrinho abandonado</b></label>
            {[0, 1, 2].map((i) => <StepFields key={i} prefix="cart" i={i} step={s.recovery.cartSteps[i]} />)}
            <label className="check" style={{ marginTop: 8 }}><input type="checkbox" name="pixEnabled" defaultChecked={s.recovery.pixEnabled} /> <b>Pix ou boleto gerado e não pago</b></label>
            {[0, 1].map((i) => <StepFields key={i} prefix="pix" i={i} step={s.recovery.pixSteps[i]} />)}
            <label className="check" style={{ marginTop: 8 }}><input type="checkbox" name="trackingEnabled" defaultChecked={s.recovery.trackingEnabled} /> <b>Aviso de rastreio quando o pedido é enviado</b></label>
            <textarea className="in" name="trackingText" defaultValue={s.recovery.trackingText} style={{ minHeight: 70 }} />
            <div className="row">
              <span className="mut" style={{ fontSize: 13 }}>Considerar entrega atrasada depois de</span>
              <input className="in" name="delayedDays" defaultValue={s.recovery.delayedDays} style={{ width: 70, height: 32 }} inputMode="numeric" />
              <span className="mut" style={{ fontSize: 13 }}>dias</span>
            </div>
            <p className="dim" style={{ fontSize: 12 }}>Cartão recusado: a Shopify trata como checkout não concluído, então entra na recuperação de carrinho.</p>
            <div><button className="btn pri" type="submit">Salvar</button></div>
          </form>
        </Panel>
      </div>
    </>
  );
}
