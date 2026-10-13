# Crear el administrador inicial (sin variables de entorno)

La aplicación **no** crea ningún usuario por sí sola. Tras el primer despliegue (ya aplicadas las migraciones), cree el administrador con un `INSERT` directo en PostgreSQL.

## 1. Entrar a la base de datos
Desde la terminal del contenedor/servidor de la base (en Coolify: *Terminal* del servicio `db`):

```bash
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```
Si usa un PostgreSQL de Coolify como recurso aparte, abra su terminal y use el usuario/base que le asignó.

## 2. Ejecutar el SQL (cambie los 3 valores marcados)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "User" ("id", "email", "nombre", "passwordHash", "rol", "activo", "actualizadoEn")
VALUES (
  gen_random_uuid()::text,
  lower('CORREO_DEL_ADMIN@ejemplo.com'),                  -- ← su correo
  'NOMBRE DEL ADMINISTRADOR',                             -- ← su nombre
  crypt('SU_CONTRASEÑA_LARGA_2026', gen_salt('bf', 12)),  -- ← su contraseña
  'ADMIN',
  true,
  now()
);
```

* `crypt(..., gen_salt('bf', 12))` genera un hash **bcrypt** (`$2a$12$…`) compatible con el login de la aplicación; la contraseña nunca se guarda en claro.
* Use una contraseña de **mínimo 12 caracteres con mayúsculas, minúsculas y números**. Por SQL esa política no se valida: respétela usted.
* Si `CREATE EXTENSION` falla por permisos, ejecútelo conectado como el superusuario de la base (`POSTGRES_USER` lo es en el compose incluido).

## 3. Verificar y limpiar
```sql
SELECT email, rol, activo FROM "User";
\q
```
Evite que la contraseña quede en el historial: ejecute `history -c` en la terminal (y `\s` no la guarda si usó `psql` con `HISTFILE=/dev/null psql ...`). Entre a la aplicación y, si quiere, cambie la contraseña en *Usuarios*.

## Crear más administradores / recuperar acceso
El mismo `INSERT` sirve para otro usuario (cambie `rol` a `AUTORIZADOR` u `OPERADOR`). Para **restablecer la contraseña**:

```sql
UPDATE "User"
SET "passwordHash" = crypt('NUEVA_CONTRASEÑA_LARGA_2026', gen_salt('bf', 12)),
    "intentosFallidos" = 0, "bloqueadoHasta" = NULL
WHERE email = 'correo_del_admin@ejemplo.com';
DELETE FROM "Session" WHERE "userId" = (SELECT id FROM "User" WHERE email = 'correo_del_admin@ejemplo.com');
```
