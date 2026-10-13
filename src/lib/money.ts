import Decimal from "decimal.js";

/**
 * Aritmética monetaria decimal (nunca float).
 * Reglas de redondeo del sistema:
 *  - Importes finales de cada concepto, impuestos y totales: 2 decimales, ROUND_HALF_UP.
 *  - Salarios diarios derivados y factores intermedios: 6 decimales, ROUND_HALF_UP.
 *  - Los totales son la suma de importes ya redondeados (el desglose siempre cuadra al centavo).
 */
export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof Dec>;

export const ZERO = new Dec(0);

export function D(v: Decimal.Value | null | undefined): Dec {
  if (v === null || v === undefined || v === "") return new Dec(0);
  return new Dec(typeof v === "number" ? String(v) : (v as Decimal.Value));
}

export const r2 = (v: Decimal.Value): Dec => D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export const r6 = (v: Decimal.Value): Dec => D(v).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);

/** Cadena con exactamente 2 decimales (sin separadores) */
export const s2 = (v: Decimal.Value): string => r2(v).toFixed(2);

export function max0(v: Decimal.Value): Dec {
  const d = D(v);
  return d.isNegative() ? new Dec(0) : d;
}

export function sum(values: Decimal.Value[]): Dec {
  return values.reduce<Dec>((a, b) => a.plus(D(b)), new Dec(0));
}

const fmt = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formato monetario para presentación: $1,234.56 */
export function money(v: Decimal.Value | null | undefined): string {
  const n = r2(D(v));
  const s = fmt.format(Number(n.abs().toFixed(2)));
  return `${n.isNegative() ? "-" : ""}$${s}`;
}

/** Número con hasta n decimales sin ceros sobrantes, p. ej. 12.5 */
export function num(v: Decimal.Value, dp = 4): string {
  const d = D(v).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
  return d.toFixed().replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
}
