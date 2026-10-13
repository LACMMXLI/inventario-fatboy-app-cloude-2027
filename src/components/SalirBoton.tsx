"use client";
import { useRouter } from "next/navigation";

export function SalirBoton() {
  const router = useRouter();
  return (
    <button
      className="rounded-lg border border-white/30 px-3 py-1.5 font-semibold hover:bg-white/10"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
    >
      Salir
    </button>
  );
}
