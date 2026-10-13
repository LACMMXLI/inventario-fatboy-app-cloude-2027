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

  useLayoutEffect(() => {
    const medir = () => {
      const w = cont.current?.clientWidth ?? ANCHO;
      setEscala(Math.min(1, (w - 24) / ANCHO));
      setAlto(hoja.current?.scrollHeight ?? 1056);
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (cont.current) ro.observe(cont.current);
    if (hoja.current) ro.observe(hoja.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setAlto(hoja.current?.scrollHeight ?? 1056);
  }, [d, tipo]);

  return (
    <div ref={cont} className="hoja-wrap">
      <style dangerouslySetInnerHTML={{ __html: DOC_CSS }} />
      <div style={{ height: alto * escala, width: ANCHO * escala, margin: "0 auto" }}>
        <div ref={hoja} className="hoja" style={{ width: ANCHO, transform: `scale(${escala})` }}>
          <Documento tipo={tipo} d={d} />
        </div>
      </div>
    </div>
  );
}
