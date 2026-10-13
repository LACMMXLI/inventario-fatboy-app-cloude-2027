import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/server/auth";
import { cargarCatalogo } from "@/lib/server/parametros";
import { Parametros } from "./Parametros";

export const metadata = { title: "Parámetros legales" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const u = await usuarioActual();
  if (u?.rol !== "ADMIN") redirect("/");
  return <Parametros inicial={await cargarCatalogo()} />;
}
