import Link from "next/link";
import { notFound } from "next/navigation";
import { armarDocData } from "@/lib/server/documentos";
import { HttpError } from "@/lib/server/auth";
import { Visor } from "./Visor";
import { Alerta } from "@/components/ui";
import type { TipoDocumento } from "@/components/documentos/tipos";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string; tipo: string }> }) {
  const { id, tipo } = await params;
  if (!["recibo", "desglose", "carta"].includes(tipo)) notFound();
  let d;
  try {
    d = await armarDocData(id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  if (tipo === "carta" && (d.datos.motivo !== "RENUNCIA_VOLUNTARIA" || !d.datos.voluntadRenunciaManifestada)) {
    return (
      <div className="space-y-4">
        <Link href={`/finiquitos/${id}`} className="text-sm font-bold underline">← Volver al finiquito</Link>
        <Alerta tipo="warn" titulo="La carta de renuncia no está disponible">
          Solo se genera cuando el motivo es renuncia voluntaria y se confirmó que el trabajador manifestó su voluntad de renunciar. Edite el finiquito para confirmarlo, si es cierto.
        </Alerta>
      </div>
    );
  }
  return <Visor id={id} tipo={tipo as TipoDocumento} d={d} />;
}
