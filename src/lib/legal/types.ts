import { z } from "zod";

/**
 * Estatus de validación de cada grupo de parámetros:
 *  - OFICIAL: contrastado directamente contra la publicación oficial (DOF / SAT / Cámara de Diputados).
 *  - CORROBORADO: coincide en varias fuentes secundarias, aún sin contraste con el texto oficial.
 *  - CONFIRMADO: un administrador lo revisó y confirmó contra la fuente oficial (queda registrado quién y cuándo).
 *  - PENDIENTE: dato no verificado o inexistente. Todo cálculo que lo use es PROVISIONAL.
 * Solo OFICIAL y CONFIRMADO permiten un resultado sin pendientes de validación.
 */
export const EstatusSchema = z.enum(["OFICIAL", "CORROBORADO", "CONFIRMADO", "PENDIENTE"]);
export type Estatus = z.infer<typeof EstatusSchema>;

const decStr = z.string().regex(/^-?\d+(\.\d+)?$/, "Número decimal inválido");

export const ParametrosLegalesSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  estatus: z.object({
    salariosMinimos: EstatusSchema,
    uma: EstatusSchema,
    tarifaIsr: EstatusSchema,
    exenciones: EstatusSchema,
    subsidio: EstatusSchema,
  }),
  confirmacion: z
    .object({ por: z.string(), en: z.string(), grupos: z.array(z.string()) })
    .nullable()
    .optional(),
  salariosMinimos: z.object({
    general: decStr,
    zlfn: decStr,
    /** Salarios mínimos profesionales (CONASAMI). Opcional: se capturan por el administrador. */
    profesionales: z
      .array(z.object({ clave: z.string(), ocupacion: z.string(), general: decStr, zlfn: decStr }))
      .default([]),
  }),
  /** Valores diarios de la UMA y fecha desde la que rigen (cambia el 1 de febrero de cada año) */
  uma: z.array(z.object({ desde: z.string(), valor: decStr })).min(1),
  /** Tarifa mensual del artículo 96 LISR (Anexo 8 RMF). null = no capturada */
  tarifaMensualIsr: z
    .array(z.object({ limiteInferior: decStr, limiteSuperior: decStr.nullable(), cuotaFija: decStr, porcentaje: decStr }))
    .nullable(),
  /** Subsidio para el empleo: solo se usa para detectar si podría aplicar (no se calcula el monto) */
  subsidioEmpleo: z.object({ limiteMensual: decStr, descripcion: z.string() }).nullable(),
  exenciones: z.object({
    /** Unidad con la que se calculan las exenciones del art. 93 LISR (criterio SAT: UMA) */
    base: z.enum(["UMA", "SALARIO_MINIMO"]),
    aguinaldoDias: z.number(),
    primaVacacionalDias: z.number(),
    separacionDiasPorAnio: z.number(),
  }),
  laborales: z.object({
    aguinaldoDiasMinimos: z.number(),
    primaVacacionalPctMinimo: z.number(),
    primaAntiguedadDiasPorAnio: z.number(),
    topePrimaAntiguedadVecesSM: z.number(),
    indemnizacionDiasConstitucional: z.number(),
    indemnizacionDiasPorAnio: z.number(),
    divisorSalarioMensual: z.number(),
    divisorSalarioQuincenal: z.number(),
    divisorSalarioSemanal: z.number(),
  }),
  fuentes: z.array(z.object({ concepto: z.string(), referencia: z.string(), url: z.string().optional(), estatus: EstatusSchema })),
  notas: z.string().optional(),
});

export type ParametrosLegales = z.infer<typeof ParametrosLegalesSchema>;
