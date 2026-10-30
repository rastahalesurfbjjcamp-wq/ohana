// Ao subir o servidor: no modo demonstração, liga os dados fictícios e popula o banco.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DEMO_MODE !== "1") return;
  const { installDemoFetch } = await import("./lib/demo/patch");
  installDemoFetch();
  const { ensureDemoSeed } = await import("./lib/demo/seed");
  await ensureDemoSeed().catch((e) => console.error("[demo seed]", e));
}
