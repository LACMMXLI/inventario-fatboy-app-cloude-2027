"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alerta, CalculoChip, EstadoChip, Field, Input, Money, Select, Textarea } from "@/components/ui";
import { ResultView } from "@/components/finiquito/ResultView";
import type { ResultadoFiniquito } from "@/lib/finiquito/types";
import { money } from "@/lib/money";
import { fechaCorta, fechaLarga } from "@/lib/fechas";
import { imprimirDocumento, urlDocumento } from "@/components/documentos/acciones";

interface F {
  id: string; folio: string; estado: string; estadoCalculo: string; version: number; trabajador: string; puesto: string; sucursal: string;
  creadoEn: string; actualizadoEn: string; revisadoEn: string | null; autorizadoEn: string | null; pagadoEn: string | null;
  creadoPor: string | null; modificadoPor: string | null; revisadoPor: string | null; autorizadoPor: string | null;
  totalNeto: string; validacionManual: { por: string; en: string; nota: string } | null; cartaDisponible: boolean;
}
interface P { id: string; monto: string; fechaPago: string; forma: string; referencia: string | null; registradoPor: string; anulado: boolean; motivoAnulacion: string | null }
interface Rev { id: string; version: number; tipo: string; motivo: string | null; estadoNuevo: string | null; userNombre: string; creadoEn: string }

const TIPO_REV: Record<string, string> = { CREACION: "Creación (cálculo original)", MODIFICACION: "Modificación", CAMBIO_ESTADO: "Cambio de estado", CORRECCION: "Corrección documentada", PAGO: "Pago registrado", ANULACION_PAGO: "Pago anulado", VALIDACION_FISCAL: "Autorización con validación manual" };

export function Detalle({ f, resultado, pagos, revisiones, rol }: { f: F; resultado: ResultadoFiniquito; pagos: P[]; revisiones: Rev[]; rol: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState<null | { accion: "AUTORIZAR" | "DEVOLVER"; titulo: string; ayuda: string; min: number }>(null);
  const [nota, setNota] = useState("");
  const puedeAutorizar = rol === "ADMIN" || rol === "AUTORIZADOR";
  const vigentes = pagos.filter((p) => !p.anulado);
  const pagado = vigentes.reduce((a, p) => a + Number(p.monto), 0);
  const saldo = Math.max(0, Number(f.totalNeto) - pagado);

  async function llamar(url: string, body: unknown) {
    setOcupado(true);
    setError(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error ?? "No se pudo completar la acción");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setOcupado(false);
    }
  }
  const estado = (accion: string, n?: string) => llamar(`/api/finiquitos/${f.id}/estado`, { accion, nota: n });

  const docs: { tipo: string; titulo: string; ok: boolean; nota?: string }[] = [
    { tipo: "recibo", titulo: "Recibo y desglose de finiquito", ok: true },
    { tipo: "desglose", titulo: "Desglose explicativo", ok: true },
    { tipo: "carta", titulo: "Carta de renuncia voluntaria", ok: f.cartaDisponible, nota: "Solo si la renuncia es voluntaria y se confirmó la voluntad del trabajador." },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm font-bold underline">← Finiquitos</Link>
          <h1 className="mt-1 text-2xl font-black">{f.trabajador}</h1>
          <p className="text-sm text-muted">{f.folio} · {f.puesto} · {f.sucursal} · versión {f.version}</p>
          <div className="mt-2 flex gap-2"><EstadoChip estado={f.estado} /><CalculoChip estado={f.estadoCalculo} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["BORRADOR", "CALCULADO", "REVISADO"].includes(f.estado) && <Link href={`/finiquitos/${f.id}/editar`} className="btn btn-ghost">Editar</Link>}
          {["AUTORIZADO", "PAGADO"].includes(f.estado) && puedeAutorizar && <Link href={`/finiquitos/${f.id}/editar`} className="btn btn-ghost">Corregir (documentado)</Link>}
          {f.estado === "BORRADOR" && <button className="btn btn-dark" disabled={ocupado} onClick={() => estado("CALCULAR")}>Marcar como calculado</button>}
          {f.estado === "CALCULADO" && <button className="btn btn-dark" disabled={ocupado} onClick={() => estado("REVISAR")}>Marcar como revisado</button>}
          {f.estado === "REVISADO" && puedeAutorizar && (
            <button className="btn btn-primary" disabled={ocupado} onClick={() => { setNota(""); setModal({ accion: "AUTORIZAR", titulo: "Autorizar finiquito", ayuda: resultado.estado === "PROVISIONAL" ? "El cálculo es PROVISIONAL. Describa quién y cómo validó los pendientes (mínimo 20 caracteres). Quedará registrado." : "Opcional: agregue una nota.", min: resultado.estado === "PROVISIONAL" ? 20 : 0 }); }}>Autorizar</button>
          )}
          {["CALCULADO", "REVISADO"].includes(f.estado) && <button className="btn btn-ghost" disabled={ocupado} onClick={() => { setNota(""); setModal({ accion: "DEVOLVER", titulo: "Devolver al estado anterior", ayuda: "Indique el motivo.", min: 5 }); }}>Devolver</button>}
        </div>
      </div>

      {error && <Alerta tipo="error">{error}</Alerta>}
      {f.validacionManual && <Alerta tipo="warn" titulo="Autorizado con validación manual de pendientes">Por {f.validacionManual.por} el {fechaLarga(f.validacionManual.en.slice(0, 10))}: “{f.validacionManual.nota}”</Alerta>}
      {resultado.estado === "INCOMPLETO" && <Alerta tipo="error" titulo="Cálculo incompleto">No puede autorizarse hasta resolver los pendientes bloqueantes.</Alerta>}

      <div className="grid gap-3 text-sm sm:grid-cols-4">
        <div className="card"><p className="label">Creado por</p><b>{f.creadoPor ?? "—"}</b><p className="hint">{fechaCorta(f.creadoEn.slice(0, 10))}</p></div>
        <div className="card"><p className="label">Última modificación</p><b>{f.modificadoPor ?? f.creadoPor ?? "—"}</b><p className="hint">{fechaCorta(f.actualizadoEn.slice(0, 10))}</p></div>
        <div className="card"><p className="label">Revisó</p><b>{f.revisadoPor ?? "—"}</b><p className="hint">{f.revisadoEn ? fechaCorta(f.revisadoEn.slice(0, 10)) : "pendiente"}</p></div>
        <div className="card"><p className="label">Autorizó</p><b>{f.autorizadoPor ?? "—"}</b><p className="hint">{f.autorizadoEn ? fechaCorta(f.autorizadoEn.slice(0, 10)) : "pendiente"}</p></div>
      </div>

      <section className="card">
        <h2 className="mb-3 text-lg font-extrabold">Documentos</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {docs.map((d) => (
            <div key={d.tipo} className={`rounded-xl border-2 p-3 ${d.ok ? "border-line" : "border-line bg-fog opacity-70"}`}>
              <p className="font-bold">{d.titulo}</p>
              {d.ok ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link className="btn btn-dark btn-sm" href={`/finiquitos/${f.id}/documentos/${d.tipo}`}>Vista previa</Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => imprimirDocumento(f.id, d.tipo)}>Imprimir</button>
                  <a className="btn btn-ghost btn-sm" href={urlDocumento(f.id, d.tipo, "pdf")}>PDF</a>
                  <a className="btn btn-ghost btn-sm" href={urlDocumento(f.id, d.tipo, "png")}>PNG</a>
                </div>
              ) : <p className="hint mt-1">{d.nota}</p>}
            </div>
          ))}
        </div>
        <p className="hint mt-2">Los archivos se generan en el servidor y se conservan con su huella SHA-256. {vigentes.length ? "El recibo incluye los pagos registrados." : "Mientras no haya pagos registrados, el recibo se emite como cálculo pendiente de pago y no acredita pago alguno."}</p>
      </section>

      {["AUTORIZADO", "PAGADO"].includes(f.estado) && <Pagos f={f} pagos={pagos} saldo={saldo} pagado={pagado} puede={puedeAutorizar} onError={setError} />}

      <ResultView r={resultado} />

      <section className="card">
        <h2 className="mb-2 text-lg font-extrabold">Historial de modificaciones</h2>
        <div className="table-wrap">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b-2 border-ink text-left text-xs uppercase text-muted"><th className="py-2">Versión</th><th>Movimiento</th><th>Detalle</th><th>Usuario</th><th>Fecha</th></tr></thead>
            <tbody>
              {revisiones.map((r) => (
                <tr key={r.id} className="border-b border-line align-top">
                  <td className="py-2 font-mono">v{r.version}</td><td className="font-semibold">{TIPO_REV[r.tipo] ?? r.tipo}{r.estadoNuevo ? <span className="block text-xs font-normal text-muted">→ {r.estadoNuevo.toLowerCase()}</span> : null}</td>
                  <td>{r.motivo ?? "—"}</td><td>{r.userNombre}</td><td className="whitespace-nowrap">{fechaCorta(r.creadoEn.slice(0, 10))} {new Date(r.creadoEn).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Tijuana" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint mt-2">Cada versión conserva los datos, el resultado y los parámetros legales usados. Nada se sobrescribe en silencio.</p>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="card w-full max-w-md space-y-3">
            <h3 className="text-lg font-extrabold">{modal.titulo}</h3>
            <p className="hint">{modal.ayuda}</p>
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder={modal.min ? `Mínimo ${modal.min} caracteres` : "Nota (opcional)"} />
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={ocupado || nota.trim().length < modal.min} onClick={async () => { if (await estado(modal.accion, nota)) setModal(null); }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pagos({ f, pagos, saldo, pagado, puede, onError }: { f: F; pagos: P[]; saldo: number; pagado: number; puede: boolean; onError: (e: string | null) => void }) {
  const router = useRouter();
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Tijuana" });
  const [monto, setMonto] = useState(saldo > 0 ? saldo.toFixed(2) : "");
  const [fecha, setFecha] = useState(hoy);
  const [forma, setForma] = useState("TRANSFERENCIA");
  const [ref, setRef] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [anular, setAnular] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  async function post(url: string, body: unknown) {
    setOcupado(true);
    onError(null);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok) { onError(j.error ?? "Error"); return false; }
    router.refresh();
    return true;
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">Pagos</h2>
        <p className="text-sm">Neto {money(f.totalNeto)} · Pagado <b>{money(pagado)}</b> · Saldo <b className={saldo > 0 ? "text-fire" : "text-ok"}>{money(saldo)}</b></p>
      </div>
      {pagos.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {pagos.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${p.anulado ? "opacity-50 line-through" : ""}`}>
              <span><b>{money(p.monto)}</b> · {fechaCorta(p.fechaPago)} · {p.forma}{p.referencia ? ` · ref. ${p.referencia}` : ""} <span className="text-xs text-muted">(registró {p.registradoPor})</span>{p.anulado ? <span className="text-xs"> — anulado: {p.motivoAnulacion}</span> : null}</span>
              {!p.anulado && puede && <button className="btn btn-ghost btn-sm" onClick={() => { setAnular(p.id); setMotivo(""); }}>Anular</button>}
            </li>
          ))}
        </ul>
      )}
      {f.estado === "AUTORIZADO" && puede && saldo > 0 && (
        <div className="grid items-end gap-3 rounded-xl bg-fog p-3 sm:grid-cols-5">
          <Field label="Monto pagado"><Money value={monto} onChange={setMonto} /></Field>
          <Field label="Fecha de pago"><Input type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
          <Field label="Forma"><Select value={forma} onChange={(e) => setForma(e.target.value)}><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option><option value="CHEQUE">Cheque</option><option value="OTRO">Otro</option></Select></Field>
          <Field label="Referencia"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Folio, cheque…" /></Field>
          <button className="btn btn-primary" disabled={ocupado || !monto} onClick={() => post(`/api/finiquitos/${f.id}/pagos`, { monto: Number(monto), fechaPago: fecha, forma, referencia: ref || null })}>Registrar pago</button>
        </div>
      )}
      <p className="hint">Registre solo pagos que efectivamente se hicieron. El recibo en PDF acredita únicamente los pagos listados aquí.</p>
      {anular && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="card w-full max-w-md space-y-3">
            <h3 className="text-lg font-extrabold">Anular pago</h3>
            <p className="hint">El pago no se borra: queda anulado en el historial con el motivo.</p>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (mín. 10 caracteres)" />
            <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setAnular(null)}>Cancelar</button>
              <button className="btn btn-danger" disabled={ocupado || motivo.trim().length < 10} onClick={async () => { if (await post(`/api/finiquitos/${f.id}/pagos/${anular}`, { motivo })) setAnular(null); }}>Anular pago</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
