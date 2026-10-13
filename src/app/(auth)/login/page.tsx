import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/server/auth";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/ui";

export const metadata = { title: "Iniciar sesión" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await usuarioActual()) redirect("/");
  return (
    <main className="flex min-h-screen flex-col bg-ink">
      <div className="stripe" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-6 flex flex-col items-center gap-2 text-center text-white">
          <Logo />
          <p className="text-sm text-white/70">Finiquitos y terminación laboral · Mexicali, B.C.</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-white/50">Acceso restringido a personal autorizado. Toda actividad queda registrada.</p>
      </div>
    </main>
  );
}
