import Link from "next/link";
import { FlaskConical, Plus, Rocket } from "lucide-react";
import { db } from "@/lib/db";
import { CONDS, TRIGGERS } from "@/lib/funnels";
import { FunnelBuilder, type FStep } from "@/components/FunnelBuilder";
import { saveFunnel, testFunnel, toggleFunnel } from "../acoes3";

export const dynamic = "force-dynamic";

export default async function Funis({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string; novo?: string; teste?: string; erro?: string }> }) {
  const sp = await searchParams;
  const funnels = await db.funnel.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { runs: true } } } });
  const cur = sp.novo ? undefined : funnels.find((f) => f.id === sp.e) ?? funnels[0];
  const runs = cur ? await db.funnelRun.groupBy({ by: ["status"], where: { funnelId: cur.id }, _count: true }) : [];
  const c = (k: string) => runs.find((r) => r.status === k)?._count ?? 0;

  return (
    <>
      <form action={saveFunnel} encType="multipart/form-data">
        <div className="hd" style={{ marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="dim" style={{ fontSize: 13 }}><Link href="/funis" className="dim">Funis</Link> /</div>
            <h1 className="row" style={{ gap: 12 }}>{cur?.name ?? "Novo funil"} {cur && <span className={`chip ${cur.active ? "c-l" : "c-n"}`} style={{ fontSize: 12 }}><span className="live-dot" style={{ width: 6, height: 6, display: cur.active ? "inline-block" : "none" }} /> {cur.active ? "Ativo" : "Desligado"}</span>}</h1>
          </div>
          <div className="acts">
            {cur && <button className="btn" type="submit" formAction={testFunnel} formNoValidate name="id_test" value={cur.id}><FlaskConical size={15} /> Testar no meu número</button>}
            <button className="btn pri" type="submit"><Rocket size={15} /> Salvar e publicar</button>
          </div>
        </div>
        {sp.ok && <div className="ok" style={{ marginBottom: 12 }}>Funil salvo.</div>}
        {sp.teste && <div className="ok" style={{ marginBottom: 12 }}>Mensagens do funil mandadas para o número conectado.</div>}
        {sp.erro && <div className="err" style={{ marginBottom: 12 }}>Não achei o número conectado para o teste.</div>}
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <div className="chips">
            {funnels.map((f) => <Link key={f.id} href={`/funis?e=${f.id}`} className={cur?.id === f.id ? "on" : ""}>{f.name}<b>{f._count.runs}</b></Link>)}
            <Link href="/funis?novo=1" className={!cur ? "on" : ""}><Plus size={13} /> Novo</Link>
          </div>
        </div>
        <FunnelBuilder key={cur?.id ?? "novo"} id={cur?.id} name={cur?.name ?? ""} trigger={cur?.trigger ?? "lead_novo"} active={cur?.active ?? true} steps={(cur?.steps as FStep[]) ?? []}
          triggers={TRIGGERS} conds={CONDS} stats={{ running: c("ativo"), done: c("concluido"), total: cur?._count.runs ?? 0 }} />
      </form>
      {cur && (
        <form action={toggleFunnel} style={{ marginTop: 10 }}>
          <input type="hidden" name="id" value={cur.id} />
          <button className="btn ghost sm" type="submit">{cur.active ? "Desligar este funil" : "Ligar este funil"}</button>
        </form>
      )}
    </>
  );
}
