import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { SessionUser } from "./auth";

export async function registrar(
  tx: Prisma.TransactionClient | typeof prisma,
  user: SessionUser | null,
  entidad: string,
  entidadId: string | null,
  accion: string,
  detalle?: unknown,
) {
  await tx.bitacora.create({
    data: { entidad, entidadId, accion, detalle: (detalle ?? undefined) as Prisma.InputJsonValue | undefined, userId: user?.id, userNombre: user?.nombre },
  });
}
