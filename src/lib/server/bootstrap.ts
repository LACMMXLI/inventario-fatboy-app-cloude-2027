import { prisma } from "./db";
import { env } from "../env";
import { hashPassword, validarPassword } from "./auth";
import { sembrarParametros } from "./parametros";

export const SUCURSALES_INICIALES = ["Venecia", "San Marcos", "Américas"];

/** Inicialización idempotente: datos de la empresa, sucursales, parámetros legales y administrador inicial. */
export async function bootstrap() {
  await prisma.empresa.upsert({ where: { id: "empresa" }, create: { id: "empresa" }, update: {} });

  for (const [i, nombre] of SUCURSALES_INICIALES.entries()) {
    await prisma.sucursal.upsert({ where: { nombre }, create: { nombre, orden: i }, update: {} });
  }

  await sembrarParametros();

  if (env.adminEmail && env.adminPassword) {
    const existe = await prisma.user.findUnique({ where: { email: env.adminEmail } });
    if (!existe) {
      const err = validarPassword(env.adminPassword);
      if (err) {
        console.error(`[bootstrap] ADMIN_PASSWORD no cumple la política (${err}). No se creó el administrador.`);
      } else {
        await prisma.user.create({
          data: { email: env.adminEmail, nombre: env.adminName, passwordHash: await hashPassword(env.adminPassword), rol: "ADMIN" },
        });
        console.log(`[bootstrap] Administrador inicial creado: ${env.adminEmail}`);
      }
    }
  } else if ((await prisma.user.count()) === 0) {
    console.warn("[bootstrap] No hay usuarios y no se definieron ADMIN_EMAIL / ADMIN_PASSWORD: no podrá iniciar sesión.");
  }
}
