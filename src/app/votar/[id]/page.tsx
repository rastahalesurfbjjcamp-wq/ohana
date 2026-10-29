// Página de votação fechada: só quem está na comunidade vota, fotos com marca d'água.
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { normalizePhone } from "@/lib/segments";

export const dynamic = "force-dynamic";

async function votar(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const option = Number(formData.get("option"));
  const poll = await db.poll.findUnique({ where: { id } });
  if (!poll || poll.status !== "aberta") redirect(`/votar/${id}?e=fechada`);
  if (!phone || !(option >= 0 && option < poll.options.length)) redirect(`/votar/${id}?e=dados`);
  const communitySize = await db.membership.count({ where: { leftAt: null, group: { isCommunity: true } } });
  if (communitySize > 0) {
    const member = await db.membership.findFirst({ where: { leftAt: null, group: { isCommunity: true }, contact: { phone } } });
    if (!member) redirect(`/votar/${id}?e=fora`);
  }
  await db.pollVote.upsert({ where: { pollId_phone: { pollId: id, phone } }, create: { pollId: id, phone, option }, update: { option } });
  redirect(`/votar/${id}?ok=1`);
}

export default async function Votar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; e?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const poll = await db.poll.findUnique({ where: { id } });
  if (!poll) notFound();
  const store = env.storeName();
  const errors: Record<string, string> = {
    fora: "Esse número não está nos grupos da comunidade. A votação é só para quem está nos grupos.",
    dados: "Confira o WhatsApp e escolha uma opção.",
    fechada: "Esta votação já foi encerrada.",
  };
  return (
    <div className="login" style={{ alignItems: "start", paddingTop: 40 }}>
      <form action={votar} className="pnl card stack" style={{ maxWidth: 560 }}>
        <input type="hidden" name="id" value={poll.id} />
        <div className="brand"><div className="mark">H</div><div><b>{store}</b><small>Votação exclusiva da comunidade</small></div></div>
        <h1 style={{ fontSize: 24 }}>{poll.question}</h1>
        {sp.ok && <div className="ok">Voto registrado. Obrigado por construir com a gente!</div>}
        {sp.e && <div className="err">{errors[sp.e] ?? "Não deu certo, tente de novo."}</div>}
        {poll.status !== "aberta" && !sp.e && <div className="note">Votação encerrada.</div>}
        <div className="stack" style={{ gap: 10 }}>
          {poll.options.map((o, i) => (
            <label key={i} className="pnl" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center", cursor: "pointer", borderRadius: 14 }}>
              <input type="radio" name="option" value={i} required style={{ accentColor: "var(--lagoon)", width: 18, height: 18 }} />
              {poll.imageUrls[i] && (
                <span style={{ position: "relative", width: 120, height: 120, flexShrink: 0, borderRadius: 10, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={poll.imageUrls[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", userSelect: "none" }} draggable={false} />
                  <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.35)", fontFamily: "Elite", fontSize: 13, transform: "rotate(-30deg)", pointerEvents: "none", textAlign: "center" }}>
                    {store}<br />exclusivo
                  </span>
                </span>
              )}
              <span style={{ fontSize: 15 }}>{o}</span>
            </label>
          ))}
        </div>
        <div className="field">
          <label>Seu WhatsApp (o mesmo do grupo)</label>
          <input className="in" name="phone" inputMode="tel" placeholder="(21) 99999-9999" required />
        </div>
        <button className="btn pri" type="submit" disabled={poll.status !== "aberta"} style={{ justifyContent: "center" }}>Votar</button>
        <p className="dim" style={{ fontSize: 12 }}>Não compartilhe as imagens: elas ainda não foram lançadas.</p>
      </form>
    </div>
  );
}
