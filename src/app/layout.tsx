import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: `${process.env.STORE_NAME ?? "Minha loja"} Hub`,
  description: "Comunidade, vendas e lucro da loja num lugar só",
  appleWebApp: { capable: true, title: `${process.env.STORE_NAME ?? "Minha loja"} Hub`, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0e0d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
