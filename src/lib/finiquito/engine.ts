import { D, Dec, ZERO, r2, r6, s2, max0, money, num } from "../money";
import { calcularAntiguedad, diffDays, parseISO, addDays, daysInYear, hoyISO, type Antiguedad } from "../fechas";
import type { ParametrosLegales, Estatus } from "../legal/types";
import { FiniquitoInputSchema, MOTIVO_LABEL, TIPO_DEDUCCION_LABEL, type FiniquitoInput, type FiniquitoInputRaw } from "./schema";
import { DIAS_MES_SAT, isrArt174, isrSeparacion, isrTarifa, repartir } from "./fiscal";
import {
  ENGINE_VERSION,
  type BloqueFiscal,
  type ConceptoCalculado,
  type DeduccionEvaluada,
  type EstadoCalculo,
  type FiscalConcepto,
  type Pendiente,
  type ResultadoFiniquito,
} from "./types";

export class ErrorCalculo extends Error {
  constructor(
    message: string,
    public readonly codigo: "PARAMETROS" | "DATOS",
  ) {
    super(message);
  }
}

const OK_ESTATUS: Estatus[] = ["OFICIAL", "CONFIRMADO"];
const esValidado = (e: Estatus) => OK_ESTATUS.includes(e);

/** Días de vacaciones del año de servicio n (art. 76 LFT, reforma DOF 27-12-2022) */
export function diasVacaciones(anioServicio: number): number {
  const n = Math.max(1, Math.floor(anioServicio));
  if (n <= 5) return 10 + 2 * n; // 12,14,16,18,20
  return 22 + 2 * Math.floor((n - 6) / 5); // 6-10:22, 11-15:24, ...
}

/** Selecciona los parámetros del ejercicio; si no existe, usa el más reciente anterior (marcándolo como sustituto). */
export function resolverParametros(catalogo: ParametrosLegales[], anio: number): { params: ParametrosLegales; sustituto: boolean } {
  const exacto = catalogo.find((p) => p.anio === anio);
  if (exacto) return { params: exacto, sustituto: false };
  const previos = catalogo.filter((p) => p.anio < anio).sort((a, b) => b.anio - a.anio);
  if (previos.length) return { params: previos[0], sustituto: true };
  throw new ErrorCalculo(`No hay parámetros legales para el ejercicio ${anio} ni anteriores. Capture el ejercicio en Parámetros legales.`, "PARAMETROS");
}

function umaVigente(params: ParametrosLegales, fecha: string): { valor: Dec; fuera: boolean } {
  const ord = [...params.uma].sort((a, b) => a.desde.localeCompare(b.desde));
  let sel: (typeof ord)[number] | null = null;
  for (const u of ord) if (u.desde <= fecha) sel = u;
  if (!sel) return { valor: D(ord[0].valor), fuera: true };
  return { valor: D(sel.valor), fuera: params.anio !== Number(fecha.slice(0, 4)) };
}

const salarioMinimoZona = (p: ParametrosLegales, zona: "ZLFN" | "GENERAL") => D(zona === "ZLFN" ? p.salariosMinimos.zlfn : p.salariosMinimos.general);

const FISCAL_NA: FiscalConcepto = { tratamiento: "No aplica", exento: "0.00", gravado: "0.00", isr: "0.00", estado: "NO_APLICA" };

interface ConceptoInterno {
  c: ConceptoCalculado;
  generado: Dec;
  pagado: Dec;
  saldo: Dec;
  exento: Dec;
  gravado: Dec;
  isr: Dec;
}

function nuevoConcepto(p: {
  clave: string;
  nombre: string;
  grupo: ConceptoCalculado["grupo"];
  aplica?: boolean;
  motivoNoAplica?: string;
  dias?: string | null;
  diasDetalle?: string;
  base?: { etiqueta: string; monto: Dec } | null;
  formula?: string;
  fundamento?: string[];
  explicacion?: string;
  generado?: Dec;
  pagado?: Dec;
  notas?: string[];
}): ConceptoInterno {
  const generado = r2(p.generado ?? ZERO);
  const pagado = r2(p.pagado ?? ZERO);
  const aplica = p.aplica ?? true;
  const saldo = aplica ? max0(generado.minus(pagado)) : ZERO;
  return {
    generado: aplica ? generado : ZERO,
    pagado: aplica ? pagado : ZERO,
    saldo,
    exento: ZERO,
    gravado: ZERO,
    isr: ZERO,
    c: {
      clave: p.clave,
      nombre: p.nombre,
      grupo: p.grupo,
      aplica,
      motivoNoAplica: p.motivoNoAplica,
      dias: p.dias ?? null,
      diasDetalle: p.diasDetalle,
      baseSalarial: p.base ? { etiqueta: p.base.etiqueta, monto: p.base.monto.toFixed(6).replace(/0{1,4}$/, "") } : null,
      formula: p.formula ?? "",
      fundamento: p.fundamento ?? [],
      explicacion: p.explicacion ?? "",
      generado: s2(aplica ? generado : ZERO),
      pagadoPreviamente: s2(aplica ? pagado : ZERO),
      saldo: s2(saldo),
      fiscal: FISCAL_NA,
      notas: p.notas ?? [],
    },
  };
}

export interface OpcionesCalculo {
  /** Fecha del cálculo (por omisión, hoy en Mexicali) */
  fechaCalculo?: string;
}

/**
 * Motor de cálculo de finiquitos y liquidaciones. Función pura: mismos datos + mismos parámetros = mismo resultado.
 * Lanza ZodError si los datos son inválidos y ErrorCalculo si faltan parámetros legales.
 */
export function calcularFiniquito(inputRaw: FiniquitoInputRaw | FiniquitoInput, catalogo: ParametrosLegales[], opts: OpcionesCalculo = {}): ResultadoFiniquito {
  const input = FiniquitoInputSchema.parse(inputRaw);
  const pendientes: Pendiente[] = [];
  const avisos: string[] = [];
  const supuestos: string[] = [];
  const sustitutos: string[] = [];
  const addPend = (p: Pendiente) => {
    if (!pendientes.some((x) => x.id === p.id)) pendientes.push(p);
  };

  const fechaPago = input.fechaPago ?? input.fechaTerminacion;
  const ejercicioPago = Number(fechaPago.slice(0, 4));
  const ejercicioSalario = Number(input.fechaTerminacion.slice(0, 4));
  const rSal = resolverParametros(catalogo, ejercicioSalario);
  const rPag = resolverParametros(catalogo, ejercicioPago);
  const pSal = rSal.params;
  const pPag = rPag.params;
  if (rSal.sustituto) sustitutos.push(`Salarios mínimos: no hay parámetros del ejercicio ${ejercicioSalario}; se usaron los de ${pSal.anio}.`);
  if (rPag.sustituto) sustitutos.push(`UMA/tarifa/exenciones: no hay parámetros del ejercicio ${ejercicioPago}; se usaron los de ${pPag.anio}.`);
  for (const s of sustitutos) addPend({ id: `sustituto-${s.slice(0, 20)}`, tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: s + " Capture el ejercicio correcto en Parámetros legales." });

  const L = pPag.laborales;
  const ant: Antiguedad = calcularAntiguedad(input.fechaIngreso, input.fechaTerminacion);
  const aniosDec = D(ant.aniosDecimal);

  // ───────────────────────── Salario ─────────────────────────
  const zona = input.salario.zona;
  const smGeneralZona = salarioMinimoZona(pSal, zona);
  const smReferencia = input.salario.minimoProfesionalDiario ? D(input.salario.minimoProfesionalDiario) : smGeneralZona;
  const smEtiqueta = input.salario.minimoProfesionalDiario
    ? `Salario mínimo profesional${input.salario.ocupacionProfesional ? ` (${input.salario.ocupacionProfesional})` : ""}`
    : `Salario mínimo general ${zona === "ZLFN" ? "Zona Libre de la Frontera Norte" : "resto del país"} ${pSal.anio}`;

  let usaSalarioMinimoParam = false;
  let sd: Dec;
  let sdExplicacion: string;
  const montoSal = input.salario.monto != null ? D(input.salario.monto) : null;
  switch (input.salario.tipo) {
    case "MINIMO":
      usaSalarioMinimoParam = true;
      sd = smReferencia;
      sdExplicacion = `Se usó el ${smEtiqueta.toLowerCase()}: ${money(sd)} diarios.`;
      break;
    case "DIARIO":
      sd = r6(montoSal!);
      sdExplicacion = `Salario diario capturado: ${money(sd)}.`;
      break;
    case "SEMANAL":
      sd = r6(montoSal!.div(L.divisorSalarioSemanal));
      sdExplicacion = `Salario semanal ${money(montoSal!)} ÷ ${L.divisorSalarioSemanal} = ${num(sd, 6)} diarios (art. 89 LFT).`;
      break;
    case "QUINCENAL":
      sd = r6(montoSal!.div(L.divisorSalarioQuincenal));
      sdExplicacion = `Salario quincenal ${money(montoSal!)} ÷ ${L.divisorSalarioQuincenal} = ${num(sd, 6)} diarios.`;
      break;
    case "MENSUAL":
    default:
      sd = r6(montoSal!.div(L.divisorSalarioMensual));
      sdExplicacion = `Salario mensual ${money(montoSal!)} ÷ ${L.divisorSalarioMensual} = ${num(sd, 6)} diarios (art. 89 LFT).`;
  }
  if (sd.lte(0)) throw new ErrorCalculo("El salario diario debe ser mayor a cero", "DATOS");
  if (sd.lt(smReferencia) && input.salario.tipo !== "MINIMO") {
    usaSalarioMinimoParam = true;
    avisos.push(`El salario diario (${money(sd)}) es menor al mínimo de referencia (${money(smReferencia)}). Ningún salario puede ser inferior al mínimo (art. 90 LFT): verifique el dato.`);
  }

  // Integración (art. 84 y 89 LFT)
  const vacTabla = diasVacaciones(ant.anios + 1);
  const aguiDias = D(input.integracion.aguinaldoDias);
  const primaPct = D(input.integracion.primaVacacionalPct);
  const factor = new Dec(365).plus(aguiDias).plus(D(vacTabla).times(primaPct).div(100)).div(365);
  const factorR = factor.toDecimalPlaces(6, Dec.ROUND_HALF_UP);
  const otras = D(input.integracion.otrasPercepcionesDiarias);
  let sdi: Dec;
  let detalleIntegracion: string;
  if (input.integracion.salarioDiarioIntegradoManual) {
    sdi = D(input.integracion.salarioDiarioIntegradoManual);
    detalleIntegracion = `Salario diario integrado capturado por el usuario: ${money(sdi)}.`;
  } else {
    sdi = r6(sd.times(factorR).plus(otras));
    detalleIntegracion =
      `Factor = (365 + ${num(aguiDias)} días de aguinaldo + ${vacTabla} días de vacaciones × ${num(primaPct)}% de prima) ÷ 365 = ${factorR.toFixed(6)}. ` +
      `SDI = ${num(sd, 6)} × ${factorR.toFixed(6)}${otras.gt(0) ? ` + ${money(otras)} de otras percepciones diarias` : ""} = ${num(sdi, 6)}.`;
    if (otras.isZero()) supuestos.push("El salario integrado (indemnizaciones) solo incluye cuota diaria, aguinaldo y prima vacacional; no se capturaron otras percepciones que integren salario (art. 84 LFT).");
  }

  // ───────────────────────── Conceptos ─────────────────────────
  const motivo = input.motivo;
  const conceptos: ConceptoInterno[] = [];
  const refSd = { etiqueta: "Salario diario (cuota diaria)", monto: sd };

  // 1. Sueldos pendientes
  let diasSueldo = 0;
  {
    let detalle = "";
    if (input.sueldos.diasPendientes != null) {
      diasSueldo = input.sueldos.diasPendientes;
      detalle = `${num(diasSueldo)} días capturados`;
    } else if (input.sueldos.ultimoDiaPagado) {
      diasSueldo = Math.max(0, diffDays(parseISO(input.sueldos.ultimoDiaPagado), parseISO(input.fechaTerminacion)));
      detalle = `del ${input.sueldos.ultimoDiaPagado} (último día pagado, excluido) al ${input.fechaTerminacion} (incluido)`;
    } else {
      detalle = "sin días pendientes capturados";
      addPend({
        id: "sueldos-sin-dato",
        tipo: "DATO",
        severidad: "ADVERTENCIA",
        campo: "sueldos",
        mensaje: "Indique el último día pagado o los días de sueldo pendientes. Si no hay salarios pendientes, capture 0 días.",
      });
    }
    const gen = sd.times(diasSueldo);
    const ci = nuevoConcepto({
      clave: "SUELDOS_PENDIENTES",
      nombre: "Salarios devengados pendientes de pago",
      grupo: "SALARIOS",
      dias: `${num(diasSueldo)} días`,
      diasDetalle: detalle,
      base: refSd,
      formula: `${num(sd, 6)} × ${num(diasSueldo)} días = ${money(gen)}`,
      fundamento: ["Art. 82, 83 y 88 LFT (el salario es la retribución por el trabajo; debe pagarse en cada periodo)", "Art. 33 LFT: es nula la renuncia a salarios devengados"],
      explicacion: `Sueldo de los días trabajados que todavía no se han pagado (${detalle}).`,
      generado: gen,
      pagado: D(input.sueldos.pagadoMonto),
    });
    if (D(input.sueldos.pagadoMonto).gt(gen)) ci.c.notas.push("El monto pagado supera el generado; el excedente no se descuenta automáticamente.");
    conceptos.push(ci);
  }

  // 2. Vacaciones
  const diasCicloActualGen = D(vacTabla).times(ant.diasCicloTranscurridos).div(ant.diasCicloTotal);
  const vacPendAnt = D(input.vacaciones.diasPendientesCiclosAnteriores);
  const vacGenDias = diasCicloActualGen.plus(vacPendAnt);
  const vacConsumidos = D(input.vacaciones.diasDisfrutadosCicloActual).plus(input.vacaciones.diasPagadosEnDinero);
  const vacSaldoDias = max0(vacGenDias.minus(vacConsumidos));
  {
    const ci = nuevoConcepto({
      clave: "VACACIONES",
      nombre: "Vacaciones pendientes",
      grupo: "PRESTACIONES",
      dias: `${num(vacSaldoDias, 4)} días`,
      diasDetalle:
        `Año de servicio en curso: ${vacTabla} días (tabla art. 76) × ${ant.diasCicloTranscurridos}/${ant.diasCicloTotal} días transcurridos = ${num(diasCicloActualGen, 4)}` +
        `${vacPendAnt.gt(0) ? ` + ${num(vacPendAnt)} de ciclos anteriores` : ""} − ${num(vacConsumidos)} disfrutados/pagados`,
      base: refSd,
      formula: `(${num(vacGenDias, 4)} generados − ${num(vacConsumidos)} disfrutados o pagados) × ${num(sd, 6)} = ${num(vacSaldoDias, 4)} × ${num(sd, 6)}`,
      fundamento: ["Art. 76 LFT (periodo anual de vacaciones según antigüedad)", "Art. 79 LFT (al terminar la relación, remuneración proporcional al tiempo de servicios)"],
      explicacion:
        `Días de vacaciones que el trabajador ya generó y no ha tomado. Se parte de los ${vacTabla} días del año de servicio en curso, ` +
        `en proporción a los ${ant.diasCicloTranscurridos} de ${ant.diasCicloTotal} días transcurridos desde su último aniversario.`,
      generado: vacGenDias.times(sd),
      pagado: vacConsumidos.times(sd),
    });
    // El saldo se calcula en días para evitar diferencias por redondeo intermedio
    ci.saldo = r2(vacSaldoDias.times(sd));
    ci.c.saldo = s2(ci.saldo);
    ci.c.notas.push("Los importes 'generado' y 'previamente pagado' valoran los días a la cuota diaria; el saldo se calcula sobre los días pendientes.");
    if (vacConsumidos.gt(vacGenDias)) {
      ci.c.notas.push(`Se capturaron más días disfrutados/pagados (${num(vacConsumidos)}) que los generados (${num(vacGenDias, 4)}). El excedente no se descuenta.`);
      avisos.push("Vacaciones: los días disfrutados o pagados exceden los generados. Verifique los datos; el excedente no se descuenta automáticamente.");
    }
    conceptos.push(ci);
  }

  // 3. Prima vacacional
  {
    const gen = vacGenDias.times(sd).times(primaPct).div(100);
    const pagada = D(input.primaVacacional.pagadoMonto);
    const ci = nuevoConcepto({
      clave: "PRIMA_VACACIONAL",
      nombre: "Prima vacacional",
      grupo: "PRESTACIONES",
      dias: `${num(vacGenDias, 4)} días de vacaciones generados`,
      base: refSd,
      formula: `${num(vacGenDias, 4)} días × ${num(sd, 6)} × ${num(primaPct)}% = ${money(gen)}; menos pagado ${money(pagada)}`,
      fundamento: ["Art. 80 LFT (prima no menor al 25% sobre los salarios del periodo de vacaciones)"],
      explicacion: `${num(primaPct)}% del salario correspondiente a las vacaciones generadas del año de servicio en curso (y ciclos anteriores pendientes). Se resta lo que ya se pagó por este concepto.`,
      generado: gen,
      pagado: pagada,
    });
    if (pagada.gt(gen)) ci.c.notas.push("La prima pagada excede la generada; el excedente no se descuenta automáticamente.");
    conceptos.push(ci);
  }

  // 4. Aguinaldo
  const anioTerm = Number(input.fechaTerminacion.slice(0, 4));
  const iniAnio = parseISO(`${anioTerm}-01-01`);
  const ing = parseISO(input.fechaIngreso);
  const inicioEfectivo = ing > iniAnio ? ing : iniAnio;
  const diasAnioTrab = diffDays(inicioEfectivo, addDays(parseISO(input.fechaTerminacion), 1));
  const divAnio = daysInYear(anioTerm);
  {
    const gen = aguiDias.times(diasAnioTrab).div(divAnio);
    const pagado = D(input.aguinaldo.pagadoMonto);
    const ci = nuevoConcepto({
      clave: "AGUINALDO",
      nombre: `Aguinaldo proporcional ${anioTerm}`,
      grupo: "PRESTACIONES",
      dias: `${num(aguiDias.times(diasAnioTrab).div(divAnio), 4)} días de salario`,
      diasDetalle: `${diasAnioTrab} días laborados en ${anioTerm} de ${divAnio}`,
      base: refSd,
      formula: `${num(aguiDias)} días × ${diasAnioTrab}/${divAnio} × ${num(sd, 6)} = ${money(gen.times(sd))}; menos pagado ${money(pagado)}`,
      fundamento: ["Art. 87 LFT (mínimo 15 días; proporcional al tiempo trabajado, cualquiera que sea)"],
      explicacion: `Parte proporcional del aguinaldo de ${anioTerm}: ${num(aguiDias)} días de salario por los ${diasAnioTrab} días trabajados del año (de ${divAnio}).`,
      generado: gen.times(sd),
      pagado,
    });
    conceptos.push(ci);
  }
  if (input.aguinaldo.diasEjerciciosAnterioresPendientes > 0) {
    const dd = D(input.aguinaldo.diasEjerciciosAnterioresPendientes);
    conceptos.push(
      nuevoConcepto({
        clave: "AGUINALDO_ANTERIOR",
        nombre: "Aguinaldo de ejercicios anteriores pendiente",
        grupo: "PRESTACIONES",
        dias: `${num(dd)} días de salario`,
        base: refSd,
        formula: `${num(dd)} días × ${num(sd, 6)} = ${money(dd.times(sd))}`,
        fundamento: ["Art. 87 LFT"],
        explicacion: "Aguinaldo de años anteriores que nunca se pagó, valuado al salario diario actual.",
        generado: dd.times(sd),
      }),
    );
    supuestos.push("El aguinaldo de ejercicios anteriores se valúa al salario diario actual (no se reconstruye el salario histórico).");
  }

  // 5. Prima de antigüedad
  const smTope = smReferencia.times(L.topePrimaAntiguedadVecesSM);
  {
    const sdPrima = sd.gt(smTope) ? smTope : sd;
    const gen = D(L.primaAntiguedadDiasPorAnio).times(aniosDec).times(sdPrima);
    let aplica = false;
    let razon = "";
    const sinContratoPlanta = input.tipoContrato === "DETERMINADO";
    if (sinContratoPlanta) razon = "La prima de antigüedad corresponde a trabajadores de planta (art. 162 LFT); el contrato es por tiempo determinado.";
    else if (motivo === "RENUNCIA_VOLUNTARIA" || motivo === "MUTUO_CONSENTIMIENTO") {
      aplica = ant.anios >= 15;
      if (!aplica) razon = "Separación voluntaria con menos de 15 años de servicio: no genera prima de antigüedad (art. 162 fr. III LFT).";
    } else if (["DESPIDO_JUSTIFICADO", "DESPIDO_INJUSTIFICADO", "RESCISION_IMPUTABLE_PATRON", "FALLECIMIENTO"].includes(motivo)) {
      aplica = true;
    } else if (motivo === "TERMINO_CONTRATO_DETERMINADO") {
      razon = "La terminación de un contrato por tiempo determinado no es separación voluntaria ni despido: no genera prima de antigüedad.";
    } else {
      razon = "Causa no catalogada: la procedencia de la prima de antigüedad requiere revisión jurídica.";
    }
    const tope = sd.gt(smTope);
    if (aplica && usaSalarioMinimoParam === false) usaSalarioMinimoParam = true; // el tope usa el salario mínimo
    const ci = nuevoConcepto({
      clave: "PRIMA_ANTIGUEDAD",
      nombre: "Prima de antigüedad",
      grupo: "SEPARACION",
      aplica,
      motivoNoAplica: razon,
      dias: `${num(D(L.primaAntiguedadDiasPorAnio).times(aniosDec), 4)} días de salario`,
      diasDetalle: `${L.primaAntiguedadDiasPorAnio} días × ${num(aniosDec, 4)} años de servicio (${ant.texto})`,
      base: { etiqueta: tope ? `Salario diario topado a 2 × ${smEtiqueta.toLowerCase()}` : "Salario diario (cuota diaria)", monto: sdPrima },
      formula: `${L.primaAntiguedadDiasPorAnio} días × ${num(aniosDec, 4)} años × ${num(sdPrima, 6)} = ${money(gen)}`,
      fundamento: ["Art. 162 fr. I y III LFT", "Art. 485 y 486 LFT (el salario no puede exceder del doble del mínimo)"],
      explicacion: `12 días de salario por cada año de servicio (la fracción de año se computa proporcional). El salario base se limita al doble del salario mínimo (${money(smTope)}).${tope ? " En este caso el salario excede ese tope y se aplicó el tope." : ""}`,
      generado: gen,
      notas: tope ? [`Salario topado: ${money(sd)} excede ${money(smTope)} (2 × ${money(smReferencia)}).`] : [],
    });
    if (aplica) supuestos.push("Prima de antigüedad: se usa la cuota diaria (topada) como salario base y la fracción de año se computa proporcionalmente; confirmar el criterio con asesoría laboral si se negocia un monto distinto.");
    conceptos.push(ci);
  }

  // 6. Indemnizaciones
  const hayIndemnizacion = motivo === "DESPIDO_INJUSTIFICADO" || motivo === "RESCISION_IMPUTABLE_PATRON";
  {
    const razon = "Solo procede en despido injustificado o rescisión por causa imputable al patrón (arts. 48, 50 y 52 LFT).";
    const dias90 = D(L.indemnizacionDiasConstitucional);
    conceptos.push(
      nuevoConcepto({
        clave: "INDEMNIZACION_3_MESES",
        nombre: "Indemnización de tres meses de salario",
        grupo: "SEPARACION",
        aplica: hayIndemnizacion,
        motivoNoAplica: razon,
        dias: `${num(dias90)} días`,
        base: { etiqueta: "Salario diario integrado (art. 89 LFT)", monto: sdi },
        formula: `${num(dias90)} días × ${num(sdi, 6)} = ${money(dias90.times(sdi))}`,
        fundamento: ["Art. 48 y 50 fr. III LFT", "Art. 52 LFT (rescisión imputable al patrón)", "Art. 89 LFT (base: salario integrado)"],
        explicacion: "Tres meses de salario (90 días) valuados con el salario diario integrado.",
        generado: dias90.times(sdi),
      }),
    );

    const determinado = input.tipoContrato === "DETERMINADO";
    let gen20 = ZERO;
    let formula20 = "";
    let diasTxt = "";
    let fund20 = "Art. 50 fr. II LFT";
    let expl20 = "Veinte días de salario integrado por cada año de servicios (la fracción de año se computa proporcional).";
    let aplica20 = hayIndemnizacion && input.indemnizacion.incluir20DiasPorAnio;
    if (determinado) {
      fund20 = "Art. 50 fr. I LFT";
      if (ant.diasTotales < 365) {
        const d = D(ant.diasTotales).div(2);
        gen20 = d.times(sdi);
        formula20 = `(${ant.diasTotales} días de servicio ÷ 2) = ${num(d, 4)} días × ${num(sdi, 6)} = ${money(gen20)}`;
        diasTxt = `${num(d, 4)} días`;
        expl20 = "Contrato por tiempo determinado menor a un año: salarios de la mitad del tiempo de servicios prestados.";
      } else {
        const adicionales = max0(aniosDec.minus(1));
        const dd = D(180).plus(adicionales.times(L.indemnizacionDiasPorAnio));
        gen20 = dd.times(sdi);
        formula20 = `(180 días + ${L.indemnizacionDiasPorAnio} × ${num(adicionales, 4)} años siguientes) = ${num(dd, 4)} días × ${num(sdi, 6)} = ${money(gen20)}`;
        diasTxt = `${num(dd, 4)} días`;
        expl20 = "Contrato por tiempo determinado mayor a un año: seis meses por el primer año y veinte días por cada año siguiente.";
      }
      aplica20 = hayIndemnizacion;
    } else {
      const dd = D(L.indemnizacionDiasPorAnio).times(aniosDec);
      gen20 = dd.times(sdi);
      formula20 = `${L.indemnizacionDiasPorAnio} días × ${num(aniosDec, 4)} años × ${num(sdi, 6)} = ${money(gen20)}`;
      diasTxt = `${num(dd, 4)} días`;
    }
    conceptos.push(
      nuevoConcepto({
        clave: "INDEMNIZACION_20_DIAS",
        nombre: determinado ? "Indemnización por contrato de tiempo determinado" : "Indemnización de 20 días por año de servicios",
        grupo: "SEPARACION",
        aplica: aplica20,
        motivoNoAplica: hayIndemnizacion ? "Excluida por decisión del usuario (se configuró no incluir los 20 días por año)." : razon,
        dias: diasTxt,
        diasDetalle: `Antigüedad: ${ant.texto}`,
        base: { etiqueta: "Salario diario integrado (art. 89 LFT)", monto: sdi },
        formula: formula20,
        fundamento: [fund20, "Art. 89 LFT (base: salario integrado)"],
        explicacion: expl20,
        generado: gen20,
      }),
    );

    const sv = D(input.indemnizacion.salariosVencidosDias);
    const aplicaSv = motivo === "DESPIDO_INJUSTIFICADO" && sv.gt(0);
    conceptos.push(
      nuevoConcepto({
        clave: "SALARIOS_VENCIDOS",
        nombre: "Salarios vencidos",
        grupo: "SEPARACION",
        aplica: aplicaSv,
        motivoNoAplica: "Solo se calculan cuando se capturan días y el motivo es despido injustificado. Normalmente se determinan en juicio (art. 48 LFT).",
        dias: `${num(sv)} días`,
        base: { etiqueta: "Salario diario integrado", monto: sdi },
        formula: `${num(sv)} días × ${num(sdi, 6)} = ${money(sv.times(sdi))}`,
        fundamento: ["Art. 48 LFT (hasta 12 meses de salarios vencidos; después, intereses sobre 15 meses)"],
        explicacion: "Salarios desde la fecha del despido. Solo se incluyen si usted los capturó (por convenio o resolución).",
        generado: sv.times(sdi),
        notas: sv.gt(365) ? ["Excede 12 meses: los intereses del art. 48 LFT no se calculan en este sistema."] : [],
      }),
    );
    if (aplicaSv) {
      addPend({
        id: "salarios-vencidos-fiscal",
        tipo: "VALIDACION",
        severidad: "ADVERTENCIA",
        mensaje: "Salarios vencidos: el tratamiento fiscal (salario vs. indemnización) no está validado en el sistema; la retención de este concepto queda pendiente.",
      });
    }
  }

  // 7. Otros conceptos capturados
  input.otrosConceptos.forEach((o, i) => {
    const ci = nuevoConcepto({
      clave: `OTRO_${i + 1}`,
      nombre: o.nombre,
      grupo: o.tratamientoFiscal === "SEPARACION" ? "SEPARACION" : "OTROS",
      dias: null,
      base: null,
      formula: `${money(o.monto)} capturado; menos pagado ${money(o.pagadoMonto)}`,
      fundamento: [o.fundamentoLegal || "Prestación contractual o pacto capturado por el usuario"],
      explicacion: "Concepto capturado manualmente; el sistema no lo calcula, solo lo suma y lo trata fiscalmente según lo indicado.",
      generado: D(o.monto),
      pagado: D(o.pagadoMonto),
    });
    conceptos.push(ci);
  });

  // ───────────────────────── Fiscal ─────────────────────────
  const tarifa = pPag.tarifaMensualIsr;
  const uma = umaVigente(pPag, fechaPago);
  if (uma.fuera) addPend({ id: "uma-fuera", tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: `No hay un valor de UMA capturado para ${fechaPago}; se usó el más cercano del ejercicio ${pPag.anio}.` });
  const baseEx = pPag.exenciones.base;
  const valorBaseEx = baseEx === "UMA" ? uma.valor : salarioMinimoZona(pPag, zona);
  const baseExLabel = baseEx === "UMA" ? `UMA (${money(uma.valor)})` : `salario mínimo general (${money(valorBaseEx)})`;
  const act = (id: string) => conceptos.find((x) => x.c.clave === id)!;
  const bloques: BloqueFiscal[] = [];
  let fiscalProvisional = false;
  const marcarProvisional = (p: Pendiente) => {
    fiscalProvisional = true;
    addPend(p);
  };

  const sinTarifa = !tarifa;
  const estTarifa = pPag.estatus.tarifaIsr;
  if (!esValidado(estTarifa)) {
    addPend({ id: "tarifa-no-validada", tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: `La tarifa de ISR ${pPag.anio} no está validada (estatus ${estTarifa}). Confírmela en Parámetros legales.` });
    fiscalProvisional = true;
  }
  if (!esValidado(pPag.estatus.exenciones)) {
    addPend({
      id: "exenciones-no-validadas",
      tipo: "VALIDACION",
      severidad: "ADVERTENCIA",
      mensaje: `Falta confirmar el criterio de exenciones del art. 93 LISR (${baseEx === "UMA" ? "UMA" : "salario mínimo"}) para ${pPag.anio} en Parámetros legales.`,
    });
    fiscalProvisional = true;
  }
  if (!esValidado(pPag.estatus.uma) && baseEx === "UMA") {
    addPend({ id: "uma-no-validada", tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: `El valor de la UMA ${pPag.anio} no está contrastado con el DOF (estatus ${pPag.estatus.uma}).` });
    fiscalProvisional = true;
  }
  if (usaSalarioMinimoParam && !esValidado(pSal.estatus.salariosMinimos)) {
    addPend({ id: "sm-no-validado", tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: `Los salarios mínimos ${pSal.anio} usados en el cálculo no están contrastados con el DOF (estatus ${pSal.estatus.salariosMinimos}).` });
    fiscalProvisional = true;
  }

  const sueldoMensualDerivado = (() => {
    if (input.salario.tipo === "MENSUAL" && montoSal) return montoSal;
    if (input.salario.tipo === "QUINCENAL" && montoSal) return montoSal.times(2);
    return sd.times(DIAS_MES_SAT);
  })();
  const ingresoOrdMensual = input.fiscal.ingresoOrdinarioMensual != null ? D(input.fiscal.ingresoOrdinarioMensual) : sueldoMensualDerivado;
  const ultimoSueldoMensual = input.fiscal.ultimoSueldoMensualOrdinario != null ? D(input.fiscal.ultimoSueldoMensualOrdinario) : sueldoMensualDerivado;
  supuestos.push(
    `Ingreso ordinario mensual para el art. 174 RISR: ${money(ingresoOrdMensual)}${input.fiscal.ingresoOrdinarioMensual != null ? " (capturado)" : " (derivado del salario capturado)"}. ` +
      `Último sueldo mensual ordinario para el art. 95/96 LISR: ${money(ultimoSueldoMensual)}${input.fiscal.ultimoSueldoMensualOrdinario != null ? " (capturado)" : " (derivado del salario capturado)"}.`,
  );

  // 7a. Otros conceptos: marcar tratamiento
  const otros = conceptos.filter((x) => x.c.clave.startsWith("OTRO_"));
  otros.forEach((x, idx) => {
    const src = input.otrosConceptos[idx];
    if (!x.c.aplica || x.saldo.lte(0)) return;
    if (src.tratamientoFiscal === "EXENTO") {
      if (!src.fundamentoExencion) {
        marcarProvisional({ id: `otro-${idx}-exento`, tipo: "DATO", severidad: "ADVERTENCIA", campo: `otrosConceptos.${idx}.fundamentoExencion`, mensaje: `"${src.nombre}": para tratarlo como exento indique el fundamento legal de la exención.` });
      } else {
        x.exento = x.saldo;
        x.c.fiscal = { tratamiento: `Exento: ${src.fundamentoExencion}`, exento: s2(x.saldo), gravado: "0.00", isr: "0.00", estado: "DEFINITIVO" };
        x.c.notas.push("Exención declarada por el usuario; el sistema no la valida.");
      }
    }
    if (src.tratamientoFiscal === "DESCONOCIDO") {
      marcarProvisional({ id: `otro-${idx}-trat`, tipo: "DATO", severidad: "ADVERTENCIA", campo: `otrosConceptos.${idx}.tratamientoFiscal`, mensaje: `"${src.nombre}": indique si es ingreso salarial, pago por separación o exento. Mientras tanto no se calcula su retención.` });
    }
  });

  // 7b. Bloque ORDINARIO (sueldos, vacaciones, otros salariales)
  const ordConceptos: ConceptoInterno[] = [act("SUELDOS_PENDIENTES"), act("VACACIONES"), ...otros.filter((x, i) => input.otrosConceptos[i].tratamientoFiscal === "SALARIAL")];
  const baseOrd = ordConceptos.reduce((a, x) => a.plus(x.saldo), ZERO);
  if (baseOrd.gt(0)) {
    const diasPeriodo = D(diasSueldo).plus(vacSaldoDias);
    const diasP = diasPeriodo.gt(0) ? diasPeriodo : DIAS_MES_SAT;
    const factorP = diasP.div(DIAS_MES_SAT);
    const proc: string[] = [];
    let isr = ZERO;
    if (sinTarifa) {
      marcarProvisional({ id: "sin-tarifa", tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: `No hay tarifa de ISR capturada para ${pPag.anio}: la retención de sueldos y vacaciones queda pendiente de validación fiscal.` });
      proc.push("Sin tarifa capturada: retención pendiente.");
    } else {
      isr = isrTarifa(baseOrd, tarifa, factorP);
      proc.push(
        `Ingreso ordinario del periodo: ${money(baseOrd)} (${num(diasP, 2)} días). Tarifa mensual del art. 96 LISR proporcional al periodo (${num(diasP, 2)} ÷ 30.4 = ${num(factorP, 4)} de la tarifa mensual).`,
        `ISR = cuota fija + (base − límite inferior) × %, con límites y cuota ajustados al periodo → ${money(isr)}.`,
      );
      if (diasP.gt(31)) marcarProvisional({ id: "periodo-largo", tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: "El periodo de sueldos y vacaciones pendientes excede un mes: valide el procedimiento de retención con su contador." });
      const eqMensual = baseOrd.div(diasP).times(DIAS_MES_SAT);
      if (pPag.subsidioEmpleo && eqMensual.lte(D(pPag.subsidioEmpleo.limiteMensual))) {
        marcarProvisional({
          id: "subsidio-empleo",
          tipo: "VALIDACION",
          severidad: "ADVERTENCIA",
          mensaje: `El ingreso mensual equivalente (${money(eqMensual)}) está dentro del límite del subsidio para el empleo (${money(D(pPag.subsidioEmpleo.limiteMensual))}). Puede corresponder un subsidio que reduzca el ISR; el sistema no lo calcula.`,
        });
      }
    }
    const reparto = repartir(isr, ordConceptos.map((x) => x.saldo));
    ordConceptos.forEach((x, i) => {
      x.gravado = x.saldo;
      x.isr = reparto[i];
      x.c.fiscal = { tratamiento: "Ingreso gravado (salario, art. 94 LISR) – retención art. 96", exento: "0.00", gravado: s2(x.saldo), isr: s2(reparto[i]), estado: sinTarifa ? "PROVISIONAL" : "DEFINITIVO" };
    });
    bloques.push({
      id: "ORDINARIO",
      titulo: "Ingresos ordinarios (sueldos, vacaciones y otros salariales)",
      baseTotal: s2(baseOrd),
      exento: "0.00",
      gravado: s2(baseOrd),
      isr: s2(isr),
      procedimiento: proc,
      fundamento: ["LISR art. 94 y 96", "Anexo 8 RMF (tarifa mensual y proporción por periodo)"],
      estado: sinTarifa ? "PROVISIONAL" : "DEFINITIVO",
    });
  }

  // 7c. Bloque GRATIFICACIONES (aguinaldo + prima vacacional)
  {
    const ag = [act("AGUINALDO"), ...(conceptos.find((x) => x.c.clave === "AGUINALDO_ANTERIOR") ? [act("AGUINALDO_ANTERIOR")] : [])];
    const pv = act("PRIMA_VACACIONAL");
    const proc: string[] = [];
    // Aguinaldo
    const agGen = ag.reduce((a, x) => a.plus(x.generado), ZERO);
    const agPag = act("AGUINALDO").pagado;
    const agSaldo = ag.reduce((a, x) => a.plus(x.saldo), ZERO);
    const capAg = valorBaseEx.times(pPag.exenciones.aguinaldoDias);
    const exAgTotal = agGen.lt(capAg) ? agGen : capAg;
    const exAgPend = D(Dec.min(agSaldo, max0(exAgTotal.minus(agPag))));
    const grAg = agSaldo.minus(exAgPend);
    if (agSaldo.gt(0)) {
      proc.push(
        `Aguinaldo: exención anual = ${pPag.exenciones.aguinaldoDias} × ${baseExLabel} = ${money(capAg)}. Generado en el año ${money(agGen)}; ya pagado ${money(agPag)} (se asume que consumió primero la parte exenta). Exento ahora ${money(exAgPend)}; gravado ${money(grAg)}.`,
      );
    }
    // Prima vacacional
    const pvSaldo = pv.saldo;
    const pvPag = pv.pagado;
    const capPv = valorBaseEx.times(pPag.exenciones.primaVacacionalDias);
    let consumido = pvPag;
    if (pvPag.gt(0) && input.primaVacacional.pagoPrevioEnEjercicioActual == null) {
      marcarProvisional({
        id: "prima-previa-ejercicio",
        tipo: "DATO",
        severidad: "ADVERTENCIA",
        campo: "primaVacacional.pagoPrevioEnEjercicioActual",
        mensaje: "La prima vacacional ya pagada: ¿se pagó en el mismo año calendario que este pago? De ello depende cuánta exención queda disponible (art. 93 fr. XIV LISR). Se asumió que sí.",
      });
    } else if (input.primaVacacional.pagoPrevioEnEjercicioActual === false) {
      consumido = ZERO;
    }
    const exPvPend = D(Dec.min(pvSaldo, max0(capPv.minus(consumido))));
    const grPv = pvSaldo.minus(exPvPend);
    if (pvSaldo.gt(0)) {
      proc.push(`Prima vacacional: exención anual = ${pPag.exenciones.primaVacacionalDias} × ${baseExLabel} = ${money(capPv)}; exención ya consumida ${money(consumido)}. Exento ahora ${money(exPvPend)}; gravado ${money(grPv)}.`);
    }
    const gravadoPool = grAg.plus(grPv);
    let isr = ZERO;
    let estadoBloque: "DEFINITIVO" | "PROVISIONAL" = "DEFINITIVO";
    if (gravadoPool.gt(0)) {
      if (sinTarifa) {
        marcarProvisional({ id: "sin-tarifa", tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: `No hay tarifa de ISR capturada para ${pPag.anio}: la retención del excedente de aguinaldo/prima queda pendiente.` });
        estadoBloque = "PROVISIONAL";
        proc.push("Sin tarifa capturada: retención pendiente.");
      } else {
        const r = isrArt174(gravadoPool, ingresoOrdMensual, tarifa);
        isr = r.isr;
        proc.push(
          `Art. 174 RISR: I) ${money(gravadoPool)} ÷ 365 × 30.4 = ${money(r.ingresoMensualEquivalente)}; II) ISR de ${money(ingresoOrdMensual)} + ${money(r.ingresoMensualEquivalente)} = ${money(r.impuestoConGratificacion)}; ` +
            `III) ISR del ingreso ordinario ${money(r.impuestoOrdinario)}; diferencia ${money(r.diferencia)}; V) tasa = ${money(r.diferencia)} ÷ ${money(r.ingresoMensualEquivalente)} = ${num(r.tasa.times(100), 4)}%; ` +
            `IV) retención = ${money(gravadoPool)} × tasa = ${money(isr)}.`,
        );
        if (pPag.subsidioEmpleo && ingresoOrdMensual.lte(D(pPag.subsidioEmpleo.limiteMensual))) {
          marcarProvisional({ id: "subsidio-empleo-grat", tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: "El ingreso ordinario mensual está dentro del límite del subsidio para el empleo; valide con su contador si corresponde ajustar la retención de aguinaldo/prima." });
        }
      }
      supuestos.push("Aguinaldo y prima vacacional: se aplica la opción del art. 174 del Reglamento de la LISR (tasa efectiva sobre el ingreso ordinario mensual).");
    }
    // Todo el gravado de aguinaldo se presenta en el primer renglón de aguinaldo; el de prima, en su renglón.
    const reparto = repartir(isr, [grAg, ...ag.slice(1).map(() => ZERO), grPv]);
    ag.forEach((x, i) => {
      const grav = i === 0 ? grAg : ZERO;
      x.exento = i === 0 ? exAgPend : ZERO;
      x.gravado = grav;
      x.isr = reparto[i];
      if (x.saldo.gt(0)) x.c.fiscal = { tratamiento: `Gratificación anual: exenta hasta ${pPag.exenciones.aguinaldoDias} × ${baseEx === "UMA" ? "UMA" : "salario mínimo"} (art. 93 fr. XIV LISR)`, exento: s2(x.exento), gravado: s2(x.gravado), isr: s2(x.isr), estado: estadoBloque };
    });
    // Si hay aguinaldo anterior, su saldo se incluyó en la exención/gravado del primero; reflejarlo
    if (ag.length > 1) {
      ag[0].c.notas.push("La exención y el gravado de aguinaldo se presentan en este renglón e incluyen el aguinaldo de ejercicios anteriores.");
    }
    pv.exento = exPvPend;
    pv.gravado = grPv;
    pv.isr = reparto[ag.length];
    if (pv.saldo.gt(0)) pv.c.fiscal = { tratamiento: `Prima vacacional: exenta hasta ${pPag.exenciones.primaVacacionalDias} × ${baseEx === "UMA" ? "UMA" : "salario mínimo"} (art. 93 fr. XIV LISR)`, exento: s2(pv.exento), gravado: s2(pv.gravado), isr: s2(pv.isr), estado: estadoBloque };
    if (agSaldo.gt(0) || pvSaldo.gt(0)) {
      bloques.push({
        id: "GRATIFICACIONES",
        titulo: "Aguinaldo y prima vacacional",
        baseTotal: s2(agSaldo.plus(pvSaldo)),
        exento: s2(exAgPend.plus(exPvPend)),
        gravado: s2(gravadoPool),
        isr: s2(isr),
        procedimiento: proc,
        fundamento: ["LISR art. 93 fr. XIV y XV", "LISR art. 96, párrafo tercero", "RISR art. 174"],
        estado: estadoBloque,
      });
    }
  }

  // 7d. Bloque SEPARACION
  {
    const sepConceptos = conceptos.filter((x) => x.c.grupo === "SEPARACION" && x.c.aplica && x.saldo.gt(0) && x.c.clave !== "SALARIOS_VENCIDOS");
    const sepTotal = sepConceptos.reduce((a, x) => a.plus(x.saldo), ZERO);
    const sv = act("SALARIOS_VENCIDOS");
    if (sv.c.aplica && sv.saldo.gt(0)) {
      sv.c.fiscal = { tratamiento: "Tratamiento fiscal pendiente de validación", exento: "0.00", gravado: "0.00", isr: "0.00", estado: "PROVISIONAL" };
      fiscalProvisional = true;
    }
    if (sepTotal.gt(0)) {
      const aniosFiscales = ant.anios + (ant.meses > 6 || (ant.meses === 6 && ant.dias > 0) ? 1 : 0);
      const capSep = valorBaseEx.times(pPag.exenciones.separacionDiasPorAnio).times(aniosFiscales);
      const ex = sepTotal.lt(capSep) ? sepTotal : capSep;
      const grav = sepTotal.minus(ex);
      const proc: string[] = [
        `Años de servicio para la exención: ${ant.anios} años${aniosFiscales > ant.anios ? " + 1 por fracción mayor a seis meses" : ""} = ${aniosFiscales} (art. 93 fr. XIII LISR).`,
        `Exención = ${pPag.exenciones.separacionDiasPorAnio} × ${baseExLabel} × ${aniosFiscales} años = ${money(capSep)}. Pagos por separación ${money(sepTotal)}; exento ${money(ex)}; gravado ${money(grav)} (RISR art. 172).`,
      ];
      let isr = ZERO;
      let est: "DEFINITIVO" | "PROVISIONAL" = "DEFINITIVO";
      if (grav.gt(0)) {
        if (sinTarifa) {
          marcarProvisional({ id: "sin-tarifa", tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: `No hay tarifa de ISR capturada para ${pPag.anio}: la retención de los pagos por separación queda pendiente.` });
          est = "PROVISIONAL";
          proc.push("Sin tarifa capturada: retención pendiente.");
        } else {
          const r = isrSeparacion(grav, ultimoSueldoMensual, tarifa);
          isr = r.isr;
          if (r.aplicaTarifaDirecta) proc.push(`El gravado (${money(grav)}) es menor al último sueldo mensual ordinario (${money(ultimoSueldoMensual)}): se aplica directamente la tarifa del art. 96 → ${money(isr)}.`);
          else
            proc.push(
              `Tasa = ISR del último sueldo mensual ordinario ÷ ese sueldo = ${money(r.impuestoUltimoSueldo)} ÷ ${money(ultimoSueldoMensual)} = ${num(r.tasa.times(100), 4)}% (art. 96 LISR). Retención = ${money(grav)} × ${num(r.tasa.times(100), 4)}% = ${money(isr)}.`,
            );
        }
      }
      const reparto = repartir(isr, sepConceptos.map((x) => x.saldo));
      const repEx = repartir(ex, sepConceptos.map((x) => x.saldo));
      sepConceptos.forEach((x, i) => {
        x.exento = repEx[i];
        x.gravado = x.saldo.minus(repEx[i]);
        x.isr = reparto[i];
        if (!(x.c.clave.startsWith("OTRO_") && x.c.fiscal.estado !== "NO_APLICA"))
          x.c.fiscal = { tratamiento: "Pago por separación: exento hasta 90 × UMA por año de servicio (art. 93 fr. XIII LISR); excedente con art. 95 y 96", exento: s2(repEx[i]), gravado: s2(x.gravado), isr: s2(reparto[i]), estado: est };
      });
      bloques.push({
        id: "SEPARACION",
        titulo: "Primas de antigüedad, indemnizaciones y otros pagos por separación",
        baseTotal: s2(sepTotal),
        exento: s2(ex),
        gravado: s2(grav),
        isr: s2(isr),
        procedimiento: proc,
        fundamento: ["LISR art. 93 fr. XIII", "LISR art. 95 y 96 (penúltimo párrafo)", "RISR art. 172"],
        estado: est,
      });
    }
  }

  // Otros conceptos con tratamiento SEPARACION ya incluidos arriba; los de tratamiento desconocido no retienen.
  // ───────────────────────── Deducciones ─────────────────────────
  const noIndemnizatorios = conceptos.filter((x) => x.c.grupo !== "SEPARACION");
  const netoNoIndem = noIndemnizatorios.reduce((a, x) => a.plus(x.saldo).minus(x.isr), ZERO);
  const topeMes = sd.times(L.divisorSalarioMensual);
  let disponible = max0(netoNoIndem);
  const deduccionesEval: DeduccionEvaluada[] = input.deducciones.map((d) => {
    const solicitado = D(d.monto);
    const base: Omit<DeduccionEvaluada, "montoAplicado" | "aplicada" | "motivo"> = {
      tipo: TIPO_DEDUCCION_LABEL[d.tipo],
      descripcion: d.descripcion,
      montoSolicitado: s2(solicitado),
      fundamento: "Art. 110 LFT",
    };
    const rechaza = (motivoTxt: string): DeduccionEvaluada => ({ ...base, montoAplicado: "0.00", aplicada: false, motivo: motivoTxt });
    if (solicitado.lte(0)) return rechaza("Monto cero.");
    if (d.tipo === "OTRA") return rechaza("Deducción no catalogada: no se aplica automáticamente. Requiere validación jurídica (art. 110 LFT enumera los descuentos permitidos).");
    if (!d.sustentoDocumental) return rechaza("No se acreditó el sustento documental; no se aplica.");
    let tope = solicitado;
    let nota = "Procedente con sustento documental.";
    if (d.tipo === "ANTICIPO_SALARIO" || d.tipo === "PAGO_EXCESO_O_ERROR") {
      if (!d.consentimientoEscrito) return rechaza("El descuento debe convenirse con el trabajador (art. 110 fr. I LFT); falta su consentimiento por escrito.");
      if (solicitado.gt(topeMes)) {
        tope = topeMes;
        nota = `Limitada a un mes de salario (${money(topeMes)}), art. 110 fr. I LFT. Verifique también el límite del 30% del excedente del salario mínimo en la forma de descuento.`;
      } else nota = "Procedente con sustento y consentimiento. Verifique el límite del 30% del excedente del salario mínimo del art. 110 fr. I LFT.";
    } else if (d.tipo === "CAJA_AHORRO" || d.tipo === "CUOTA_SINDICAL" || d.tipo === "INFONAVIT") {
      if (!d.consentimientoEscrito && d.tipo !== "INFONAVIT") return rechaza("Requiere autorización/consentimiento por escrito del trabajador (art. 110 LFT).");
    }
    // Pensión alimenticia: mandato judicial, puede alcanzar todo el neto
    const techo = d.tipo === "PENSION_ALIMENTICIA" ? disponible.plus(netoIndemFn()) : disponible;
    const aplicado = D(Dec.min(tope, techo));
    if (aplicado.lt(tope)) nota += " Reducida: no puede exceder el neto de salarios y prestaciones (las indemnizaciones no son descontables por deudas del trabajador; art. 33 LFT).";
    if (d.tipo !== "PENSION_ALIMENTICIA") disponible = disponible.minus(aplicado);
    return { ...base, montoAplicado: s2(aplicado), aplicada: aplicado.gt(0), motivo: nota };
  });
  function netoIndemFn() {
    return conceptos.filter((x) => x.c.grupo === "SEPARACION").reduce((a, x) => a.plus(x.saldo).minus(x.isr), ZERO);
  }
  const dedAplicadas = deduccionesEval.reduce((a, d) => a.plus(d.montoAplicado), ZERO);
  deduccionesEval.filter((d) => !d.aplicada).forEach((d, i) => addPend({ id: `deduccion-no-aplicada-${i}-${d.descripcion.slice(0, 10)}`, tipo: "VALIDACION", severidad: "ADVERTENCIA", mensaje: `Deducción "${d.descripcion}" NO aplicada: ${d.motivo}` }));

  // ───────────────────────── Datos adicionales por motivo ─────────────────────────
  if (motivo === "DESPIDO_JUSTIFICADO" && !input.detalleMotivo) {
    addPend({ id: "causa-despido", tipo: "DATO", severidad: "ADVERTENCIA", campo: "detalleMotivo", mensaje: "Describa la causa de rescisión (art. 47 LFT) y confirme que se entregó el aviso de rescisión. Sin sustento, el despido puede considerarse injustificado." });
  }
  if (motivo === "DESPIDO_INJUSTIFICADO" || motivo === "RESCISION_IMPUTABLE_PATRON") {
    avisos.push("Las indemnizaciones se calculan con el salario integrado; si existen otras prestaciones que integren salario (art. 84 LFT), capturelas en 'Otras percepciones diarias' o el salario integrado conocido.");
  }
  if (motivo === "MUTUO_CONSENTIMIENTO") {
    avisos.push("Mutuo consentimiento: documente el convenio por escrito. Si se pacta un pago adicional, regístrelo en 'Otros conceptos'. Verifique con asesoría jurídica si procede ratificar el convenio ante el Centro de Conciliación.");
  }
  if (motivo === "FALLECIMIENTO") {
    addPend({ id: "beneficiarios", tipo: "DATO", severidad: "BLOQUEANTE", campo: "detalleMotivo", mensaje: "Identifique a los beneficiarios conforme al art. 501 LFT en el campo de detalle; el pago no puede hacerse sin acreditarlos." });
  }
  if (motivo === "OTRA_CAUSA") {
    addPend({ id: "otra-causa", tipo: "VALIDACION", severidad: "BLOQUEANTE", mensaje: "Causa de terminación no catalogada: el sistema calcula únicamente las prestaciones proporcionales. La procedencia de indemnizaciones o primas requiere revisión jurídica." });
  }
  if (motivo === "TERMINO_CONTRATO_DETERMINADO" && input.tipoContrato !== "DETERMINADO") {
    avisos.push("El motivo es terminación de contrato por tiempo determinado pero el tipo de contrato capturado es indeterminado. Verifique la modalidad contractual.");
  }
  if (motivo === "RENUNCIA_VOLUNTARIA" && !input.voluntadRenunciaManifestada) {
    avisos.push("Marque que el trabajador manifestó su voluntad de renunciar para poder generar la carta de renuncia.");
  }
  if (ant.diasTotales > 365 * 40) avisos.push("Antigüedad superior a 40 años: verifique las fechas.");
  supuestos.push("Redondeo: importes por concepto a centavos (mitad hacia arriba); salario diario con 6 decimales; totales = suma de importes ya redondeados.");

  // ───────────────────────── Totales ─────────────────────────
  const aplicables = conceptos.filter((x) => x.c.aplica);
  const generado = aplicables.reduce((a, x) => a.plus(x.generado), ZERO);
  const pagado = aplicables.reduce((a, x) => a.plus(x.pagado), ZERO);
  const saldoBruto = aplicables.reduce((a, x) => a.plus(x.saldo), ZERO);
  const retenciones = aplicables.reduce((a, x) => a.plus(x.isr), ZERO);
  const netoCalculado = saldoBruto.minus(retenciones).minus(dedAplicadas);
  const anticiposTot = input.anticipos.reduce((a, x) => a.plus(r2(x.monto)), ZERO);
  let netoAPagar = netoCalculado.minus(anticiposTot);
  if (netoAPagar.isNegative()) {
    avisos.push(`Los anticipos entregados (${money(anticiposTot)}) exceden el neto calculado (${money(netoCalculado)}). El excedente no se descuenta ni se cobra automáticamente.`);
    netoAPagar = ZERO;
  }
  if (netoCalculado.isNegative()) avisos.push("El neto calculado es negativo; revise las deducciones.");

  // ───────────────────────── Estado ─────────────────────────
  let estado: EstadoCalculo = "DEFINITIVO";
  if (pendientes.some((p) => p.severidad === "ADVERTENCIA") || fiscalProvisional) estado = "PROVISIONAL";
  if (pendientes.some((p) => p.severidad === "BLOQUEANTE")) estado = "INCOMPLETO";

  return {
    motorVersion: ENGINE_VERSION,
    fechaCalculo: opts.fechaCalculo ?? hoyISO(),
    estado,
    motivo,
    ejercicioPago,
    fechaPago,
    antiguedad: ant,
    salario: {
      tipoCapturado: input.salario.tipo,
      montoCapturado: montoSal ? s2(montoSal) : null,
      diario: sd.toFixed(6),
      diarioIntegrado: sdi.toFixed(6),
      factorIntegracion: factorR.toFixed(6),
      detalleIntegracion,
      minimoReferencia: { etiqueta: smEtiqueta, monto: s2(smReferencia) },
      explicacion: sdExplicacion,
    },
    conceptos: conceptos.map((x) => x.c),
    deducciones: deduccionesEval,
    anticipos: input.anticipos.map((a) => ({ descripcion: a.descripcion, monto: s2(a.monto), fecha: a.fecha ?? null })),
    fiscal: {
      umaDiaria: s2(uma.valor),
      baseExencion: baseEx,
      baseExencionMonto: s2(valorBaseEx),
      bloques,
      totalIsr: s2(retenciones),
      estado: fiscalProvisional ? "PROVISIONAL" : "DEFINITIVO",
    },
    totales: {
      generado: s2(generado),
      previamentePagado: s2(pagado),
      saldoBruto: s2(saldoBruto),
      retenciones: s2(retenciones),
      deduccionesAplicadas: s2(dedAplicadas),
      netoCalculado: s2(netoCalculado),
      anticiposEntregados: s2(anticiposTot),
      netoAPagar: s2(netoAPagar),
    },
    pendientes,
    avisos,
    supuestos,
    parametros: { salario: pSal, pago: pPag, usoParametrosSustitutos: sustitutos },
  };
}

export { MOTIVO_LABEL };
