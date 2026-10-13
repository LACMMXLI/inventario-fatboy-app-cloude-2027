import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/server/auth";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/ui";

export const metadata = { title: "Iniciar sesión" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await usuarioActual()) redirect("/");
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-ink">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sun/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-fire/50 blur-3xl" />
      <div className="stripe relative z-10" />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-7 flex flex-col items-center gap-3 text-center text-white">
          <Logo />
          <h2 className="text-3xl font-black leading-tight">Finiquitos claros,<br /><span className="text-sun">cálculos correctos.</span></h2>
          <p className="text-sm text-white/70">Calcula, documenta y autoriza cada salida · Mexicali, B.C.</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-white/50">Acceso restringido a personal autorizado. Toda actividad queda registrada.</p>
      </div>
    </main>
  );
}
