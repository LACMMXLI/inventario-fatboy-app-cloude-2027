import type { ParametrosLegales } from "./types";

/**
 * Parámetros legales sembrados con el sistema. Se copian a la base de datos (tabla ParametroLegal) sin
 * sobrescribir lo que el administrador ya haya editado/confirmado.
 *
 * Fuentes revisadas durante el desarrollo (ver docs/FORMULAS.md):
 *  - LFT (Cámara de Diputados, texto vigente, última reforma DOF 14-05-2026): arts. 48, 50, 76, 79, 80, 87, 89, 110, 162, 486.
 *  - LISR (Cámara de Diputados): arts. 93 fr. XIII y XIV, 95, 96. RISR arts. 172 y 174.
 *  - Anexo 8 RMF 2024 (DOF 29-12-2023) y Anexo 8 RMF 2026 (DOF 28-12-2025): tarifa mensual del art. 96 LISR (contraste directo).
 *  - Salarios mínimos: resolución CONASAMI publicada en el DOF el 09-12-2025 (2026); verificados por fuentes secundarias.
 *  - UMA: INEGI, DOF 09-01-2026 (2026); verificada por fuentes secundarias.
 */

const LABORALES: ParametrosLegales["laborales"] = {
  aguinaldoDiasMinimos: 15,
  primaVacacionalPctMinimo: 25,
  primaAntiguedadDiasPorAnio: 12,
  topePrimaAntiguedadVecesSM: 2,
  indemnizacionDiasConstitucional: 90,
  indemnizacionDiasPorAnio: 20,
  divisorSalarioMensual: 30,
  divisorSalarioQuincenal: 15,
  divisorSalarioSemanal: 7,
};

const EXENCIONES: ParametrosLegales["exenciones"] = {
  base: "UMA",
  aguinaldoDias: 30,
  primaVacacionalDias: 15,
  separacionDiasPorAnio: 90,
};

const TARIFA_2024 = [
  ["0.01", "746.04", "0.00", "1.92"],
  ["746.05", "6332.05", "14.32", "6.40"],
  ["6332.06", "11128.01", "371.83", "10.88"],
  ["11128.02", "12935.82", "893.63", "16.00"],
  ["12935.83", "15487.71", "1182.88", "17.92"],
  ["15487.72", "31236.49", "1640.18", "21.36"],
  ["31236.50", "49233.00", "5004.12", "23.52"],
  ["49233.01", "93993.90", "9236.89", "30.00"],
  ["93993.91", "125325.20", "22665.17", "32.00"],
  ["125325.21", "375975.61", "32691.18", "34.00"],
  ["375975.62", null, "117912.32", "35.00"],
] as const;

const TARIFA_2026 = [
  ["0.01", "844.59", "0.00", "1.92"],
  ["844.60", "7168.51", "16.22", "6.40"],
  ["7168.52", "12598.02", "420.95", "10.88"],
  ["12598.03", "14644.64", "1011.68", "16.00"],
  ["14644.65", "17533.64", "1339.14", "17.92"],
  ["17533.65", "35362.83", "1856.84", "21.36"],
  ["35362.84", "55736.68", "5665.16", "23.52"],
  ["55736.69", "106410.50", "10457.09", "30.00"],
  ["106410.51", "141880.66", "25659.23", "32.00"],
  ["141880.67", "425641.99", "37009.69", "34.00"],
  ["425642.00", null, "133488.54", "35.00"],
] as const;

type Row = readonly [string, string | null, string, string];
const tarifa = (rows: readonly Row[]) =>
  rows.map(([li, ls, cf, p]) => ({ limiteInferior: li, limiteSuperior: ls, cuotaFija: cf, porcentaje: p }));

const FUENTE_LFT = {
  concepto: "Ley Federal del Trabajo",
  referencia: "Arts. 48, 50, 76, 79, 80, 87, 89, 110, 162 y 486 (texto vigente, Cámara de Diputados)",
  url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf",
  estatus: "OFICIAL" as const,
};
const FUENTE_LISR = {
  concepto: "Ley del Impuesto sobre la Renta",
  referencia: "Arts. 93 fr. XIII y XIV, 95 y 96; Reglamento arts. 172 y 174",
  url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf",
  estatus: "OFICIAL" as const,
};
const NOTA_EXENCIONES =
  "El texto del art. 93 LISR (fr. XIII y XIV) alude al salario mínimo general; la práctica del SAT, derivada del Decreto de desindexación del salario mínimo (DOF 27-01-2016), calcula estas exenciones en UMA. El sistema usa UMA por omisión y el administrador debe confirmar el criterio (o cambiarlo a SALARIO_MINIMO) en Parámetros legales.";

export const PARAMETROS_DEFAULT: ParametrosLegales[] = [
  {
    anio: 2024,
    estatus: { salariosMinimos: "CORROBORADO", uma: "CORROBORADO", tarifaIsr: "OFICIAL", exenciones: "PENDIENTE", subsidio: "PENDIENTE" },
    salariosMinimos: { general: "248.93", zlfn: "374.89", profesionales: [] },
    uma: [
      { desde: "2024-01-01", valor: "103.74" },
      { desde: "2024-02-01", valor: "108.57" },
    ],
    tarifaMensualIsr: tarifa(TARIFA_2024),
    subsidioEmpleo: null,
    exenciones: EXENCIONES,
    laborales: LABORALES,
    fuentes: [
      FUENTE_LFT,
      FUENTE_LISR,
      {
        concepto: "Tarifa mensual art. 96 LISR (2024)",
        referencia: "Anexo 8 de la RMF 2024, apartado A, fracción V (DOF 29-12-2023)",
        url: "https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2024/rmf/anexos/Anexo_8_RMF2024-29122023.pdf",
        estatus: "OFICIAL",
      },
      { concepto: "Salarios mínimos 2024", referencia: "Resolución CONASAMI (DOF 2023). General $248.93 / ZLFN $374.89. Sin contraste con el DOF.", estatus: "CORROBORADO" },
      { concepto: "UMA 2024", referencia: "INEGI (DOF 2024): $108.57 desde 01-02-2024; $103.74 antes. Sin contraste con el DOF.", estatus: "CORROBORADO" },
    ],
    notas: NOTA_EXENCIONES,
  },
  {
    anio: 2025,
    estatus: { salariosMinimos: "CORROBORADO", uma: "CORROBORADO", tarifaIsr: "PENDIENTE", exenciones: "PENDIENTE", subsidio: "PENDIENTE" },
    salariosMinimos: { general: "278.80", zlfn: "419.88", profesionales: [] },
    uma: [
      { desde: "2025-01-01", valor: "108.57" },
      { desde: "2025-02-01", valor: "113.14" },
    ],
    // Tarifa 2025 no contrastada con el Anexo 8 RMF 2025: se deja sin capturar a propósito.
    tarifaMensualIsr: null,
    subsidioEmpleo: null,
    exenciones: EXENCIONES,
    laborales: LABORALES,
    fuentes: [
      FUENTE_LFT,
      FUENTE_LISR,
      { concepto: "Salarios mínimos 2025", referencia: "Resolución CONASAMI. General $278.80 / ZLFN $419.88 (confirmados por la comparación 2025→2026 en fuentes secundarias).", estatus: "CORROBORADO" },
      { concepto: "UMA 2025", referencia: "INEGI: $113.14 desde 01-02-2025.", estatus: "CORROBORADO" },
      { concepto: "Tarifa mensual art. 96 LISR (2025)", referencia: "PENDIENTE: capturar de la versión publicada del Anexo 8 RMF 2025.", estatus: "PENDIENTE" },
    ],
    notas: NOTA_EXENCIONES + " La tarifa ISR 2025 no está capturada: las retenciones de 2025 quedan pendientes de validación fiscal hasta capturarla.",
  },
  {
    anio: 2026,
    estatus: { salariosMinimos: "CORROBORADO", uma: "CORROBORADO", tarifaIsr: "OFICIAL", exenciones: "PENDIENTE", subsidio: "PENDIENTE" },
    salariosMinimos: { general: "315.04", zlfn: "440.87", profesionales: [] },
    uma: [
      { desde: "2026-01-01", valor: "113.14" },
      { desde: "2026-02-01", valor: "117.31" },
    ],
    tarifaMensualIsr: tarifa(TARIFA_2026),
    subsidioEmpleo: {
      limiteMensual: "11492.66",
      descripcion:
        "Decreto DOF 31-12-2025 (subsidio para el empleo 2026). El límite mensual proviene de fuentes secundarias y no se contrastó con el DOF. El sistema no calcula el subsidio: solo avisa si podría aplicar.",
    },
    exenciones: EXENCIONES,
    laborales: LABORALES,
    fuentes: [
      FUENTE_LFT,
      FUENTE_LISR,
      {
        concepto: "Tarifa mensual art. 96 LISR (2026)",
        referencia: "Anexo 8 de la RMF 2026, apartado A, fracción V (DOF 28-12-2025)",
        url: "https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/anexos/Anexo-8-RMF-2026_DOF-28122025.pdf",
        estatus: "OFICIAL",
      },
      {
        concepto: "Salarios mínimos 2026",
        referencia: "Resolución del Consejo de Representantes de la CONASAMI (DOF 09-12-2025): General $315.04, Zona Libre de la Frontera Norte $440.87 (dato inicial del solicitante, coincidente con varias fuentes).",
        estatus: "CORROBORADO",
      },
      {
        concepto: "Salarios mínimos profesionales 2026",
        referencia: "La resolución incluye 61 profesiones/oficios. No se sembraron porque no pudo contrastarse la tabla completa; capture en Parámetros legales las que apliquen.",
        estatus: "PENDIENTE",
      },
      { concepto: "UMA 2026", referencia: "INEGI (DOF 09-01-2026): $117.31 diaria desde 01-02-2026; $113.14 durante enero.", estatus: "CORROBORADO" },
      { concepto: "Subsidio para el empleo 2026", referencia: "Decreto DOF 31-12-2025. Límite mensual $11,492.66 (fuente secundaria).", estatus: "PENDIENTE" },
    ],
    notas: NOTA_EXENCIONES,
  },
];
