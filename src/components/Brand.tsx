// Logos das plataformas (pacote simple-icons), na cor de cada marca
import { siClaude, siGoogleads, siMeta, siShopify, siTiktok, siWhatsapp, type SimpleIcon } from "simple-icons";

const ICONS: Record<string, SimpleIcon> = { shopify: siShopify, meta: siMeta, tiktok: siTiktok, google: siGoogleads, whatsapp: siWhatsapp, claude: siClaude };

export function Brand({ name, size = 20 }: { name: keyof typeof ICONS | string; size?: number }) {
  const i = ICONS[name];
  if (!i) return null;
  const fill = i.hex === "000000" ? "#ffffff" : `#${i.hex}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={i.title}>
      <path d={i.path} fill={fill} />
    </svg>
  );
}
