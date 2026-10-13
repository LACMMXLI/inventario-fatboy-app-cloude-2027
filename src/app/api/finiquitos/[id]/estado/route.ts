import { z } from "zod";
import { responder } from "@/lib/server/api";
import { requerirUsuario } from "@/lib/server/auth";
import { cambiarEstado } from "@/lib/server/finiquitos";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const user = await requerirUsuario();
    const { id } = await params;
    const b = z.object({ accion: z.enum(["CALCULAR", "REVISAR", "AUTORIZAR", "DEVOLVER"]), nota: z.string().max(2000).optional() }).parse(await req.json());
    const f = await cambiarEstado(user, id, b.accion, b.nota);
    return { id: f.id, estado: f.estado, version: f.version };
  }, { mutacion: true });
}
