// Conexão da Shopify com um clique (OAuth de app do Dev Dashboard).
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const SHOPIFY_SCOPES = [
  "read_orders", "write_draft_orders", "read_draft_orders", "read_products", "read_inventory", "read_customers", "write_customers",
  "read_reports", "read_analytics", "read_checkouts", "read_discounts", "write_discounts", "read_fulfillments",
].join(",");

export const callbackUrl = () => `${env.appUrl().replace(/\/$/, "")}/api/shopify/callback`;

export function normalizeShop(input: string) {
  let s = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}

// Confere a assinatura que a Shopify manda na volta
export function validHmac(params: URLSearchParams, secret: string) {
  const hmac = params.get("hmac") ?? "";
  const msg = [...params.entries()].filter(([k]) => k !== "hmac" && k !== "signature").sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
  const digest = createHmac("sha256", secret).update(msg).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}
