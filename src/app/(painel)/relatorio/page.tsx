import { CheckCheck, Info, Send } from "lucide-react";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { dailyReport } from "@/lib/report";
import { getSettings } from "@/lib/settings";
import { addDays, isoDayLocal } from "@/lib/time";
import { Panel } from "@/components/ui";
import { ChoiceCards, TimeField } from "@/components/fields";
import { saveReport, sendReportNow } from "../actions";

export const dynamic = "force-dynamic";

const ITEMS = [
  ["revenue", "Faturamento e pedidos"],
  ["ads", "Investido em anúncios"],
  ["profit", "Lucro do dia"],
  ["conversion", "Taxa de conversão"],
  ["champion", "Produto campeão"],
  ["tip", "Uma sugestão da IA"],
  ["groups", "Entradas e saídas dos grupos"],
] as const;
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Mostra o texto como no WhatsApp: *negrito* e quebras de linha
function wa(text: string): ReactNode[] {
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {line.split(/\*([^*]+)\*/g).map((part, j) => (j % 2 ? <b key={j}>{part}</b> : part))}
      <br />
    </span>
  ));
}

export default async function Relatorio({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const [results, admins] = await Promise.all([db.group.findMany({ where: { isResults: true } }), db.user.findMany({ where: { phone: { not: null }, role: "ADMIN" } })]);
  let preview = "";
  try {
    preview = await dailyReport(addDays(isoDayLocal(), -1));
  } catch (e) {
    preview = `Não consegui montar a prévia: ${String(e).replace(/^Error: /, "")}`;
  }
  const commands = await db.commandLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const groupName = results[0]?.name ?? `${env.storeName()}, Resultados`;

  return (
    <>
      <form action={saveReport}>
        <div className="hd" style={{ marginBottom: 22 }}>
          <div style={{ flex: 1 }}>
            <h1>Relatório diário</h1>
            <p className="lede">No fim do dia, o resumo da loja chega no WhatsApp, sem precisar abrir o sistema. No grupo também dá para pedir números e lançar custos por texto ou áudio.</p>
          </div>
          <div className="acts">
            <button className="btn" type="submit" formAction={sendReportNow}><Send size={15} /> Enviar teste agora</button>
            <button className="btn pri" type="submit"><CheckCheck size={15} /> Salvar</button>
          </div>
        </div>
        {sp.ok && <div className="ok" style={{ marginBottom: 16 }}>Relatório enviado.</div>}
        {(sp.erro || !results.length) && <div className="note" style={{ marginBottom: 16 }}>Marque um grupo como Resultados na página Grupos para receber o relatório no grupo e usar os comandos.</div>}
        <div className="cols" style={{ gridTemplateColumns: "minmax(0, 1fr) 360px", alignItems: "start" }}>
          <section className="pnl" style={{ padding: 22 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Onde recebe</h3>
              <label className="check" style={{ fontSize: 13 }}><input type="checkbox" name="enabled" defaultChecked={s.report.enabled} /> Mandar todo dia</label>
            </div>
            <ChoiceCards name="target" defaultValue={s.report.target ?? "grupo"} options={[
              { value: "grupo", title: `Grupo "${groupName}"`, sub: results.length ? "Você e a equipe recebem juntos" : "Marque o grupo em Grupos" },
              { value: "privado", title: "No meu privado", sub: admins.length ? "Só para o seu número" : "Cadastre seu número em Configurações" },
            ]} />
            <div className="row" style={{ marginTop: 14, alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Horário</label><TimeField name="time" defaultValue={s.report.time} label="todo dia" /></div>
              <div className="field" style={{ flex: 1, minWidth: 260 }}>
                <label>Resumo da semana</label>
                <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                  <select className="in" name="weeklyDay" defaultValue={s.report.weeklyDay} style={{ height: 46 }}>{DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
                  <TimeField name="weeklyTime" defaultValue={s.report.weeklyTime} />
                </div>
              </div>
            </div>
            <label className="check" style={{ marginTop: 10, fontSize: 13 }}><input type="checkbox" name="weeklyEnabled" defaultChecked={s.report.weeklyEnabled} /> Mandar o resumo da semana</label>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: "22px 0 12px" }}>O que vem no relatório</h3>
            <div className="ckgrid">
              {ITEMS.map(([k, label]) => (
                <label key={k} className="ckcard"><input type="checkbox" name={`i_${k}`} defaultChecked={s.report.items[k]} /> {label}</label>
              ))}
            </div>
            <div className="row" style={{ marginTop: 18, gap: 10, alignItems: "center" }}>
              <span className="dim" style={{ fontSize: 12.5 }}>Enviar teste de:</span>
              <select className="in" name="periodo" defaultValue="ontem" style={{ height: 34, width: 130 }}>
                <option value="hoje">Hoje</option>
                <option value="ontem">Ontem</option>
                <option value="semana">Semana</option>
                <option value="mes">Mês</option>
              </select>
            </div>
            <div className="callout" style={{ marginTop: 18, background: "#0f1312", border: "1px solid #222826", color: "var(--ink2)" }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>O envio sai do número conectado ao Hub. Os números da prévia ao lado são os reais da loja de ontem.</div>
            </div>
          </section>
          <div className="phone wa-group" style={{ position: "sticky", top: 20, minHeight: 560 }}>
            <div className="phone-h">
              <span className="phone-av">{env.storeName().slice(0, 1)}</span>
              <div><b>{s.report.target === "privado" ? env.storeName() : groupName}</b><small>{s.report.target === "privado" ? "mensagem no privado" : "você e a equipe"}</small></div>
            </div>
            <div className="phone-b">
              <div className="wmsg"><div style={{ padding: "6px 8px 0" }}>{wa(preview)}</div><span className="wtime">{s.report.time}</span></div>
            </div>
          </div>
        </div>
      </form>
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
