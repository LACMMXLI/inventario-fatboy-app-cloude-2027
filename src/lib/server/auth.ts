import { cookies, headers } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Rol, User } from "@prisma/client";
import { prisma } from "./db";
import { env } from "../env";

export const COOKIE_NAME = "fb_session";
const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;

export type SessionUser = Pick<User, "id" | "email" | "nombre" | "rol">;

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export function validarPassword(pw: string): string | null {
  if (pw.length < 12) return "La contraseña debe tener al menos 12 caracteres";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return "Use mayúsculas, minúsculas y números";
  return null;
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export type LoginResultado = { ok: true } | { ok: false; error: string };

export async function iniciarSesion(email: string, password: string): Promise<LoginResultado> {
  const genérico = "Correo o contraseña incorrectos";
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Comparación aunque no exista el usuario, para no revelar su existencia por tiempos de respuesta
  const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi";
  if (user?.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
    return { ok: false, error: "Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde." };
  }
  const okPw = await bcrypt.compare(password, hash);
  if (!user || !user.activo || !okPw) {
    if (user) {
      const intentos = user.intentosFallidos + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: intentos >= MAX_INTENTOS ? { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MIN * 60_000) } : { intentosFallidos: intentos },
      });
    }
    await prisma.bitacora.create({ data: { entidad: "Sesion", accion: "LOGIN_FALLIDO", detalle: { email }, ip: await clientIp() } });
    return { ok: false, error: genérico };
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const h = await headers();
  await prisma.$transaction([
    prisma.session.create({
      data: {
        tokenHash: sha(token),
        userId: user.id,
        expiraEn: new Date(Date.now() + env.sessionTtlHours * 3600_000),
        ip: await clientIp(),
        userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() } }),
    prisma.bitacora.create({ data: { entidad: "Sesion", accion: "LOGIN", userId: user.id, userNombre: user.nombre, ip: await clientIp() } }),
  ]);
  const c = await cookies();
  c.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: env.cookieSecure, path: "/", maxAge: env.sessionTtlHours * 3600 });
  return { ok: true };
}

export async function cerrarSesion() {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha(token) } });
  c.delete(COOKIE_NAME);
}

export async function usuarioActual(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: sha(token) }, include: { user: true } });
  if (!s || s.expiraEn < new Date() || !s.user.activo) return null;
  const { id, email, nombre, rol } = s.user;
  return { id, email, nombre, rol };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detalle?: unknown,
  ) {
    super(message);
  }
}

export async function requerirUsuario(roles?: Rol[]): Promise<SessionUser> {
  const u = await usuarioActual();
  if (!u) throw new HttpError(401, "Sesión no válida. Inicie sesión.");
  if (roles && !roles.includes(u.rol)) throw new HttpError(403, "No tiene permiso para esta acción.");
  return u;
}

/** Defensa CSRF adicional para peticiones que modifican datos: el Origin debe coincidir con el host. */
export async function verificarOrigen() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return; // peticiones same-origin de navegadores modernos sí lo envían; herramientas de servidor no
  const host = h.get("x-forwarded-host") || h.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Origen no permitido");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Origen no permitido");
  }
}

export const PUEDE = {
  capturar: ["ADMIN", "AUTORIZADOR", "OPERADOR"] as Rol[],
  revisar: ["ADMIN", "AUTORIZADOR", "OPERADOR"] as Rol[],
  autorizar: ["ADMIN", "AUTORIZADOR"] as Rol[],
  pagar: ["ADMIN", "AUTORIZADOR"] as Rol[],
  corregir: ["ADMIN", "AUTORIZADOR"] as Rol[],
  administrar: ["ADMIN"] as Rol[],
};
