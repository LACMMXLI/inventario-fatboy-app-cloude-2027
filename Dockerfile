# syntax=docker/dockerfile:1
# Imagen de producción de Fatboy Finiquitos (Next.js + Prisma + Chromium para PDF/PNG)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
# DATABASE_URL solo se necesita para generar el cliente de Prisma; no se conecta durante el build.
ENV NEXT_TELEMETRY_DISABLED=1 SKIP_BOOTSTRAP=true DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    CHROMIUM_PATH=/usr/bin/chromium DATA_DIR=/data
# Chromium del sistema (generación local de PDF/PNG) + fuentes + utilidades de respaldo
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-dejavu-core fonts-inter openssl ca-certificates curl postgresql-client tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /data/documentos && chown -R node:node /app /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
