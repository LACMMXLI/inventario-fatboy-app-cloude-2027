# Despliegue en Coolify

Requisitos: servidor con Coolify, el repositorio conectado (GitHub App o deploy key) y un dominio apuntando al servidor.

## Pasos

1. **Nuevo recurso → Aplicación → repositorio** `lacmmxli/inventario-fatboy-app-cloude-2027`, rama a desplegar.
2. **Build Pack: Docker Compose**, archivo `docker-compose.yml` (levanta `app` + `db` PostgreSQL 16 con volúmenes persistentes).
   *(Alternativa: Build Pack «Dockerfile» para la app y un recurso PostgreSQL de Coolify; en ese caso defina `DATABASE_URL` apuntando a él.)*
3. **Variables de entorno** (pestaña *Environment Variables*):

   | Variable | Valor |
   |---|---|
   | `POSTGRES_PASSWORD` | contraseña larga y aleatoria (obligatoria) |
   | `ADMIN_EMAIL` | correo del primer administrador |
   | `ADMIN_PASSWORD` | ≥12 caracteres, mayúsculas, minúsculas y números (solo se usa si el usuario no existe) |
   | `ADMIN_NAME` | opcional |
   | `COOKIE_SECURE` | `true` (por defecto) — Coolify sirve HTTPS |
   | `SESSION_TTL_HOURS`, `APP_TIMEZONE` | opcionales (12 / `America/Tijuana`) |

   Nunca suba secretos al repositorio (`.env` está en `.gitignore`).
4. **Dominio**: asigne el dominio al servicio `app`, puerto **3000** (Coolify/Traefik emite el certificado).
5. **Healthcheck**: ya definido (`GET /api/health` → 200 solo si la base responde). Coolify lo respeta.
6. **Deploy**. En el arranque el contenedor ejecuta `prisma migrate deploy`, crea sucursales (Venecia, San Marcos, Américas), parámetros legales 2024‑2026 y el administrador inicial.
7. Entre con `ADMIN_EMAIL`, cambie la contraseña (Usuarios), complete **Administración → Empresa** (razón social, RFC, domicilio) y **confirme los Parámetros legales** (ver `docs/FORMULAS.md`).

## Volúmenes persistentes

| Volumen | Contenido |
|---|---|
| `fatboy_pgdata` | base de datos PostgreSQL |
| `fatboy_data` → `/data` | PDF/PNG generados (`/data/documentos`) |

En Coolify aparecen como *Persistent Storage*; no los elimine al redeplegar.

## Actualizar
Haga *push* a la rama y *Redeploy*. Las migraciones se aplican solas; los datos persisten.

## Respaldo y restauración
Ver `docs/RESPALDO.md`.
