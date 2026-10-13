"use client";
import Link from "next/link";
import { useState } from "react";
import { HojaPreview } from "@/components/documentos/HojaPreview";
import { imprimirDocumento, urlDocumento } from "@/components/documentos/acciones";
import { TITULOS } from "@/components/documentos";
import { cartaPorDefecto } from "@/components/documentos/Carta";
import type { CartaContenido, DocData, TipoDocumento } from "@/components/documentos/tipos";
import { Alerta, Field, Input, Textarea, Toggle } from "@/components/ui";

export function Visor({ id, tipo, d }: { id: string; tipo: TipoDocumento; d: DocData }) {
  const [carta, setCarta] = useState<CartaContenido>(d.carta ?? cartaPorDefecto(d));
  const [guardado, setGuardado] = useState(true);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const dd: DocData = tipo === "carta" ? { ...d, carta } : d;

  const cambiar = (p: Partial<CartaContenido>) => {
    setCarta((c) => ({ ...c, ...p }));
    setGuardado(false);
  };

  async function guardarCarta() {
    setOcupado(true);
    setMsg(null);
    const r = await fetch(`/api/finiquitos/${id}/carta`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(carta) });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok) setMsg({ t: "error", m: j.campos?.[0]?.mensaje ?? j.error ?? "No se pudo guardar" });
    else {
      setGuardado(true);
      setMsg({ t: "ok", m: carta.revisada ? "Carta guardada como revisada. Ya puede imprimirse." : "Borrador guardado. Márquela como revisada para imprimirla sin la marca de borrador." });
    }
  }

  const exportBloqueado = tipo === "carta" && !guardado;

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/finiquitos/${id}`} className="text-sm font-bold underline">← Volver al finiquito</Link>
          <h1 className="text-lg font-black sm:text-xl">{TITULOS[tipo]}</h1>
          <p className="hint">{d.folio} · versión {d.version}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:gap-2">
          <button className="btn btn-dark btn-sm sm:btn" disabled={exportBloqueado} onClick={() => imprimirDocumento(id, tipo)}>Imprimir</button>
          <a className={`btn btn-ghost btn-sm sm:btn ${exportBloqueado ? "pointer-events-none opacity-50" : ""}`} href={urlDocumento(id, tipo, "pdf")}>PDF</a>
          <a className={`btn btn-ghost btn-sm sm:btn ${exportBloqueado ? "pointer-events-none opacity-50" : ""}`} href={urlDocumento(id, tipo, "png")}>PNG</a>
        </div>
      </div>

      {tipo === "carta" && (
        <section className="card no-print space-y-3">
          <Alerta tipo="warn" titulo="Revise antes de imprimir">El texto se generó únicamente con los datos capturados. Edítelo si hace falta y márquelo como revisado. La carta nunca se firma ni se marca como firmada: la firma debe ser autógrafa del trabajador.</Alerta>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <Field label="Lugar"><Input value={carta.lugar} onChange={(e) => cambiar({ lugar: e.target.value })} /></Field>
            <Field label="Fecha"><Input type="date" value={carta.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} /></Field>
            <Field label="Dirigida a"><Input value={carta.destinatario} onChange={(e) => cambiar({ destinatario: e.target.value })} /></Field>
            <Field label="Atención"><Input value={carta.atencion} onChange={(e) => cambiar({ atencion: e.target.value })} /></Field>
          </div>
          {carta.parrafos.map((p, i) => (
            <Field key={i} label={`Párrafo ${i + 1}`}>
              <Textarea value={p} onChange={(e) => cambiar({ parrafos: carta.parrafos.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className="mt-1 text-xs font-bold text-fire underline" onClick={() => cambiar({ parrafos: carta.parrafos.filter((_, j) => j !== i) })} disabled={carta.parrafos.length <= 1}>Quitar párrafo</button>
            </Field>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => cambiar({ parrafos: [...carta.parrafos, ""] })}>+ Párrafo</button>
          <Toggle checked={carta.revisada} onChange={(v) => cambiar({ revisada: v })} label="Revisé el texto y es correcto" hint="Quita la marca de “borrador sin revisar” de la impresión." />
          <div className="flex items-center gap-3">
            <button className="btn btn-primary" disabled={ocupado} onClick={guardarCarta}>{ocupado ? "Guardando…" : "Guardar carta"}</button>
            {!guardado && <span className="text-xs font-bold text-fire">Cambios sin guardar</span>}
          </div>
          {msg && <Alerta tipo={msg.t === "ok" ? "ok" : "error"}>{msg.m}</Alerta>}
        </section>
      )}

      <HojaPreview tipo={tipo} d={dd} />
    </div>
  );
}
