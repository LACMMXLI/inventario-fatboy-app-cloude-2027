import { redirect } from "next/navigation";
import Link from "next/link";
import { usuarioActual } from "@/lib/server/auth";
import { Logo } from "@/components/ui";
import { SalirBoton } from "@/components/SalirBoton";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await usuarioActual();
  if (!user) redirect("/login");
  const admin = user.rol === "ADMIN";
  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <header className="no-print sticky top-0 z-30 bg-ink text-white">
        <div className="stripe" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-3">
            <Logo small />
            <span className="hidden text-sm font-semibold text-white/70 sm:inline">Finiquitos</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-semibold sm:flex">
            <Link className="rounded-lg px-3 py-2 hover:bg-white/10" href="/">Finiquitos</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-white/10" href="/finiquitos/nuevo">Nuevo cálculo</Link>
            {admin ? (
              <>
                <Link className="rounded-lg px-3 py-2 hover:bg-white/10" href="/admin/empresa">Empresa</Link>
                <Link className="rounded-lg px-3 py-2 hover:bg-white/10" href="/admin/parametros">Parámetros legales</Link>
                <Link className="rounded-lg px-3 py-2 hover:bg-white/10" href="/admin/usuarios">Usuarios</Link>
              </>
            ) : null}
          </nav>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-right leading-tight sm:block">
              <b className="block text-sm">{user.nombre}</b>
              <span className="text-white/60">{user.rol.toLowerCase()}</span>
            </span>
            <SalirBoton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-white text-center text-xs font-bold sm:hidden" style={{ gridTemplateColumns: admin ? "repeat(4,1fr)" : "repeat(2,1fr)" }}>
        <Link className="py-3" href="/">Finiquitos</Link>
        <Link className="bg-sun py-3" href="/finiquitos/nuevo">+ Nuevo</Link>
        {admin ? <Link className="py-3" href="/admin/parametros">Parámetros</Link> : null}
        {admin ? <Link className="py-3" href="/admin/empresa">Admin</Link> : null}
      </nav>
    </div>
  );
}
