import { Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { creds } from "@/lib/integrations";
import { Header, Panel } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { generateDiagnosis } from "../acoes3";

export const dynamic = "force-dynamic";

export default async function Diagnostico({ searchParams }: { searchParams: Promise<{ erro?: string; id?: string }> }) {
  const sp = await searchParams;
  const [c, list] = await Promise.all([creds(), db.diagnosis.findMany({ orderBy: { createdAt: "desc" }, take: 10 })]);
  const current = list.find((d) => d.id === sp.id) ?? list[0];
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <>
      <Header title="Diagnóstico com IA" lede="A IA olha vendas, anúncios, conversão, estoque, recuperação e comunidade dos últimos 30 dias e diz o que fazer primeiro.">
        <form action={generateDiagnosis}>
          <button className="btn pri" type="submit" disabled={!c.ai.key}><Sparkles size={15} /> Gerar diagnóstico agora</button>
        </form>
      </Header>
      {!c.ai.key && <div className="note">Conecte a IA em Integrações para gerar o diagnóstico.</div>}
      {sp.erro && <div className="err">{sp.erro}</div>}
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(200px,1fr)", alignItems: "start" }}>
        <Panel title={current ? `Diagnóstico de ${fmt.format(current.createdAt)}` : "Nenhum diagnóstico ainda"}>
          {current ? <Markdown text={current.content} /> : <p className="mut">Clique em “Gerar diagnóstico agora”. Leva uns 20 segundos.</p>}
        </Panel>
        <Panel title="Anteriores" body={false}>
          <table className="tb"><tbody>
            {list.map((d) => (
              <tr key={d.id}><td><a href={`/diagnostico?id=${d.id}`} style={d.id === current?.id ? { color: "var(--lagoon)" } : undefined}>{fmt.format(d.createdAt)}</a></td></tr>
            ))}
          </tbody></table>
        </Panel>
      </div>
    </>
  );
}
