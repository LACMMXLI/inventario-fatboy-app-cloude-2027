import { prisma } from "./db";
import { PARAMETROS_DEFAULT } from "../legal/defaults";
import { ParametrosLegalesSchema, type ParametrosLegales } from "../legal/types";

export async function cargarCatalogo(): Promise<ParametrosLegales[]> {
  const rows = await prisma.parametroLegal.findMany({ orderBy: { anio: "asc" } });
  const out: ParametrosLegales[] = [];
  for (const r of rows) {
    const p = ParametrosLegalesSchema.safeParse(r.datos);
    if (p.success) out.push(p.data);
    else console.error(`[parametros] El ejercicio ${r.anio} tiene datos inválidos y se ignora:`, p.error.issues[0]?.message);
  }
  return out;
}

/** Siembra los ejercicios por omisión sin sobrescribir lo ya editado/confirmado por el administrador. */
export async function sembrarParametros() {
  for (const p of PARAMETROS_DEFAULT) {
    const existe = await prisma.parametroLegal.findUnique({ where: { anio: p.anio } });
    if (!existe) await prisma.parametroLegal.create({ data: { anio: p.anio, datos: p as object } });
  }
}

export async function guardarParametros(p: ParametrosLegales, userNombre: string) {
  const data = ParametrosLegalesSchema.parse(p);
  await prisma.$transaction([
    prisma.parametroLegal.upsert({
      where: { anio: data.anio },
      create: { anio: data.anio, datos: data as object, actualizadoPor: userNombre },
      update: { datos: data as object, actualizadoPor: userNombre },
    }),
    prisma.bitacora.create({ data: { entidad: "ParametroLegal", entidadId: String(data.anio), accion: "GUARDAR", userNombre, detalle: { estatus: data.estatus } } }),
  ]);
}
