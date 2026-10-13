import { redirect } from "next/navigation";
import Link from "next/link";
import { usuarioActual } from "@/lib/server/auth";
import { Logo } from "@/components/ui";
import { SalirBoton } from "@/components/SalirBoton";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await usuarioActual();
  if (!user) redirect("/login");
  const admin = user.rol === "ADMIN";
  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <header className="no-print sticky top-0 z-30 bg-gradient-to-r from-ink via-[#17171a] to-ink text-white shadow-lg">
        <div className="stripe" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-2.5">
          <Link href="/" className="flex items-center gap-3">
            <Logo small />
            <span className="hidden text-sm font-semibold text-white/70 xl:inline">Finiquitos</span>
          </Link>
          <Nav admin={admin} />
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-right leading-tight md:block">
              <b className="block text-sm">{user.nombre}</b>
              <span className="text-white/60">{user.rol.toLowerCase()}</span>
            </span>
            <SalirBoton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-5">{children}</main>
    </div>
  );
}
