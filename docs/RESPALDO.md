# Respaldo y restauración

Hay que respaldar **dos cosas**: la base de datos y la carpeta de documentos (`/data/documentos`).

## Respaldo (en el servidor, con Docker Compose)

```bash
./scripts/backup.sh            # crea backups/fatboy-AAAAMMDD-HHMMSS.tar.gz
```
El script ejecuta `pg_dump` dentro del contenedor `db` y empaqueta el volumen de documentos. Programe el script con `cron` (p. ej. diario) y copie los `.tar.gz` fuera del servidor.
En Coolify también puede usar *Scheduled Backups* del recurso PostgreSQL (si usa base de datos como recurso aparte) y respaldar el volumen `fatboy_data`.

## Restauración

```bash
./scripts/restore.sh backups/fatboy-AAAAMMDD-HHMMSS.tar.gz
```
Restaura la base (reemplaza el contenido actual: pide confirmación) y los documentos. Después reinicie la app. Pruebe la restauración periódicamente en un entorno de pruebas.

## Variables
Ambos scripts usan `COMPOSE_PROJECT_NAME` / nombres de servicio por defecto (`db`, `app`). Si Coolify nombró distinto los contenedores, defina `DB_CONTAINER` y `APP_CONTAINER`.
