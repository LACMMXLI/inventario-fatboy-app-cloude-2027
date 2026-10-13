/** Utilidades de fechas calendario (sin horas ni zonas horarias). Todas las fechas son 'YYYY-MM-DD'. */

export const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseISO(s: string): Date {
  if (!ISO_RE.test(s)) throw new Error(`Fecha inválida: ${s}`);
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new Error(`Fecha inexistente: ${s}`);
  }
  return dt;
}

export function isValidISO(s: string): boolean {
  try {
    parseISO(s);
    return true;
  } catch {
    return false;
  }
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MS_DAY = 86_400_000;

/** Días entre dos fechas (b - a), sin inclusividad */
export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DAY);
}

export function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInYear(y: number): number {
  return isLeap(y) ? 366 : 365;
}

/** Suma meses conservando el día; si no existe (p. ej. 31), se usa el último día del mes. */
export function addMonths(d: Date, n: number): Date {
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + n;
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const day = Math.min(d.getUTCDate(), daysInMonth(y, m));
  return new Date(Date.UTC(y, m, day));
}

export const addYears = (d: Date, n: number): Date => addMonths(d, n * 12);

export interface Antiguedad {
  anios: number;
  meses: number;
  dias: number;
  /** Días naturales de servicio, incluyendo el día de ingreso y el de terminación */
  diasTotales: number;
  /** Inicio del año de servicio en curso (último aniversario) */
  ultimoAniversario: string;
  /** Siguiente aniversario */
  proximoAniversario: string;
  /** Días del año de servicio en curso transcurridos (inclusive) */
  diasCicloTranscurridos: number;
  /** Duración en días del año de servicio en curso (365/366) */
  diasCicloTotal: number;
  /** años completos + fracción proporcional del año de servicio en curso */
  aniosDecimal: string;
  texto: string;
}

/**
 * Antigüedad exacta. Convención: el periodo de servicio incluye el día de ingreso y el día de terminación
 * (se mide de `ingreso` a `terminacion + 1 día`, de modo que ingreso 15-mar-2024 y terminación 14-mar-2026 = 2 años exactos).
 */
export function calcularAntiguedad(ingresoISO: string, terminacionISO: string): Antiguedad {
  const ing = parseISO(ingresoISO);
  const fin = addDays(parseISO(terminacionISO), 1);
  if (fin <= ing) throw new Error("La fecha de terminación debe ser igual o posterior a la de ingreso");

  let anios = fin.getUTCFullYear() - ing.getUTCFullYear();
  if (addYears(ing, anios) > fin) anios--;
  const afterYears = addYears(ing, anios);
  let meses = (fin.getUTCFullYear() - afterYears.getUTCFullYear()) * 12 + (fin.getUTCMonth() - afterYears.getUTCMonth());
  if (addMonths(afterYears, meses) > fin) meses--;
  const afterMonths = addMonths(afterYears, meses);
  const dias = diffDays(afterMonths, fin);

  const ultimo = addYears(ing, anios);
  const proximo = addYears(ing, anios + 1);
  const diasCicloTotal = diffDays(ultimo, proximo);
  const diasCicloTranscurridos = diffDays(ultimo, fin);
  const diasTotales = diffDays(ing, fin);

  const aniosDecimal = (anios + diasCicloTranscurridos / diasCicloTotal).toFixed(8);
  const partes: string[] = [];
  partes.push(`${anios} ${anios === 1 ? "año" : "años"}`);
  partes.push(`${meses} ${meses === 1 ? "mes" : "meses"}`);
  partes.push(`${dias} ${dias === 1 ? "día" : "días"}`);

  return {
    anios,
    meses,
    dias,
    diasTotales,
    ultimoAniversario: toISO(ultimo),
    proximoAniversario: toISO(proximo),
    diasCicloTranscurridos,
    diasCicloTotal,
    aniosDecimal,
    texto: partes.join(", "),
  };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** 5 de enero de 2026 */
export function fechaLarga(iso: string): string {
  const d = parseISO(iso);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Fecha de hoy en la zona horaria de Mexicali (America/Tijuana) en formato ISO */
export function hoyISO(tz = "America/Tijuana"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts;
}
