#!/usr/bin/env bash
# Restaura un respaldo creado por backup.sh. ATENCIÓN: reemplaza los datos actuales.
set -euo pipefail
FILE="${1:?Uso: ./scripts/restore.sh archivo.tar.gz}"
DB_CONTAINER="${DB_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -E '(^|-)db(-|$)' | head -1)}"
APP_CONTAINER="${APP_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -E '(^|-)app(-|$)' | head -1)}"
read -r -p "Esto REEMPLAZARÁ la base de datos y los documentos actuales. Escriba SI para continuar: " OK
[ "$OK" = "SI" ] || { echo "Cancelado"; exit 1; }
TMP=$(mktemp -d)
tar -xzf "$FILE" -C "$TMP"
echo "→ Restaurando base de datos"
docker cp "$TMP/db.dump" "$DB_CONTAINER:/tmp/db.dump"
docker exec "$DB_CONTAINER" sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner /tmp/db.dump && rm /tmp/db.dump'
echo "→ Restaurando documentos"
docker cp "$TMP/documentos/." "$APP_CONTAINER:/data/documentos/"
rm -rf "$TMP"
docker restart "$APP_CONTAINER" >/dev/null
echo "✔ Restauración completa"
