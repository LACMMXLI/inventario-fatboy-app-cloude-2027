export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SKIP_BOOTSTRAP !== "true") {
    try {
      const { bootstrap } = await import("./lib/server/bootstrap");
      await bootstrap();
    } catch (e) {
      console.error("[bootstrap] Falló la inicialización:", e);
    }
  }
}
