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
    <div className="space-y-3 sm:space-y-5">
      <div className="hero !p-3 sm:!p-5"><div className="relative z-10"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-sun">Administración</p><h1 className="text-xl sm:text-3xl">Usuarios y permisos</h1></div></div>
      {msg && <Alerta tipo={msg.t === "ok" ? "ok" : "error"}>{msg.m}</Alerta>}
      <section className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:hidden">
        {users.map((u) => (
          <div key={u.id} className={`card space-y-2 ${u.activo ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-extrabold leading-tight">{u.nombre}{u.id === yo ? " (usted)" : ""}</p>
                <p className="truncate text-xs text-muted">{u.email}</p>
              </div>
              <span className={`chip shrink-0 ${u.activo ? "border-ok bg-ok-soft text-ok" : "border-line bg-fog text-muted"}`}>{u.activo ? "Activo" : "Inactivo"}</span>
            </div>
            <div className="grid grid-cols-2 items-center gap-2">
              <Select value={u.rol} disabled={u.id === yo} onChange={(e) => cambiar(u.id, { rol: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l.split(" – ")[0]}</option>)}</Select>
              <p className="text-right text-[11px] text-muted">{u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString("es-MX", { timeZone: "America/Tijuana", dateStyle: "short", timeStyle: "short" }) : "Sin accesos"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-ghost btn-sm" disabled={u.id === yo} onClick={() => cambiar(u.id, { activo: !u.activo })}>{u.activo ? "Desactivar" : "Activar"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { const p = prompt("Nueva contraseña (mín. 12 caracteres, con mayúsculas, minúsculas y números):"); if (p) cambiar(u.id, { password: p }); }}>Contraseña</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card hidden p-0 lg:block">
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
      <section className="card card-accent grid grid-cols-2 gap-2.5 pl-5 sm:gap-4">
        <h2 className="col-span-2 text-base font-extrabold sm:text-lg">Nuevo usuario</h2>
        <Field label="Nombre" className="col-span-2 sm:col-span-1"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <Field label="Correo" className="col-span-2 sm:col-span-1"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="off" /></Field>
        <Field label="Rol" className="col-span-2 sm:col-span-1"><Select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Contraseña inicial" className="col-span-2 sm:col-span-1" hint="Mínimo 12 caracteres con mayúsculas, minúsculas y números."><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
        <div className="col-span-2"><button className="btn btn-primary" onClick={crear}>Crear usuario</button></div>
      </section>
    </div>
  );
}
