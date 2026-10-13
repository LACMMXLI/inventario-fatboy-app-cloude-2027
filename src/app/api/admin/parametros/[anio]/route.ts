import { responder } from "@/lib/server/api";
import { PUEDE, requerirUsuario } from "@/lib/server/auth";
import { cargarCatalogo, guardarParametros } from "@/lib/server/parametros";
import { ParametrosLegalesSchema } from "@/lib/legal/types";
import { HttpError } from "@/lib/server/auth";

/**
 * Guarda un ejercicio. Cualquier cambio en un grupo de parámetros lo regresa a CORROBORADO/PENDIENTE:
 * un administrador debe volver a confirmarlo explícitamente.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ anio: string }> }) {
  return responder(async () => {
    const user = await requerirUsuario(PUEDE.administrar);
    const { anio } = await params;
    const p = ParametrosLegalesSchema.parse(await req.json());
    if (p.anio !== Number(anio)) throw new HttpError(400, "El ejercicio no coincide");
    const previo = (await cargarCatalogo()).find((x) => x.anio === p.anio);
    const grupos: [keyof typeof p.estatus, unknown, unknown][] = [
      ["salariosMinimos", p.salariosMinimos, previo?.salariosMinimos],
      ["uma", p.uma, previo?.uma],
      ["tarifaIsr", p.tarifaMensualIsr, previo?.tarifaMensualIsr],
      ["exenciones", p.exenciones, previo?.exenciones],
      ["subsidio", p.subsidioEmpleo, previo?.subsidioEmpleo],
    ];
    // Nadie puede subir un estatus desde este formulario: se conserva el anterior y, si el contenido cambió, vuelve a PENDIENTE.
    for (const [g, nuevo, viejo] of grupos) {
      if (!previo) p.estatus[g] = "PENDIENTE";
      else p.estatus[g] = JSON.stringify(nuevo) === JSON.stringify(viejo) ? previo.estatus[g] : "PENDIENTE";
    }
    p.confirmacion = previo?.confirmacion ?? null;
    await guardarParametros(p, user.nombre);
    return { ok: true };
  }, { mutacion: true });
}
