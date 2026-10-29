import type { Metadata, Viewport } from "next";
import "./globals.css";

// lido na hora (e não na compilação), para a aba mostrar o nome da loja
export async function generateMetadata(): Promise<Metadata> {
  const name = `${process.env.STORE_NAME || "Minha loja"} Hub`;
  return { title: name, description: "Comunidade, vendas e lucro da loja num lugar só", appleWebApp: { capable: true, title: name, statusBarStyle: "black-translucent" } };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0e0d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
