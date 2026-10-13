#!/bin/sh
set -e
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL no está definida" >&2
  exit 1
fi
mkdir -p "${DOCUMENTS_DIR:-${DATA_DIR:-/data}/documentos}"
echo "[entrypoint] Aplicando migraciones…"
# Reintenta mientras la base de datos termina de arrancar
n=0
until npx prisma migrate deploy; do
  n=$((n+1))
  [ "$n" -ge 20 ] && echo "ERROR: no se pudieron aplicar las migraciones" >&2 && exit 1
  echo "[entrypoint] Base de datos no lista, reintentando ($n/20)…"
  sleep 3
done
echo "[entrypoint] Iniciando aplicación en el puerto ${PORT:-3000}"
exec "$@"
