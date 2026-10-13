import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/db";
import { usuarioActual } from "@/lib/server/auth";
import { Usuarios } from "./Usuarios";

export const metadata = { title: "Usuarios" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const u = await usuarioActual();
  if (u?.rol !== "ADMIN") redirect("/");
  const users = await prisma.user.findMany({ select: { id: true, email: true, nombre: true, rol: true, activo: true, ultimoAcceso: true }, orderBy: { creadoEn: "asc" } });
  return <Usuarios yo={u.id} users={JSON.parse(JSON.stringify(users))} />;
}
