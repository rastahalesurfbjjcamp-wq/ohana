import Link from "next/link";
import { Check, MessageCircle, Megaphone, MessagesSquare, ReceiptText, Store } from "lucide-react";
import { onboardingSteps } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
const ICON = { store: Store, chat: MessageCircle, ads: Megaphone, tax: ReceiptText, groups: MessagesSquare };

export default async function Comecar() {
  const steps = await onboardingSteps();
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <div style={{ maxWidth: 760, margin: "30px auto 0", width: "100%" }}>
      <h1 style={{ fontSize: 34, letterSpacing: "-.03em" }}>Vamos deixar sua loja pronta</h1>
      <p className="mut" style={{ marginTop: 8 }}>5 passos, uns 10 minutos. Depois disso o painel já abre com os seus números.</p>
      <div className="row" style={{ gap: 14, margin: "22px 0", flexWrap: "nowrap" }}>
        <div className="lprog" style={{ flex: 1 }}><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
        <b>{done} de {steps.length}</b>
      </div>
      <div className="stack" style={{ gap: 12 }}>
        {steps.map((s, i) => {
          const I = ICON[s.icon];
          const isNext = next?.k === s.k;
          return (
            <div key={s.k} className={`ob${s.done ? " done" : ""}${isNext ? " next" : ""}`}>
              <span className="ob-n">{s.done ? <Check size={15} strokeWidth={3} /> : i + 1}</span>
              <span className="tile sm t-n"><I size={16} /></span>
              <div style={{ flex: 1 }}><b>{s.title}</b><small>{s.sub}</small></div>
              {s.done ? <span className="chip c-l"><Check size={11} /> Feito</span> : isNext ? <Link className="btn pri" href={s.href}>Fazer agora</Link> : <Link className="btn sm ghost" href={s.href}>a seguir</Link>}
            </div>
          );
        })}
      </div>
      {!next && <div className="ok" style={{ marginTop: 18 }}>Tudo pronto. <Link href="/" style={{ textDecoration: "underline" }}>Abrir a Visão geral</Link></div>}
    </div>
  );
}
