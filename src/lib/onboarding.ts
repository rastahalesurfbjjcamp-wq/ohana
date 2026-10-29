// Passos para deixar a loja pronta no Hub (serve para o cliente novo)
import { db } from "./db";

export async function onboardingSteps() {
  const [status, wa, costs, groups] = await Promise.all([
    db.setting.findUnique({ where: { key: "_int_status" } }),
    db.setting.findUnique({ where: { key: "_whatsapp" } }),
    db.setting.findUnique({ where: { key: "costs" } }),
    db.group.count({ where: { isCommunity: true, archived: false } }),
  ]);
  const st = (status?.value as Record<string, { ok: boolean }> | undefined) ?? {};
  return [
    { k: "loja", title: "Conectar a loja", sub: "Shopify: pedidos, clientes, estoque e conversão", done: !!st.shopify?.ok, href: "/integracoes?abrir=shopify", icon: "store" },
    { k: "whats", title: "Conectar o WhatsApp", sub: "O número da loja, pelo QR code", done: (wa?.value as { state?: string } | undefined)?.state === "open", href: "/configuracoes", icon: "chat" },
    { k: "ads", title: "Conectar os anúncios", sub: "Meta Ads: gasto, campanhas e lucro real", done: !!st.meta?.ok, href: "/integracoes?abrir=meta", icon: "ads" },
    { k: "impostos", title: "Impostos e taxas", sub: "Preencher uma vez, leva 2 minutos", done: !!costs, href: "/custos", icon: "tax" },
    { k: "grupos", title: "Escolher os grupos", sub: "O Hub lê os grupos do número conectado", done: groups > 0, href: "/grupos?v=escolher", icon: "groups" },
  ] as const;
}
