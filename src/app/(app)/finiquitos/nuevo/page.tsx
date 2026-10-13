import { Asistente } from "@/components/finiquito/Asistente";
import { cargarMeta } from "@/lib/server/meta";
import { hoyISO } from "@/lib/fechas";
import { env } from "@/lib/env";

export const metadata = { title: "Nuevo cálculo" };
export const dynamic = "force-dynamic";

export default async function Nuevo() {
  return <Asistente meta={await cargarMeta()} hoy={hoyISO(env.timezone)} />;
}
