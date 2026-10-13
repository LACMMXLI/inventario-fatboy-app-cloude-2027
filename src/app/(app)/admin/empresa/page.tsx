import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { usuarioActual } from "@/lib/server/auth";
import { EmpresaForm } from "./EmpresaForm";

export const metadata = { title: "Empresa" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const u = await usuarioActual();
  if (u?.rol !== "ADMIN") redirect("/");
  const [e, sucursales] = await Promise.all([
    prisma.empresa.upsert({ where: { id: "empresa" }, create: { id: "empresa" }, update: {} }),
    prisma.sucursal.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
  ]);
  return <EmpresaForm empresa={JSON.parse(JSON.stringify(e))} sucursales={sucursales} />;
}
