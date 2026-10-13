import { responder } from "@/lib/server/api";
import { HttpError, PUEDE, requerirUsuario } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { actualizarFiniquito } from "@/lib/server/finiquitos";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    await requerirUsuario();
    const { id } = await params;
    const f = await prisma.finiquito.findUnique({ where: { id }, include: { pagos: { orderBy: { creadoEn: "asc" } }, revisiones: { orderBy: { creadoEn: "desc" }, select: { id: true, version: true, tipo: true, motivo: true, estadoAnterior: true, estadoNuevo: true, userNombre: true, creadoEn: true } } } });
    if (!f) throw new HttpError(404, "Finiquito no encontrado");
    return f;
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const user = await requerirUsuario(PUEDE.capturar);
    const { id } = await params;
    const body = await req.json();
    const f = await actualizarFiniquito(user, id, body.datos, Number(body.version), Boolean(body.calcular));
    return { id: f.id, estado: f.estado, version: f.version };
  }, { mutacion: true });
}
