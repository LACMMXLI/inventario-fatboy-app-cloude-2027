"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alerta, Field, Input } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error ?? "No se pudo iniciar sesión");
      else {
        router.replace("/");
        router.refresh();
      }
    } catch {
      setError("Sin conexión con el servidor");
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="card space-y-4 border-0 p-6 shadow-2xl">
      <h1 className="text-xl font-extrabold">Iniciar sesión</h1>
      {error ? <Alerta tipo="error">{error}</Alerta> : null}
      <Field label="Correo electrónico">
        <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Contraseña">
        <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button className="btn btn-primary w-full" disabled={cargando}>
        {cargando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
