import type { ReactNode } from "react";
import { fechaLarga, fechaCorta } from "@/lib/fechas";
import { MOTIVO_LABEL } from "@/lib/finiquito/schema";
import { money } from "@/lib/money";
import type { DocData, EmpresaDoc } from "./tipos";

export const NC = ({ children = "No configurado" }: { children?: ReactNode }) => <span className="fb-nc">{children}</span>;

export function Encabezado({ empresa, titulo, subtitulo }: { empresa: EmpresaDoc; titulo: string; subtitulo?: ReactNode }) {
  return (
    <div className="fb-head">
      <div className="fb-marca">
        <div className="fb-logo">{empresa.nombreComercial.toUpperCase()}</div>
        <small>
          {empresa.razonSocial ?? ""}
          {empresa.razonSocial ? <br /> : null}
          {empresa.ciudad}, {empresa.estado}, {empresa.pais}
        </small>
      </div>
      <div className="fb-titulo">
        <h1>{titulo}</h1>
        {subtitulo ? <p>{subtitulo}</p> : null}
      </div>
    </div>
  );
}

export function AvisoConfiguracion({ empresa }: { empresa: EmpresaDoc }) {
  const falta = [!empresa.razonSocial && "razón social", !empresa.rfc && "RFC", !empresa.domicilioFiscal && "domicilio fiscal"].filter(Boolean);
  if (!falta.length) return null;
  return (
    <div className="fb-solo-pantalla">
      Faltan datos legales de la empresa ({falta.join(", ")}). Configúrelos en Administración → Empresa; mientras tanto se imprimen como “No configurado”.
    </div>
  );
}

export function DatosEmpresa({ empresa }: { empresa: EmpresaDoc }) {
  return (
    <div className="fb-caja">
      <h3>Patrón</h3>
      <div className="fb-kv"><span>Nombre comercial</span><span>{empresa.nombreComercial}</span></div>
      <div className="fb-kv"><span>Razón social</span><span>{empresa.razonSocial ?? <NC />}</span></div>
      <div className="fb-kv"><span>RFC</span><span>{empresa.rfc ?? <NC />}</span></div>
      <div className="fb-kv"><span>Registro patronal</span><span>{empresa.registroPatronal ?? <NC>—</NC>}</span></div>
      <div className="fb-kv"><span>Domicilio</span><span>{empresa.domicilioFiscal ?? <NC />}</span></div>
      <div className="fb-kv"><span>Representante legal</span><span>{empresa.representanteLegal}</span></div>
    </div>
  );
}

export function DatosTrabajador({ d }: { d: DocData }) {
  const t = d.datos.trabajador;
  const a = d.resultado.antiguedad;
  return (
    <div className="fb-caja">
      <h3>Trabajador</h3>
      <div className="fb-kv"><span>Nombre</span><span>{t.nombre}</span></div>
      <div className="fb-kv"><span>Puesto</span><span>{t.puesto}</span></div>
      <div className="fb-kv"><span>Sucursal</span><span>{t.sucursal}</span></div>
      <div className="fb-kv"><span>Fecha de ingreso</span><span>{fechaCorta(d.datos.fechaIngreso)}</span></div>
      <div className="fb-kv"><span>Fecha de terminación</span><span>{fechaCorta(d.datos.fechaTerminacion)}</span></div>
      <div className="fb-kv"><span>Antigüedad</span><span>{a.texto}</span></div>
    </div>
  );
}

export function DatosTerminacion({ d }: { d: DocData }) {
  const s = d.resultado.salario;
  return (
    <div className="fb-grid">
      <div className="fb-caja">
        <h3>Terminación</h3>
        <div className="fb-kv"><span>Motivo</span><span>{MOTIVO_LABEL[d.datos.motivo]}</span></div>
        {d.datos.detalleMotivo ? <div className="fb-kv"><span>Detalle</span><span>{d.datos.detalleMotivo}</span></div> : null}
        <div className="fb-kv"><span>Tipo de contrato</span><span>{d.datos.tipoContrato === "INDETERMINADO" ? "Tiempo indeterminado" : "Tiempo determinado"}</span></div>
      </div>
      <div className="fb-caja">
        <h3>Base salarial</h3>
        <div className="fb-kv"><span>Salario diario</span><span>{money(s.diario)}</span></div>
        <div className="fb-kv"><span>Salario diario integrado</span><span>{money(s.diarioIntegrado)}</span></div>
        <div className="fb-kv"><span>Fecha de pago considerada</span><span>{fechaCorta(d.resultado.fechaPago)}</span></div>
      </div>
    </div>
  );
}

export function Pie({ d, texto }: { d: DocData; texto: string }) {
  return (
    <div className="fb-pie">
      <span>{texto}</span>
      <span>
        {d.folio ? `Folio ${d.folio}` : "Sin guardar"}
        {d.version ? ` · v${d.version}` : ""} · Generado el {fechaCorta(d.fechaGeneracion)}
      </span>
    </div>
  );
}

export const lugarFecha = (e: EmpresaDoc, fechaISO: string) => `${e.ciudad}, ${e.estado}, a ${fechaLarga(fechaISO)}`;
