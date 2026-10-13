import { z } from "zod";
import { responder } from "@/lib/server/api";
import { requerirUsuario } from "@/lib/server/auth";
import { anularPago } from "@/lib/server/finiquitos";

/** Anula un pago registrado por error (no se borra: queda en el historial con su motivo). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  return responder(async () => {
    const user = await requerirUsuario();
    const { id, pid } = await params;
    const { motivo } = z.object({ motivo: z.string().max(500) }).parse(await req.json());
    await anularPago(user, id, pid, motivo);
    return { ok: true };
  }, { mutacion: true });
}
