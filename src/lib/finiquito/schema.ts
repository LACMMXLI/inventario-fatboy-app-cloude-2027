import { z } from "zod";
import { isValidISO } from "../fechas";

export const MOTIVOS = [
  "RENUNCIA_VOLUNTARIA",
  "MUTUO_CONSENTIMIENTO",
  "DESPIDO_JUSTIFICADO",
  "DESPIDO_INJUSTIFICADO",
  "RESCISION_IMPUTABLE_PATRON",
  "TERMINO_CONTRATO_DETERMINADO",
  "FALLECIMIENTO",
  "OTRA_CAUSA",
] as const;
export type Motivo = (typeof MOTIVOS)[number];

export const MOTIVO_LABEL: Record<Motivo, string> = {
  RENUNCIA_VOLUNTARIA: "Renuncia voluntaria",
  MUTUO_CONSENTIMIENTO: "Terminación por mutuo consentimiento (art. 53 fr. I LFT)",
  DESPIDO_JUSTIFICADO: "Despido justificado (rescisión sin responsabilidad para el patrón, art. 47 LFT)",
  DESPIDO_INJUSTIFICADO: "Despido injustificado",
  RESCISION_IMPUTABLE_PATRON: "Rescisión por causa imputable al patrón (art. 51 LFT)",
  TERMINO_CONTRATO_DETERMINADO: "Terminación del contrato por tiempo/obra determinada (art. 53 fr. III LFT)",
  FALLECIMIENTO: "Muerte del trabajador (pago a beneficiarios, art. 501 LFT)",
  OTRA_CAUSA: "Otra causa (requiere revisión manual)",
};

const isoDate = z
  .string()
  .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isValidISO(s), "Fecha inválida (use AAAA-MM-DD)");

const money = z.coerce.number({ invalid_type_error: "Debe ser un número" }).finite().min(0, "No puede ser negativo").max(100_000_000, "Importe demasiado grande");
const dias = z.coerce.number({ invalid_type_error: "Debe ser un número" }).finite().min(0, "No puede ser negativo").max(100_000, "Valor demasiado grande");
const texto = (max = 300) => z.string().trim().max(max);

export const TIPOS_SALARIO = ["DIARIO", "SEMANAL", "QUINCENAL", "MENSUAL", "MINIMO"] as const;
export const TRATAMIENTOS_OTROS = ["SALARIAL", "SEPARACION", "EXENTO", "DESCONOCIDO"] as const;
export const TIPOS_DEDUCCION = [
  "ANTICIPO_SALARIO",
  "PAGO_EXCESO_O_ERROR",
  "PENSION_ALIMENTICIA",
  "INFONAVIT",
  "CUOTA_SINDICAL",
  "CAJA_AHORRO",
  "OTRA",
] as const;
export type TipoDeduccion = (typeof TIPOS_DEDUCCION)[number];

export const TIPO_DEDUCCION_LABEL: Record<TipoDeduccion, string> = {
  ANTICIPO_SALARIO: "Anticipo de salario pendiente de descontar",
  PAGO_EXCESO_O_ERROR: "Pago en exceso o error",
  PENSION_ALIMENTICIA: "Pensión alimenticia (mandato judicial)",
  INFONAVIT: "Descuento Infonavit",
  CUOTA_SINDICAL: "Cuota sindical",
  CAJA_AHORRO: "Caja o fondo de ahorro",
  OTRA: "Otra deducción",
};

export const FiniquitoInputSchema = z
  .object({
    trabajador: z.object({
      nombre: texto(150).min(3, "Capture el nombre completo"),
      puesto: texto(100).min(2, "Capture el puesto"),
      sucursal: texto(100).min(1, "Seleccione la sucursal"),
      sucursalId: z.string().optional().nullable(),
      curp: texto(18).optional().nullable(),
      rfc: texto(13).optional().nullable(),
      nss: texto(11).optional().nullable(),
      numeroEmpleado: texto(30).optional().nullable(),
    }),
    fechaIngreso: isoDate,
    fechaTerminacion: isoDate,
    /** Fecha en que se pagará el finiquito (define ejercicio fiscal y UMA). Por omisión, la fecha de terminación. */
    fechaPago: isoDate.optional().nullable(),
    motivo: z.enum(MOTIVOS),
    detalleMotivo: texto(1000).optional().nullable(),
    tipoContrato: z.enum(["INDETERMINADO", "DETERMINADO"]).default("INDETERMINADO"),
    /** El trabajador manifestó por sí mismo su voluntad de renunciar (necesario para la carta de renuncia) */
    voluntadRenunciaManifestada: z.boolean().default(false),

    salario: z.object({
      tipo: z.enum(TIPOS_SALARIO).default("DIARIO"),
      monto: money.optional().nullable(),
      zona: z.enum(["ZLFN", "GENERAL"]).default("ZLFN"),
      /** Si el puesto tiene salario mínimo profesional, capturar su valor diario vigente (tabla CONASAMI) */
      minimoProfesionalDiario: money.optional().nullable(),
      ocupacionProfesional: texto(120).optional().nullable(),
    }),
    integracion: z
      .object({
        aguinaldoDias: dias.default(15),
        primaVacacionalPct: dias.default(25),
        /** Otras percepciones diarias que integran el salario (art. 84 LFT): bonos fijos, despensa en efectivo, etc. */
        otrasPercepcionesDiarias: money.default(0),
        /** Salario diario integrado conocido (si la empresa ya lo tiene calculado) */
        salarioDiarioIntegradoManual: money.optional().nullable(),
      })
      .default({}),

    sueldos: z
      .object({
        ultimoDiaPagado: isoDate.optional().nullable(),
        diasPendientes: dias.optional().nullable(),
        pagadoMonto: money.default(0),
      })
      .default({}),
    vacaciones: z
      .object({
        diasDisfrutadosCicloActual: dias.default(0),
        diasPendientesCiclosAnteriores: dias.default(0),
        diasPagadosEnDinero: dias.default(0),
      })
      .default({}),
    primaVacacional: z
      .object({
        pagadoMonto: money.default(0),
        /** ¿La prima ya pagada se pagó dentro del mismo año calendario del pago actual? (afecta la exención) */
        pagoPrevioEnEjercicioActual: z.boolean().optional().nullable(),
      })
      .default({}),
    aguinaldo: z
      .object({
        pagadoMonto: money.default(0),
        diasEjerciciosAnterioresPendientes: dias.default(0),
      })
      .default({}),
    indemnizacion: z
      .object({
        incluir20DiasPorAnio: z.boolean().default(true),
        salariosVencidosDias: dias.default(0),
      })
      .default({}),
    otrosConceptos: z
      .array(
        z.object({
          nombre: texto(120).min(2, "Capture el nombre del concepto"),
          monto: money,
          pagadoMonto: money.default(0),
          tratamientoFiscal: z.enum(TRATAMIENTOS_OTROS).default("DESCONOCIDO"),
          fundamentoExencion: texto(300).optional().nullable(),
          fundamentoLegal: texto(300).optional().nullable(),
        }),
      )
      .max(30)
      .default([]),
    anticipos: z
      .array(z.object({ descripcion: texto(150).min(2), monto: money, fecha: isoDate.optional().nullable() }))
      .max(30)
      .default([]),
    deducciones: z
      .array(
        z.object({
          tipo: z.enum(TIPOS_DEDUCCION),
          descripcion: texto(200).min(2, "Describa la deducción"),
          monto: money,
          sustentoDocumental: z.boolean().default(false),
          consentimientoEscrito: z.boolean().default(false),
          referencia: texto(200).optional().nullable(),
        }),
      )
      .max(30)
      .default([]),
    fiscal: z
      .object({
        /** Último sueldo mensual ordinario (para art. 95/96 LISR). Por omisión se deriva del salario capturado. */
        ultimoSueldoMensualOrdinario: money.optional().nullable(),
        /** Ingreso ordinario mensual regular (para el procedimiento del art. 174 RISR). */
        ingresoOrdinarioMensual: money.optional().nullable(),
      })
      .default({}),
  })
  .superRefine((v, ctx) => {
    if (v.fechaTerminacion < v.fechaIngreso) {
      ctx.addIssue({ code: "custom", path: ["fechaTerminacion"], message: "La terminación no puede ser anterior al ingreso" });
    }
    if (v.salario.tipo !== "MINIMO" && (v.salario.monto === undefined || v.salario.monto === null || v.salario.monto <= 0)) {
      ctx.addIssue({ code: "custom", path: ["salario", "monto"], message: "Capture el importe del salario" });
    }
    if (v.integracion.primaVacacionalPct < 25) {
      ctx.addIssue({ code: "custom", path: ["integracion", "primaVacacionalPct"], message: "La prima vacacional no puede ser menor al 25% (art. 80 LFT)" });
    }
    if (v.integracion.aguinaldoDias < 15) {
      ctx.addIssue({ code: "custom", path: ["integracion", "aguinaldoDias"], message: "El aguinaldo no puede ser menor a 15 días (art. 87 LFT)" });
    }
    if (v.sueldos.ultimoDiaPagado && v.sueldos.ultimoDiaPagado > v.fechaTerminacion) {
      ctx.addIssue({ code: "custom", path: ["sueldos", "ultimoDiaPagado"], message: "No puede ser posterior a la terminación" });
    }
    if (v.sueldos.ultimoDiaPagado && v.sueldos.ultimoDiaPagado < v.fechaIngreso) {
      ctx.addIssue({ code: "custom", path: ["sueldos", "ultimoDiaPagado"], message: "No puede ser anterior al ingreso" });
    }
  });

export type FiniquitoInput = z.infer<typeof FiniquitoInputSchema>;
export type FiniquitoInputRaw = z.input<typeof FiniquitoInputSchema>;
