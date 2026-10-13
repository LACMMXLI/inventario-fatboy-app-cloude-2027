import { notFound, redirect } from "next/navigation";
import { Asistente } from "@/components/finiquito/Asistente";
import { cargarMeta } from "@/lib/server/meta";
import { prisma } from "@/lib/server/db";
import { hoyISO } from "@/lib/fechas";
import { env } from "@/lib/env";
import type { FiniquitoInput } from "@/lib/finiquito/schema";

export const metadata = { title: "Editar cálculo" };
export const dynamic = "force-dynamic";

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await prisma.finiquito.findUnique({ where: { id } });
  if (!f) notFound();
  const meta = await cargarMeta();
  return (
    <Asistente
      key={`${f.id}-${f.version}`}
      meta={meta}
      hoy={hoyISO(env.timezone)}
      inicial={{ id: f.id, version: f.version, estado: f.estado, datos: f.datos as unknown as FiniquitoInput }}
    />
  );
}
void redirect;
