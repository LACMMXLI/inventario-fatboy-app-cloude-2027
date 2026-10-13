import { responder } from "@/lib/server/api";
import { requerirUsuario } from "@/lib/server/auth";
import { cargarCatalogo } from "@/lib/server/parametros";
import { calcularFiniquito } from "@/lib/finiquito/engine";
import { FiniquitoInputSchema } from "@/lib/finiquito/schema";

export const dynamic = "force-dynamic";

/** Vista previa del cálculo (no guarda nada). El cálculo siempre se hace en el servidor. */
export async function POST(req: Request) {
  return responder(async () => {
    await requerirUsuario();
    const datos = await req.json();
    const parsed = FiniquitoInputSchema.parse(datos);
    const resultado = calcularFiniquito(parsed, await cargarCatalogo());
    return { resultado, datos: parsed };
  }, { mutacion: true });
}
