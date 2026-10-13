import type { Motivo } from "./schema";
import type { Antiguedad } from "../fechas";
import type { ParametrosLegales } from "../legal/types";

export const ENGINE_VERSION = "1.0.0";

export type EstadoCalculo = "DEFINITIVO" | "PROVISIONAL" | "INCOMPLETO";

export interface Pendiente {
  id: string;
  /** DATO: falta información del usuario. VALIDACION: regla/parámetro sin validar. */
  tipo: "DATO" | "VALIDACION";
  /** BLOQUEANTE: impide autorizar. ADVERTENCIA: el cálculo es provisional hasta resolverlo. */
  severidad: "BLOQUEANTE" | "ADVERTENCIA";
  campo?: string;
  mensaje: string;
}

export type GrupoConcepto = "SALARIOS" | "PRESTACIONES" | "SEPARACION" | "OTROS";

export interface FiscalConcepto {
  tratamiento: string;
  exento: string;
  gravado: string;
  isr: string;
  estado: "DEFINITIVO" | "PROVISIONAL" | "NO_APLICA";
}

export interface ConceptoCalculado {
  clave: string;
  nombre: string;
  grupo: GrupoConcepto;
  aplica: boolean;
  motivoNoAplica?: string;
  /** Días considerados (texto legible), p. ej. "14.5 días" */
  dias: string | null;
  diasDetalle?: string;
  baseSalarial: { etiqueta: string; monto: string } | null;
  formula: string;
  fundamento: string[];
  explicacion: string;
  generado: string;
  pagadoPreviamente: string;
  saldo: string;
  fiscal: FiscalConcepto;
  notas: string[];
}

export interface BloqueFiscal {
  id: "ORDINARIO" | "GRATIFICACIONES" | "SEPARACION";
  titulo: string;
  baseTotal: string;
  exento: string;
  gravado: string;
  isr: string;
  procedimiento: string[];
  fundamento: string[];
  estado: "DEFINITIVO" | "PROVISIONAL";
}

export interface DeduccionEvaluada {
  tipo: string;
  descripcion: string;
  montoSolicitado: string;
  montoAplicado: string;
  aplicada: boolean;
  motivo: string;
  fundamento: string;
}

export interface ResultadoFiniquito {
  motorVersion: string;
  fechaCalculo: string;
  estado: EstadoCalculo;
  motivo: Motivo;
  ejercicioPago: number;
  fechaPago: string;
  antiguedad: Antiguedad;
  salario: {
    tipoCapturado: string;
    montoCapturado: string | null;
    diario: string;
    diarioIntegrado: string;
    factorIntegracion: string;
    detalleIntegracion: string;
    minimoReferencia: { etiqueta: string; monto: string };
    explicacion: string;
  };
  conceptos: ConceptoCalculado[];
  deducciones: DeduccionEvaluada[];
  anticipos: { descripcion: string; monto: string; fecha: string | null }[];
  fiscal: {
    umaDiaria: string;
    baseExencion: string;
    baseExencionMonto: string;
    bloques: BloqueFiscal[];
    totalIsr: string;
    estado: "DEFINITIVO" | "PROVISIONAL";
  };
  totales: {
    generado: string;
    previamentePagado: string;
    saldoBruto: string;
    retenciones: string;
    deduccionesAplicadas: string;
    netoCalculado: string;
    anticiposEntregados: string;
    netoAPagar: string;
  };
  pendientes: Pendiente[];
  avisos: string[];
  supuestos: string[];
  /** Parámetros legales exactamente como se usaron (para conservar el cálculo original) */
  parametros: {
    salario: ParametrosLegales;
    pago: ParametrosLegales;
    usoParametrosSustitutos: string[];
  };
}
