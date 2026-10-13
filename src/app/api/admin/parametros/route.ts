import { responder } from "@/lib/server/api";
import { PUEDE, requerirUsuario } from "@/lib/server/auth";
import { cargarCatalogo } from "@/lib/server/parametros";

export const dynamic = "force-dynamic";

export async function GET() {
  return responder(async () => {
    await requerirUsuario(PUEDE.administrar);
    return { ejercicios: await cargarCatalogo() };
  });
}
