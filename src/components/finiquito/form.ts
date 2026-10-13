import type { FiniquitoInput } from "@/lib/finiquito/schema";

export interface OtroForm { nombre: string; monto: string; pagado: string; trat: "SALARIAL" | "SEPARACION" | "EXENTO" | "DESCONOCIDO"; fundExencion: string }
export interface AnticipoForm { descripcion: string; monto: string; fecha: string }
export interface DeduccionForm { tipo: string; descripcion: string; monto: string; sustento: boolean; consent: boolean; referencia: string }

export interface FormState {
  nombre: string; puesto: string; sucursalId: string; sucursal: string;
  curp: string; rfc: string; nss: string; numeroEmpleado: string;
  fechaIngreso: string; fechaTerminacion: string; fechaPago: string;
  motivo: string; detalleMotivo: string; tipoContrato: "INDETERMINADO" | "DETERMINADO"; voluntadRenuncia: boolean;
  salarioTipo: string; salarioMonto: string; zona: "ZLFN" | "GENERAL";
  minimoProf: boolean; minimoProfMonto: string; ocupacionProf: string;
  aguinaldoDias: string; primaPct: string; otrasPercepciones: string; sdiManual: string;
  sueldosModo: "FECHA" | "DIAS"; ultimoDiaPagado: string; diasPendientes: string; sueldosPagado: string;
  vacDisfrutadas: string; vacPendAnt: string; vacPagadas: string;
  primaPagada: string; primaMismoEjercicio: "" | "si" | "no";
  aguinaldoPagado: string; aguinaldoAntDias: string;
  incluir20: boolean; salariosVencidosDias: string;
  otros: OtroForm[]; anticipos: AnticipoForm[]; deducciones: DeduccionForm[];
  ultimoSueldoMensual: string; ingresoOrdMensual: string;
}

export function formInicial(hoy: string, zona: "ZLFN" | "GENERAL"): FormState {
  return {
    nombre: "", puesto: "", sucursalId: "", sucursal: "",
    curp: "", rfc: "", nss: "", numeroEmpleado: "",
    fechaIngreso: "", fechaTerminacion: hoy, fechaPago: "",
    motivo: "RENUNCIA_VOLUNTARIA", detalleMotivo: "", tipoContrato: "INDETERMINADO", voluntadRenuncia: false,
    salarioTipo: "DIARIO", salarioMonto: "", zona,
    minimoProf: false, minimoProfMonto: "", ocupacionProf: "",
    aguinaldoDias: "15", primaPct: "25", otrasPercepciones: "", sdiManual: "",
    sueldosModo: "FECHA", ultimoDiaPagado: "", diasPendientes: "", sueldosPagado: "",
    vacDisfrutadas: "", vacPendAnt: "", vacPagadas: "",
    primaPagada: "", primaMismoEjercicio: "",
    aguinaldoPagado: "", aguinaldoAntDias: "",
    incluir20: true, salariosVencidosDias: "",
    otros: [], anticipos: [], deducciones: [],
    ultimoSueldoMensual: "", ingresoOrdMensual: "",
  };
}

const n = (s: string): number | undefined => {
  if (s === "" || s === ".") return undefined;
  const v = Number(s);
  return Number.isFinite(v) ? v : undefined;
};
const z = (s: string) => n(s) ?? 0;
const t = (s: string) => (s.trim() ? s.trim() : undefined);

/** Convierte el estado del formulario al JSON que valida el servidor. */
export function formAPayload(f: FormState): Record<string, unknown> {
  const sueldos: Record<string, unknown> = { pagadoMonto: z(f.sueldosPagado) };
  if (f.sueldosModo === "FECHA") {
    if (f.ultimoDiaPagado) sueldos.ultimoDiaPagado = f.ultimoDiaPagado;
  } else if (f.diasPendientes !== "") sueldos.diasPendientes = z(f.diasPendientes);
  return {
    trabajador: { nombre: f.nombre, puesto: f.puesto, sucursal: f.sucursal, sucursalId: f.sucursalId || null, curp: t(f.curp), rfc: t(f.rfc), nss: t(f.nss), numeroEmpleado: t(f.numeroEmpleado) },
    fechaIngreso: f.fechaIngreso,
    fechaTerminacion: f.fechaTerminacion,
    fechaPago: f.fechaPago || null,
    motivo: f.motivo,
    detalleMotivo: t(f.detalleMotivo) ?? null,
    tipoContrato: f.tipoContrato,
    voluntadRenunciaManifestada: f.voluntadRenuncia,
    salario: {
      tipo: f.salarioTipo,
      monto: f.salarioTipo === "MINIMO" ? null : n(f.salarioMonto) ?? null,
      zona: f.zona,
      minimoProfesionalDiario: f.minimoProf ? n(f.minimoProfMonto) ?? null : null,
      ocupacionProfesional: f.minimoProf ? t(f.ocupacionProf) ?? null : null,
    },
    integracion: { aguinaldoDias: n(f.aguinaldoDias) ?? 15, primaVacacionalPct: n(f.primaPct) ?? 25, otrasPercepcionesDiarias: z(f.otrasPercepciones), salarioDiarioIntegradoManual: n(f.sdiManual) ?? null },
    sueldos,
    vacaciones: { diasDisfrutadosCicloActual: z(f.vacDisfrutadas), diasPendientesCiclosAnteriores: z(f.vacPendAnt), diasPagadosEnDinero: z(f.vacPagadas) },
    primaVacacional: { pagadoMonto: z(f.primaPagada), pagoPrevioEnEjercicioActual: f.primaMismoEjercicio === "" ? null : f.primaMismoEjercicio === "si" },
    aguinaldo: { pagadoMonto: z(f.aguinaldoPagado), diasEjerciciosAnterioresPendientes: z(f.aguinaldoAntDias) },
    indemnizacion: { incluir20DiasPorAnio: f.incluir20, salariosVencidosDias: z(f.salariosVencidosDias) },
    otrosConceptos: f.otros.map((o) => ({ nombre: o.nombre, monto: z(o.monto), pagadoMonto: z(o.pagado), tratamientoFiscal: o.trat, fundamentoExencion: t(o.fundExencion) ?? null })),
    anticipos: f.anticipos.map((a) => ({ descripcion: a.descripcion, monto: z(a.monto), fecha: a.fecha || null })),
    deducciones: f.deducciones.map((d) => ({ tipo: d.tipo, descripcion: d.descripcion, monto: z(d.monto), sustentoDocumental: d.sustento, consentimientoEscrito: d.consent, referencia: t(d.referencia) ?? null })),
    fiscal: { ultimoSueldoMensualOrdinario: n(f.ultimoSueldoMensual) ?? null, ingresoOrdinarioMensual: n(f.ingresoOrdMensual) ?? null },
  };
}

const s = (v: number | null | undefined) => (v === null || v === undefined || v === 0 ? "" : String(v));

/** Reconstruye el formulario a partir de datos ya guardados. */
export function datosAForm(d: FiniquitoInput): FormState {
  return {
    nombre: d.trabajador.nombre, puesto: d.trabajador.puesto, sucursalId: d.trabajador.sucursalId ?? "", sucursal: d.trabajador.sucursal,
    curp: d.trabajador.curp ?? "", rfc: d.trabajador.rfc ?? "", nss: d.trabajador.nss ?? "", numeroEmpleado: d.trabajador.numeroEmpleado ?? "",
    fechaIngreso: d.fechaIngreso, fechaTerminacion: d.fechaTerminacion, fechaPago: d.fechaPago ?? "",
    motivo: d.motivo, detalleMotivo: d.detalleMotivo ?? "", tipoContrato: d.tipoContrato, voluntadRenuncia: d.voluntadRenunciaManifestada,
    salarioTipo: d.salario.tipo, salarioMonto: s(d.salario.monto), zona: d.salario.zona,
    minimoProf: d.salario.minimoProfesionalDiario != null, minimoProfMonto: s(d.salario.minimoProfesionalDiario), ocupacionProf: d.salario.ocupacionProfesional ?? "",
    aguinaldoDias: String(d.integracion.aguinaldoDias), primaPct: String(d.integracion.primaVacacionalPct), otrasPercepciones: s(d.integracion.otrasPercepcionesDiarias), sdiManual: s(d.integracion.salarioDiarioIntegradoManual),
    sueldosModo: d.sueldos.diasPendientes != null ? "DIAS" : "FECHA", ultimoDiaPagado: d.sueldos.ultimoDiaPagado ?? "", diasPendientes: d.sueldos.diasPendientes != null ? String(d.sueldos.diasPendientes) : "", sueldosPagado: s(d.sueldos.pagadoMonto),
    vacDisfrutadas: s(d.vacaciones.diasDisfrutadosCicloActual), vacPendAnt: s(d.vacaciones.diasPendientesCiclosAnteriores), vacPagadas: s(d.vacaciones.diasPagadosEnDinero),
    primaPagada: s(d.primaVacacional.pagadoMonto), primaMismoEjercicio: d.primaVacacional.pagoPrevioEnEjercicioActual == null ? "" : d.primaVacacional.pagoPrevioEnEjercicioActual ? "si" : "no",
    aguinaldoPagado: s(d.aguinaldo.pagadoMonto), aguinaldoAntDias: s(d.aguinaldo.diasEjerciciosAnterioresPendientes),
    incluir20: d.indemnizacion.incluir20DiasPorAnio, salariosVencidosDias: s(d.indemnizacion.salariosVencidosDias),
    otros: d.otrosConceptos.map((o) => ({ nombre: o.nombre, monto: String(o.monto), pagado: s(o.pagadoMonto), trat: o.tratamientoFiscal, fundExencion: o.fundamentoExencion ?? "" })),
    anticipos: d.anticipos.map((a) => ({ descripcion: a.descripcion, monto: String(a.monto), fecha: a.fecha ?? "" })),
    deducciones: d.deducciones.map((x) => ({ tipo: x.tipo, descripcion: x.descripcion, monto: String(x.monto), sustento: x.sustentoDocumental, consent: x.consentimientoEscrito, referencia: x.referencia ?? "" })),
    ultimoSueldoMensual: s(d.fiscal.ultimoSueldoMensualOrdinario), ingresoOrdMensual: s(d.fiscal.ingresoOrdinarioMensual),
  };
}

/** Prefijo de campo (zod) → paso del asistente en el que se captura */
export function pasoDeCampo(campo: string): number {
  if (/^(trabajador|fechaIngreso|fechaTerminacion|fechaPago|motivo|detalleMotivo|tipoContrato)/.test(campo)) return 1;
  if (/^(salario|integracion)/.test(campo)) return 2;
  return 3;
}
