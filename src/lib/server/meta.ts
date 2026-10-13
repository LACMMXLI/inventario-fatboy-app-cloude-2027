import { prisma } from "./db";
import { obtenerEmpresaDoc } from "./documentos";
import { cargarCatalogo } from "./parametros";
import type { EmpresaDoc } from "@/components/documentos/tipos";

export interface Meta {
  empresa: EmpresaDoc;
  sucursales: { id: string; nombre: string }[];
  zonaDefault: "ZLFN" | "GENERAL";
  ejercicios: { anio: number; salarioMinimoGeneral: string; salarioMinimoZlfn: string; profesionales: { clave: string; ocupacion: string; general: string; zlfn: string }[]; estatus: Record<string, string> }[];
}

export async function cargarMeta(): Promise<Meta> {
  const [empresa, sucursales, catalogo, e] = await Promise.all([
    obtenerEmpresaDoc(),
    prisma.sucursal.findMany({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true } }),
    cargarCatalogo(),
    prisma.empresa.findUnique({ where: { id: "empresa" }, select: { zonaSalarialDefault: true } }),
  ]);
  return {
    empresa,
    sucursales,
    zonaDefault: e?.zonaSalarialDefault === "GENERAL" ? "GENERAL" : "ZLFN",
    ejercicios: catalogo.map((p) => ({ anio: p.anio, salarioMinimoGeneral: p.salariosMinimos.general, salarioMinimoZlfn: p.salariosMinimos.zlfn, profesionales: p.salariosMinimos.profesionales, estatus: p.estatus })),
  };
}
