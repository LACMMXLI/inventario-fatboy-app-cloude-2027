import { z } from "zod";
import { responder } from "@/lib/server/api";
import { HttpError, PUEDE, hashPassword, requerirUsuario, validarPassword } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { registrar } from "@/lib/server/bitacora";

const select = { id: true, email: true, nombre: true, rol: true, activo: true, ultimoAcceso: true, creadoEn: true } as const;

export async function GET() {
  return responder(async () => {
    await requerirUsuario(PUEDE.administrar);
    return prisma.user.findMany({ select, orderBy: { creadoEn: "asc" } });
  });
}

export async function POST(req: Request) {
  return responder(async () => {
    const admin = await requerirUsuario(PUEDE.administrar);
    const b = z.object({ email: z.string().email().max(200), nombre: z.string().trim().min(2).max(100), rol: z.enum(["ADMIN", "AUTORIZADOR", "OPERADOR"]), password: z.string().max(200) }).parse(await req.json());
    const err = validarPassword(b.password);
    if (err) throw new HttpError(422, err);
    const email = b.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, "Ya existe un usuario con ese correo");
    const u = await prisma.$transaction(async (tx) => {
      const r = await tx.user.create({ data: { email, nombre: b.nombre, rol: b.rol, passwordHash: await hashPassword(b.password) }, select });
      await registrar(tx, admin, "Usuario", r.id, "CREAR", { email, rol: b.rol });
      return r;
    });
    return u;
  }, { mutacion: true });
}
