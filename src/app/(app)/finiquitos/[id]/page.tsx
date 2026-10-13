import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { usuarioActual } from "@/lib/server/auth";
import { Detalle } from "./Detalle";
import type { ResultadoFiniquito } from "@/lib/finiquito/types";
import type { FiniquitoInput } from "@/lib/finiquito/schema";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await usuarioActual())!;
  const f = await prisma.finiquito.findUnique({
    where: { id },
    include: { pagos: { orderBy: { creadoEn: "asc" } }, revisiones: { orderBy: { creadoEn: "desc" }, select: { id: true, version: true, tipo: true, motivo: true, estadoNuevo: true, userNombre: true, creadoEn: true } } },
  });
  if (!f) notFound();
  const ids = [f.creadoPorId, f.modificadoPorId, f.revisadoPorId, f.autorizadoPorId].filter(Boolean) as string[];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } });
  const nombre = (i: string | null) => (i ? users.find((u) => u.id === i)?.nombre ?? "—" : null);
  const datos = f.datos as unknown as FiniquitoInput;
  return (
    <Detalle
      rol={user.rol}
      f={{
        id: f.id, folio: f.folio, estado: f.estado, estadoCalculo: f.estadoCalculo, version: f.version,
        trabajador: f.trabajadorNombre, puesto: f.puesto, sucursal: f.sucursalNombre,
        creadoEn: f.creadoEn.toISOString(), actualizadoEn: f.actualizadoEn.toISOString(), revisadoEn: f.revisadoEn?.toISOString() ?? null, autorizadoEn: f.autorizadoEn?.toISOString() ?? null, pagadoEn: f.pagadoEn?.toISOString() ?? null,
        creadoPor: nombre(f.creadoPorId), modificadoPor: nombre(f.modificadoPorId), revisadoPor: nombre(f.revisadoPorId), autorizadoPor: nombre(f.autorizadoPorId),
        totalNeto: f.totalNeto.toString(),
        validacionManual: f.validacionManual as { por: string; en: string; nota: string } | null,
        cartaDisponible: datos.motivo === "RENUNCIA_VOLUNTARIA" && datos.voluntadRenunciaManifestada,
      }}
      resultado={f.resultado as unknown as ResultadoFiniquito}
      pagos={f.pagos.map((p) => ({ id: p.id, monto: p.monto.toString(), fechaPago: p.fechaPago.toISOString().slice(0, 10), forma: p.forma, referencia: p.referencia, registradoPor: p.registradoPorNombre, anulado: !!p.anuladoEn, motivoAnulacion: p.motivoAnulacion }))}
      revisiones={f.revisiones.map((r) => ({ ...r, creadoEn: r.creadoEn.toISOString() }))}
    />
  );
}
