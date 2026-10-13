"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DOC_CSS } from "./estilos";
import { Documento } from "./index";
import type { DocData, TipoDocumento } from "./tipos";

const ANCHO = 816; // 8.5in a 96dpi

/** Muestra el documento como una hoja carta real, escalada al ancho disponible (celular, tableta o PC). */
export function HojaPreview({ tipo, d }: { tipo: TipoDocumento; d: DocData }) {
  const cont = useRef<HTMLDivElement>(null);
  const hoja = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [alto, setAlto] = useState(1056);
  const [zoom, setZoom] = useState(false);

  useLayoutEffect(() => {
    const medir = () => {
      const w = cont.current?.clientWidth ?? ANCHO;
      const ajuste = Math.min(1, (w - 12) / ANCHO);
      setEscala(zoom ? Math.max(ajuste, 0.9) : ajuste);
      setAlto(hoja.current?.scrollHeight ?? 1056);
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (cont.current) ro.observe(cont.current);
    if (hoja.current) ro.observe(hoja.current);
    return () => ro.disconnect();
  }, [zoom]);

  useEffect(() => {
    setAlto(hoja.current?.scrollHeight ?? 1056);
  }, [d, tipo]);

  return (
    <div>
      <div className="no-print mb-1.5 flex justify-end gap-1.5 sm:hidden">
        <button type="button" onClick={() => setZoom(false)} className={`btn btn-sm ${!zoom ? "btn-dark" : "btn-ghost"}`}>Ajustar a pantalla</button>
        <button type="button" onClick={() => setZoom(true)} className={`btn btn-sm ${zoom ? "btn-dark" : "btn-ghost"}`}>Leer (zoom)</button>
      </div>
    <div ref={cont} className="hoja-wrap" style={{ overflowX: zoom ? "auto" : "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: DOC_CSS }} />
      <div style={{ height: alto * escala, width: ANCHO * escala, margin: "0 auto" }}>
        <div ref={hoja} className="hoja" style={{ width: ANCHO, transform: `scale(${escala})` }}>
          <Documento tipo={tipo} d={d} />
        </div>
      </div>
    </div>
    </div>
  );
}
