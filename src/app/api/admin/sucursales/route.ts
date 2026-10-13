import { z } from "zod";
import { responder } from "@/lib/server/api";
import { PUEDE, requerirUsuario } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { registrar } from "@/lib/server/bitacora";

export async function GET() {
  return responder(async () => {
    await requerirUsuario();
    return prisma.sucursal.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
  });
}

const Schema = z.object({
  id: z.string().optional(),
  nombre: z.string().trim().min(2).max(100),
  domicilio: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
  activa: z.boolean().default(true),
});

/** Crea o actualiza una sucursal (las sucursales con finiquitos no se borran: se desactivan). */
export async function POST(req: Request) {
  return responder(async () => {
    const user = await requerirUsuario(PUEDE.administrar);
    const { id, ...data } = Schema.parse(await req.json());
    const s = await prisma.$transaction(async (tx) => {
      const r = id ? await tx.sucursal.update({ where: { id }, data }) : await tx.sucursal.create({ data });
      await registrar(tx, user, "Sucursal", r.id, id ? "ACTUALIZAR" : "CREAR", data);
      return r;
    });
    return s;
  }, { mutacion: true });
}
