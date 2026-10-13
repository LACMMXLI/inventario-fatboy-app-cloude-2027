"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alerta, Field, Input, Select, Toggle } from "@/components/ui";

interface E { nombreComercial: string; razonSocial: string | null; rfc: string | null; registroPatronal: string | null; domicilioFiscal: string | null; ciudad: string; estado: string; representanteLegal: string; cargoRepresentante: string | null; telefono: string | null; correo: string | null; zonaSalarialDefault: string }
interface S { id: string; nombre: string; domicilio: string | null; activa: boolean }

export function EmpresaForm({ empresa, sucursales }: { empresa: E; sucursales: S[] }) {
  const router = useRouter();
  const [e, setE] = useState({ ...empresa, razonSocial: empresa.razonSocial ?? "", rfc: empresa.rfc ?? "", registroPatronal: empresa.registroPatronal ?? "", domicilioFiscal: empresa.domicilioFiscal ?? "", cargoRepresentante: empresa.cargoRepresentante ?? "", telefono: empresa.telefono ?? "", correo: empresa.correo ?? "" });
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const [sucs, setSucs] = useState(sucursales);
  const [nueva, setNueva] = useState("");
  const set = (k: keyof typeof e, v: string) => setE((p) => ({ ...p, [k]: v }));

  async function guardar() {
    setMsg(null);
    const r = await fetch("/api/admin/empresa", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e) });
    const j = await r.json();
    setMsg(r.ok ? { t: "ok", m: "Datos de la empresa guardados." } : { t: "error", m: j.campos?.map((c: { campo: string; mensaje: string }) => `${c.campo}: ${c.mensaje}`).join("; ") ?? j.error });
    if (r.ok) router.refresh();
  }
  async function guardarSucursal(s: Partial<S>) {
    const r = await fetch("/api/admin/sucursales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    const j = await r.json();
    if (!r.ok) { setMsg({ t: "error", m: j.error ?? "Error" }); return; }
    setSucs((l) => (s.id ? l.map((x) => (x.id === j.id ? j : x)) : [...l, j]));
    setNueva("");
    router.refresh();
  }

  return (
    <div className="space-y-3 sm:space-y-5">
      <div className="hero !p-3 sm:!p-5"><div className="relative z-10"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-sun">Administración</p><h1 className="text-xl sm:text-3xl">Datos de la empresa</h1></div></div>
      <Alerta tipo="info">Aparece en los documentos. Lo que no capture se imprime como “No configurado”.</Alerta>
      <section className="card card-accent grid grid-cols-2 gap-x-2.5 gap-y-2.5 pl-5 sm:gap-4">
        <Field label="Nombre comercial" className="col-span-2 sm:col-span-1"><Input value={e.nombreComercial} onChange={(x) => set("nombreComercial", x.target.value)} /></Field>
        <Field label="Razón social" className="col-span-2 sm:col-span-1"><Input value={e.razonSocial} onChange={(x) => set("razonSocial", x.target.value)} placeholder="Como aparece en su constancia fiscal" /></Field>
        <Field label="RFC"><Input value={e.rfc} maxLength={13} onChange={(x) => set("rfc", x.target.value.toUpperCase())} /></Field>
        <Field label="Reg. patronal (IMSS)"><Input value={e.registroPatronal} onChange={(x) => set("registroPatronal", x.target.value)} /></Field>
        <Field label="Domicilio fiscal" className="col-span-2"><Input value={e.domicilioFiscal} onChange={(x) => set("domicilioFiscal", x.target.value)} /></Field>
        <Field label="Ciudad"><Input value={e.ciudad} onChange={(x) => set("ciudad", x.target.value)} /></Field>
        <Field label="Estado"><Input value={e.estado} onChange={(x) => set("estado", x.target.value)} /></Field>
        <Field label="Representante legal" className="col-span-2 sm:col-span-1"><Input value={e.representanteLegal} onChange={(x) => set("representanteLegal", x.target.value)} /></Field>
        <Field label="Cargo" className="col-span-2 sm:col-span-1"><Input value={e.cargoRepresentante} onChange={(x) => set("cargoRepresentante", x.target.value)} /></Field>
        <Field label="Teléfono"><Input value={e.telefono} onChange={(x) => set("telefono", x.target.value)} /></Field>
        <Field label="Correo" className="col-span-2 sm:col-span-1"><Input type="email" value={e.correo} onChange={(x) => set("correo", x.target.value)} /></Field>
        <Field label="Zona salarial por omisión" className="col-span-2" hint="Mexicali: Zona Libre de la Frontera Norte.">
          <Select value={e.zonaSalarialDefault} onChange={(x) => set("zonaSalarialDefault", x.target.value)}><option value="ZLFN">Zona Libre de la Frontera Norte</option><option value="GENERAL">Zona del Salario Mínimo General</option></Select>
        </Field>
      </section>
      {msg && <Alerta tipo={msg.t === "ok" ? "ok" : "error"}>{msg.m}</Alerta>}
      <button className="btn btn-primary w-full sm:w-auto" onClick={guardar}>Guardar datos de la empresa</button>

      <section className="card card-accent space-y-3 pl-5">
        <h2 className="text-base font-extrabold sm:text-lg">Sucursales</h2>
        <ul className="divide-y divide-line">
          {sucs.map((s) => (
            <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-2 py-1.5">
              <span className={s.activa ? "font-bold" : "text-muted line-through"}>{s.nombre}</span>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" className="h-5 w-5 accent-black" checked={s.activa} onChange={(e) => guardarSucursal({ ...s, activa: e.target.checked })} />{s.activa ? "Activa" : "Inactiva"}</label>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input value={nueva} onChange={(x) => setNueva(x.target.value)} placeholder="Nueva sucursal" />
          <button className="btn btn-dark" disabled={nueva.trim().length < 2} onClick={() => guardarSucursal({ nombre: nueva.trim(), activa: true })}>Agregar</button>
        </div>
        <p className="hint">Las sucursales con finiquitos no se borran: se desactivan para conservar el historial.</p>
      </section>
    </div>
  );
}
