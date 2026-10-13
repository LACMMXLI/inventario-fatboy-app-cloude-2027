import { z } from "zod";
import { responder } from "@/lib/server/api";
import { HttpError, PUEDE, requerirUsuario } from "@/lib/server/auth";
import { cargarCatalogo, guardarParametros } from "@/lib/server/parametros";

const GRUPOS = ["salariosMinimos", "uma", "tarifaIsr", "exenciones", "subsidio"] as const;

/** El administrador declara que contrastó los grupos indicados con la publicación oficial. Queda registrado quién y cuándo. */
export async function POST(req: Request, { params }: { params: Promise<{ anio: string }> }) {
  return responder(async () => {
    const user = await requerirUsuario(PUEDE.administrar);
    const { anio } = await params;
    const { grupos } = z.object({ grupos: z.array(z.enum(GRUPOS)).min(1), declaro: z.literal(true) }).parse(await req.json().then((b) => ({ ...b, declaro: b.declaro })));
    const p = (await cargarCatalogo()).find((x) => x.anio === Number(anio));
    if (!p) throw new HttpError(404, "Ejercicio no encontrado");
    for (const g of grupos) {
      if (g === "tarifaIsr" && !p.tarifaMensualIsr) throw new HttpError(422, "No puede confirmarse la tarifa ISR porque no está capturada.");
      p.estatus[g] = "CONFIRMADO";
    }
    p.confirmacion = { por: user.nombre, en: new Date().toISOString(), grupos: [...new Set([...(p.confirmacion?.grupos ?? []), ...grupos])] };
    await guardarParametros(p, user.nombre);
    return { ok: true };
  }, { mutacion: true });
}
