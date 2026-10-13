import { z } from "zod";
import { responder } from "@/lib/server/api";
import { HttpError, PUEDE, hashPassword, requerirUsuario, validarPassword } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { registrar } from "@/lib/server/bitacora";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const admin = await requerirUsuario(PUEDE.administrar);
    const { id } = await params;
    const b = z
      .object({ nombre: z.string().trim().min(2).max(100).optional(), rol: z.enum(["ADMIN", "AUTORIZADOR", "OPERADOR"]).optional(), activo: z.boolean().optional(), password: z.string().max(200).optional() })
      .parse(await req.json());
    if (id === admin.id && (b.activo === false || (b.rol && b.rol !== "ADMIN"))) throw new HttpError(409, "No puede desactivarse ni quitarse el rol de administrador a sí mismo.");
    const data: Record<string, unknown> = {};
    if (b.nombre) data.nombre = b.nombre;
    if (b.rol) data.rol = b.rol;
    if (b.activo !== undefined) data.activo = b.activo;
    if (b.password) {
      const err = validarPassword(b.password);
      if (err) throw new HttpError(422, err);
      data.passwordHash = await hashPassword(b.password);
      data.intentosFallidos = 0;
      data.bloqueadoHasta = null;
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data });
      if (b.activo === false || b.password) await tx.session.deleteMany({ where: { userId: id } });
      await registrar(tx, admin, "Usuario", id, "ACTUALIZAR", { ...b, password: b.password ? "***" : undefined });
    });
    return { ok: true };
  }, { mutacion: true });
}
