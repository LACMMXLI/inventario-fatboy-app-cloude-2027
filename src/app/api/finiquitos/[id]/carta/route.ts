import { z } from "zod";
import { responder } from "@/lib/server/api";
import { HttpError, PUEDE, requerirUsuario } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { armarDocData, validarCarta } from "@/lib/server/documentos";
import { registrar } from "@/lib/server/bitacora";
import { isValidISO } from "@/lib/fechas";
import type { Prisma } from "@prisma/client";

const Schema = z.object({
  lugar: z.string().max(150),
  fecha: z.string().refine(isValidISO),
  destinatario: z.string().min(2).max(200),
  atencion: z.string().max(200),
  fechaEfectiva: z.string().refine(isValidISO),
  parrafos: z.array(z.string().max(2000)).min(1).max(12),
  revisada: z.boolean(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    await requerirUsuario();
    const { id } = await params;
    const d = await armarDocData(id);
    validarCarta(d);
    return { carta: d.carta };
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const user = await requerirUsuario(PUEDE.capturar);
    const { id } = await params;
    const d = await armarDocData(id, { carta: false });
    validarCarta(d);
    const f = await prisma.finiquito.findUnique({ where: { id }, select: { id: true } });
    if (!f) throw new HttpError(404, "No encontrado");
    const contenido = Schema.parse(await req.json());
    await prisma.$transaction(async (tx) => {
      await tx.cartaRenuncia.upsert({
        where: { finiquitoId: id },
        create: { finiquitoId: id, contenido: contenido as Prisma.InputJsonValue, actualizadoPorId: user.id },
        update: { contenido: contenido as Prisma.InputJsonValue, actualizadoPorId: user.id },
      });
      await registrar(tx, user, "CartaRenuncia", id, contenido.revisada ? "REVISAR_CARTA" : "EDITAR_CARTA");
    });
    return { ok: true };
  }, { mutacion: true });
}
