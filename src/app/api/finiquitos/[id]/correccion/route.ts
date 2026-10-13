import { responder } from "@/lib/server/api";
import { requerirUsuario } from "@/lib/server/auth";
import { corregirFiniquito } from "@/lib/server/finiquitos";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const user = await requerirUsuario();
    const { id } = await params;
    const b = await req.json();
    const f = await corregirFiniquito(user, id, b.datos, String(b.motivo ?? ""), Number(b.version));
    return { id: f.id, estado: f.estado, version: f.version };
  }, { mutacion: true });
}
