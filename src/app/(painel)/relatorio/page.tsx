import { Send } from "lucide-react";
import { db } from "@/lib/db";
import { dailyReport } from "@/lib/report";
import { getSettings } from "@/lib/settings";
import { Header, Panel } from "@/components/ui";
import { saveReport, sendReportNow } from "../actions";

export const dynamic = "force-dynamic";

const ITEMS = [
  ["revenue", "Faturamento e pedidos"],
  ["ads", "Gasto com anúncios"],
  ["profit", "Lucro"],
  ["conversion", "Conversão da loja"],
  ["champion", "Produto campeão"],
  ["tip", "Dica da IA para amanhã"],
  ["groups", "Entradas e saídas dos grupos"],
] as const;
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function Relatorio({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const results = await db.group.findMany({ where: { isResults: true } });
  let preview = "";
  try {
    preview = await dailyReport();
  } catch (e) {
    preview = `Não consegui montar a prévia: ${String(e).replace(/^Error: /, "")}`;
  }
  const commands = await db.commandLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Header
        title="Relatório diário"
        lede={`Enviado todo dia às ${s.report.time} no grupo de resultados. No grupo também dá para pedir números e lançar custos por texto ou áudio.`}
      />
      {sp.ok && <div className="ok">Relatório enviado no grupo de resultados.</div>}
      {(sp.erro || !results.length) && <div className="note">Marque um grupo como “Resultados” na página Grupos para receber o relatório e usar os comandos.</div>}
      <div className="grid g2" style={{ alignItems: "start" }}>
        <Panel
          title="Prévia de hoje"
          sub={results.length ? `Vai para: ${results.map((g) => g.name).join(", ")}` : undefined}
          right={
            <form action={sendReportNow} className="row" style={{ gap: 6 }}>
              <select className="in" name="periodo" defaultValue="hoje" style={{ height: 32, width: 110 }}>
                <option value="hoje">Hoje</option>
                <option value="ontem">Ontem</option>
                <option value="semana">Semana</option>
                <option value="mes">Mês</option>
              </select>
              <button className="btn sm" type="submit" disabled={!results.length}>
                <Send size={13} /> Enviar agora
              </button>
            </form>
          }
        >
          <div className="pre">{preview}</div>
        </Panel>
        <Panel title="Configurar">
          <form action={saveReport} className="stack">
            <label className="check">
              <input type="checkbox" name="enabled" defaultChecked={s.report.enabled} /> Enviar o relatório do dia
            </label>
            <div className="field">
              <label>Horário</label>
              <input className="in" type="time" name="time" defaultValue={s.report.time} style={{ maxWidth: 140 }} />
            </div>
            <div className="field">
              <label>O que aparece</label>
              <div className="stack" style={{ gap: 8 }}>
                {ITEMS.map(([k, label]) => (
                  <label key={k} className="check">
                    <input type="checkbox" name={`i_${k}`} defaultChecked={s.report.items[k]} /> {label}
                  </label>
                ))}
              </div>
            </div>
            <label className="check">
              <input type="checkbox" name="weeklyEnabled" defaultChecked={s.report.weeklyEnabled} /> Mandar também o resumo da semana
            </label>
            <div className="row">
              <select className="in" name="weeklyDay" defaultValue={s.report.weeklyDay} style={{ width: 150 }}>
                {DIAS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
              <input className="in" type="time" name="weeklyTime" defaultValue={s.report.weeklyTime} style={{ width: 130 }} />
            </div>
            <div>
              <button className="btn pri" type="submit">Salvar</button>
            </div>
          </form>
        </Panel>
      </div>
      <Panel title="Comandos recebidos no grupo" sub="Exemplos: “relatório de ontem”, “lança 89 reais de ferramenta todo mês”, “200 unidades da Pura por 11 mil”." body={false}>
        {commands.length ? (
          <table className="tb">
            <tbody>
              {commands.map((c) => (
                <tr key={c.id}>
                  <td style={{ width: 110 }} className="dim">{fmt.format(c.createdAt)}</td>
                  <td>
                    {c.wasAudio && <span className="chip c-k" style={{ marginRight: 8 }}>áudio</span>}
                    {c.input}
                  </td>
                  <td className="r">
                    <span className={`chip ${c.status === "error" ? "c-c" : c.status === "awaiting_confirmation" ? "c-s" : c.status === "canceled" ? "c-n" : "c-l"}`}>
                      {{ done: "respondido", awaiting_confirmation: "aguardando ok", confirmed: "lançado", canceled: "cancelado", error: "erro" }[c.status] ?? c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">Nenhum comando ainda.</div>
        )}
      </Panel>
    </>
  );
}
