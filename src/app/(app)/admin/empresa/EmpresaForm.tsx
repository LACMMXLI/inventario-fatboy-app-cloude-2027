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
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Datos de la empresa</h1>
      <Alerta tipo="info">Esta información aparece en los documentos. No se inventa nada: los datos que no capture se imprimen como “No configurado”.</Alerta>
      <section className="card grid gap-4 sm:grid-cols-2">
        <Field label="Nombre comercial"><Input value={e.nombreComercial} onChange={(x) => set("nombreComercial", x.target.value)} /></Field>
        <Field label="Razón social"><Input value={e.razonSocial} onChange={(x) => set("razonSocial", x.target.value)} placeholder="Como aparece en su constancia fiscal" /></Field>
        <Field label="RFC"><Input value={e.rfc} maxLength={13} onChange={(x) => set("rfc", x.target.value.toUpperCase())} /></Field>
        <Field label="Registro patronal (IMSS)"><Input value={e.registroPatronal} onChange={(x) => set("registroPatronal", x.target.value)} /></Field>
        <Field label="Domicilio fiscal" className="sm:col-span-2"><Input value={e.domicilioFiscal} onChange={(x) => set("domicilioFiscal", x.target.value)} /></Field>
        <Field label="Ciudad"><Input value={e.ciudad} onChange={(x) => set("ciudad", x.target.value)} /></Field>
        <Field label="Estado"><Input value={e.estado} onChange={(x) => set("estado", x.target.value)} /></Field>
        <Field label="Representante legal"><Input value={e.representanteLegal} onChange={(x) => set("representanteLegal", x.target.value)} /></Field>
        <Field label="Cargo del representante"><Input value={e.cargoRepresentante} onChange={(x) => set("cargoRepresentante", x.target.value)} /></Field>
        <Field label="Teléfono"><Input value={e.telefono} onChange={(x) => set("telefono", x.target.value)} /></Field>
        <Field label="Correo"><Input type="email" value={e.correo} onChange={(x) => set("correo", x.target.value)} /></Field>
        <Field label="Zona salarial por omisión" hint="Mexicali: Zona Libre de la Frontera Norte.">
          <Select value={e.zonaSalarialDefault} onChange={(x) => set("zonaSalarialDefault", x.target.value)}><option value="ZLFN">Zona Libre de la Frontera Norte</option><option value="GENERAL">Zona del Salario Mínimo General</option></Select>
        </Field>
      </section>
      {msg && <Alerta tipo={msg.t === "ok" ? "ok" : "error"}>{msg.m}</Alerta>}
      <button className="btn btn-primary" onClick={guardar}>Guardar datos de la empresa</button>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">Sucursales</h2>
        <ul className="divide-y divide-line">
          {sucs.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className={s.activa ? "font-bold" : "text-muted line-through"}>{s.nombre}</span>
              <Toggle checked={s.activa} onChange={(v) => guardarSucursal({ ...s, activa: v })} label={s.activa ? "Activa" : "Inactiva"} />
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
