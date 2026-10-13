import { z } from "zod";
import { responder } from "@/lib/server/api";
import { requerirUsuario } from "@/lib/server/auth";
import { registrarPago } from "@/lib/server/finiquitos";
import { isValidISO } from "@/lib/fechas";

const Schema = z.object({
  monto: z.coerce.number().positive().max(100_000_000),
  fechaPago: z.string().refine(isValidISO, "Fecha inválida"),
  forma: z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "OTRO"]),
  referencia: z.string().max(200).optional().nullable(),
  notas: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const user = await requerirUsuario();
    const { id } = await params;
    const pago = await registrarPago(user, id, Schema.parse(await req.json()));
    return { id: pago.id };
  }, { mutacion: true });
}
