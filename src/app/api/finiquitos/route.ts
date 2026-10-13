import { z } from "zod";
import { responder } from "@/lib/server/api";
import { PUEDE, requerirUsuario } from "@/lib/server/auth";
import { crearFiniquito, listarFiniquitos } from "@/lib/server/finiquitos";
import { EstadoFiniquito } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return responder(async () => {
    await requerirUsuario();
    const u = new URL(req.url).searchParams;
    const estado = u.get("estado");
    const f = z
      .object({
        q: z.string().max(100).optional(),
        sucursalId: z.string().optional(),
        estado: z.nativeEnum(EstadoFiniquito).optional(),
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        pagina: z.coerce.number().int().min(1).optional(),
      })
      .parse({
        q: u.get("q") || undefined,
        sucursalId: u.get("sucursalId") || undefined,
        estado: estado || undefined,
        desde: u.get("desde") || undefined,
        hasta: u.get("hasta") || undefined,
        pagina: u.get("pagina") || undefined,
      });
    return listarFiniquitos(f);
  });
}

export async function POST(req: Request) {
  return responder(async () => {
    const user = await requerirUsuario(PUEDE.capturar);
    const body = await req.json();
    const f = await crearFiniquito(user, body.datos, Boolean(body.calcular));
    return { id: f.id, folio: f.folio, estado: f.estado };
  }, { mutacion: true });
}
