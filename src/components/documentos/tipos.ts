import type { FiniquitoInput } from "@/lib/finiquito/schema";
import type { ResultadoFiniquito } from "@/lib/finiquito/types";

export interface EmpresaDoc {
  nombreComercial: string;
  razonSocial: string | null;
  rfc: string | null;
  registroPatronal: string | null;
  domicilioFiscal: string | null;
  ciudad: string;
  estado: string;
  pais: string;
  representanteLegal: string;
  cargoRepresentante: string | null;
}

export interface PagoDoc {
  fechaPago: string; // ISO
  monto: string;
  forma: string;
  referencia: string | null;
}

export interface CartaContenido {
  lugar: string;
  fecha: string; // ISO
  destinatario: string;
  atencion: string;
  fechaEfectiva: string; // ISO de la separación
  parrafos: string[];
  /** El texto fue revisado por una persona antes de imprimirse */
  revisada: boolean;
}

export interface DocData {
  empresa: EmpresaDoc;
  folio: string | null;
  version: number | null;
  estadoInterno: "BORRADOR" | "CALCULADO" | "REVISADO" | "AUTORIZADO" | "PAGADO" | "SIN_GUARDAR";
  datos: FiniquitoInput;
  resultado: ResultadoFiniquito;
  pagos: PagoDoc[];
  /** Fecha de generación del documento (ISO) */
  fechaGeneracion: string;
  autorizadoPor?: string | null;
  carta?: CartaContenido | null;
  historial?: { version: number; tipo: string; motivo: string | null; usuario: string; fecha: string }[];
}

export type TipoDocumento = "recibo" | "desglose" | "carta";
