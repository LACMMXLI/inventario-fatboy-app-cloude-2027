import { responder } from "@/lib/server/api";
import { requerirUsuario } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { obtenerEmpresaDoc } from "@/lib/server/documentos";
import { cargarCatalogo } from "@/lib/server/parametros";

export const dynamic = "force-dynamic";

export async function GET() {
  return responder(async () => {
    const user = await requerirUsuario();
    const [empresa, sucursales, catalogo, e] = await Promise.all([
      obtenerEmpresaDoc(),
      prisma.sucursal.findMany({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true } }),
      cargarCatalogo(),
      prisma.empresa.findUnique({ where: { id: "empresa" }, select: { zonaSalarialDefault: true } }),
    ]);
    return {
      user,
      empresa,
      sucursales,
      zonaDefault: e?.zonaSalarialDefault ?? "ZLFN",
      ejercicios: catalogo.map((p) => ({
        anio: p.anio,
        salarioMinimoGeneral: p.salariosMinimos.general,
        salarioMinimoZlfn: p.salariosMinimos.zlfn,
        estatus: p.estatus,
        profesionales: p.salariosMinimos.profesionales,
      })),
    };
  });
}
