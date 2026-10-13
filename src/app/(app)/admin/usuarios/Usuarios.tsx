"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alerta, Field, Input, Select } from "@/components/ui";

interface U { id: string; email: string; nombre: string; rol: string; activo: boolean; ultimoAcceso: string | null }
const ROLES = [["OPERADOR", "Operador – captura y calcula"], ["AUTORIZADOR", "Autorizador – revisa, autoriza, registra pagos y corrige"], ["ADMIN", "Administrador – todo, incluye usuarios y parámetros"]];

export function Usuarios({ users, yo }: { users: U[]; yo: string }) {
  const router = useRouter();
  const [f, setF] = useState({ email: "", nombre: "", rol: "OPERADOR", password: "" });
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);

  async function crear() {
    setMsg(null);
    const r = await fetch("/api/admin/usuarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json();
    if (!r.ok) setMsg({ t: "error", m: j.campos?.[0]?.mensaje ?? j.error });
    else { setMsg({ t: "ok", m: "Usuario creado." }); setF({ email: "", nombre: "", rol: "OPERADOR", password: "" }); router.refresh(); }
  }
  async function cambiar(id: string, body: object) {
    setMsg(null);
    const r = await fetch(`/api/admin/usuarios/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) setMsg({ t: "error", m: j.error ?? "Error" }); else router.refresh();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Usuarios y permisos</h1>
      {msg && <Alerta tipo={msg.t === "ok" ? "ok" : "error"}>{msg.m}</Alerta>}
      <section className="card p-0">
        <div className="table-wrap">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b-2 border-ink text-left text-xs uppercase text-muted"><th className="p-3">Usuario</th><th className="p-3">Rol</th><th className="p-3">Último acceso</th><th className="p-3">Acciones</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line">
                  <td className="p-3 font-semibold">{u.nombre}<span className="block text-xs font-normal text-muted">{u.email}</span></td>
                  <td className="p-3"><Select value={u.rol} disabled={u.id === yo} onChange={(e) => cambiar(u.id, { rol: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l.split(" – ")[0]}</option>)}</Select></td>
                  <td className="p-3 text-xs">{u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString("es-MX", { timeZone: "America/Tijuana" }) : "—"}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-2">
                    <button className="btn btn-ghost btn-sm" disabled={u.id === yo} onClick={() => cambiar(u.id, { activo: !u.activo })}>{u.activo ? "Desactivar" : "Activar"}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { const p = prompt("Nueva contraseña (mín. 12 caracteres, con mayúsculas, minúsculas y números):"); if (p) cambiar(u.id, { password: p }); }}>Cambiar contraseña</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-extrabold sm:col-span-2">Nuevo usuario</h2>
        <Field label="Nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <Field label="Correo"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="off" /></Field>
        <Field label="Rol"><Select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Contraseña inicial" hint="Mínimo 12 caracteres con mayúsculas, minúsculas y números."><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
        <div className="sm:col-span-2"><button className="btn btn-primary" onClick={crear}>Crear usuario</button></div>
      </section>
    </div>
  );
}
