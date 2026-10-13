import { prisma } from "./db";
import { sembrarParametros } from "./parametros";

export const SUCURSALES_INICIALES = ["Venecia", "San Marcos", "Américas"];

/** Inicialización idempotente: datos de la empresa, sucursales, parámetros legales y administrador inicial. */
export async function bootstrap() {
  await prisma.empresa.upsert({ where: { id: "empresa" }, create: { id: "empresa" }, update: {} });

  for (const [i, nombre] of SUCURSALES_INICIALES.entries()) {
    await prisma.sucursal.upsert({ where: { nombre }, create: { nombre, orden: i }, update: {} });
  }

  await sembrarParametros();

  // El primer administrador NO se crea desde variables de entorno: se inserta por SQL (ver docs/ADMIN-INICIAL.md).
  if ((await prisma.user.count()) === 0) {
    console.warn("[bootstrap] No hay usuarios. Cree el administrador inicial con el SQL de docs/ADMIN-INICIAL.md.");
  }
}
