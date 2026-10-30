// Na demonstração, ações que mexeriam em contas, senhas ou conexões ficam travadas.
import { redirect } from "next/navigation";

export function demoBlock(back = "/?demo=bloqueado") {
  if (process.env.DEMO_MODE === "1") redirect(back);
}
