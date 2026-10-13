# Fatboy · Finiquitos

Aplicación web autoalojada para calcular finiquitos y liquidaciones laborales (México) y generar los documentos de terminación de **Fatboy** (Mexicali, B.C.): cálculo/recibo, desglose explicativo y carta de renuncia revisable.

**Stack:** Next.js 15 · TypeScript · Tailwind 4 · PostgreSQL 16 · Prisma 6 · `decimal.js` · Chromium local (`puppeteer-core`) para PDF/PNG.

## Qué incluye
* Asistente de 5 pasos con cálculo en servidor, actualizado al cambiar cualquier dato.
* Motor por concepto y por tipo de terminación; ISR por procedimiento (no tasa fija); deducciones solo si son procedentes. Ver [`docs/FORMULAS.md`](docs/FORMULAS.md).
* Parámetros legales por ejercicio con estatus de validación: sin validar ⇒ resultado **provisional**.
* Login, roles, estados borrador → pagado, pagos parciales, historial inmutable, correcciones documentadas, bitácora.
* Vista previa, impresión, PDF y PNG generados en el servidor.

## Desarrollo local
```bash
cp .env.example .env     # defina DATABASE_URL y CHROMIUM_PATH
npm ci
npx prisma migrate deploy
# cree el administrador con el SQL de docs/ADMIN-INICIAL.md
npm run dev
```

## Pruebas
```bash
npm run typecheck
npm run test:unit                                   # sin BD
DATABASE_URL=... CHROMIUM_PATH=... npm run test     # + integración con PostgreSQL y PDF/PNG
```

## Despliegue y operación
* [`docs/COOLIFY.md`](docs/COOLIFY.md) — despliegue en Coolify
* [`docs/ADMIN-INICIAL.md`](docs/ADMIN-INICIAL.md) — crear el administrador por SQL (sin variables de entorno)
* [`docs/RESPALDO.md`](docs/RESPALDO.md) — respaldo y restauración

## Primer uso
1. Cree el administrador con el SQL de `docs/ADMIN-INICIAL.md` y entre.
2. *Empresa*: capture razón social, RFC y domicilio (se imprimen como «No configurado» hasta entonces).
3. *Parámetros legales*: contraste cada grupo con la fuente oficial y **confírmelo**; mientras tanto los cálculos salen PROVISIONALES.
