import path from "node:path";

/** Variables de entorno leídas en un solo lugar. Ningún secreto tiene valor por omisión. */
export const env = {
  get nodeEnv() {
    return process.env.NODE_ENV ?? "development";
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
  get dataDir() {
    return path.resolve(process.env.DATA_DIR ?? "./data");
  },
  get documentsDir() {
    return path.resolve(process.env.DOCUMENTS_DIR ?? path.join(this.dataDir, "documentos"));
  },
  get sessionTtlHours() {
    const n = Number(process.env.SESSION_TTL_HOURS ?? 12);
    return Number.isFinite(n) && n > 0 ? n : 12;
  },
  get cookieSecure() {
    // Detrás de Coolify/Traefik la app se sirve por HTTPS. Use COOKIE_SECURE=false solo para pruebas locales por HTTP.
    if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE !== "false";
    return this.isProd;
  },
  get chromiumPath() {
    return process.env.CHROMIUM_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";
  },
  get timezone() {
    return process.env.APP_TIMEZONE || "America/Tijuana";
  },
};
