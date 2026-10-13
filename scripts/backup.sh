#!/usr/bin/env bash
# Respaldo de base de datos + documentos. Uso: ./scripts/backup.sh [directorio_destino]
set -euo pipefail
DEST="${1:-backups}"
DB_CONTAINER="${DB_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -E '(^|-)db(-|$)' | head -1)}"
APP_CONTAINER="${APP_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -E '(^|-)app(-|$)' | head -1)}"
[ -n "$DB_CONTAINER" ] && [ -n "$APP_CONTAINER" ] || { echo "No se encontraron los contenedores db/app (defina DB_CONTAINER y APP_CONTAINER)" >&2; exit 1; }
TS=$(date +%Y%m%d-%H%M%S)
TMP=$(mktemp -d)
mkdir -p "$DEST"
echo "→ Volcando base de datos desde $DB_CONTAINER"
docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$TMP/db.dump"
echo "→ Copiando documentos desde $APP_CONTAINER"
mkdir -p "$TMP/documentos"
docker cp "$APP_CONTAINER:/data/documentos/." "$TMP/documentos/" 2>/dev/null || echo "(sin documentos aún)"
tar -czf "$DEST/fatboy-$TS.tar.gz" -C "$TMP" .
rm -rf "$TMP"
echo "✔ Respaldo creado: $DEST/fatboy-$TS.tar.gz"
