import { D, Dec, ZERO, r2, max0 } from "../money";
import type { ParametrosLegales } from "../legal/types";

type Tarifa = NonNullable<ParametrosLegales["tarifaMensualIsr"]>;

/** Factor de conversión mensual→diario que usa el SAT en sus tarifas por periodo (Anexo 8 RMF) */
export const DIAS_MES_SAT = new Dec("30.4");

/**
 * ISR según la tarifa del art. 96 LISR. `factor` escala la tarifa mensual a un periodo distinto de un mes
 * (factor = días del periodo / 30.4), tal como el SAT construye sus tarifas diaria, semanal, decenal y quincenal.
 * Resultado redondeado a centavos.
 */
export function isrTarifa(base: Dec, tarifa: Tarifa, factor: Dec = new Dec(1)): Dec {
  if (base.lte(0)) return ZERO;
  for (const row of tarifa) {
    const li = D(row.limiteInferior).times(factor);
    const ls = row.limiteSuperior === null ? null : D(row.limiteSuperior).times(factor);
    if (base.gte(li.minus(0.0000001)) && (ls === null || base.lte(ls.plus(0.0000001)))) {
      const cuota = D(row.cuotaFija).times(factor);
      const excedente = max0(base.minus(li));
      return r2(cuota.plus(excedente.times(D(row.porcentaje)).div(100)));
    }
  }
  // base menor al primer límite inferior (centavos): 1.92% sobre la base
  const first = tarifa[0];
  return r2(base.times(D(first.porcentaje)).div(100));
}

export interface Isr174 {
  ingresoMensualEquivalente: Dec; // fracción I
  ingresoOrdinario: Dec;
  impuestoConGratificacion: Dec; // fracción II
  impuestoOrdinario: Dec; // fracción III
  diferencia: Dec;
  tasa: Dec; // fracción V (proporción, no %)
  isr: Dec; // fracción IV
}

/** Retención sobre gratificación anual / primas vacacionales (art. 174 RISR). */
export function isrArt174(remuneracion: Dec, ingresoOrdinarioMensual: Dec, tarifa: Tarifa): Isr174 {
  if (remuneracion.lte(0)) {
    return {
      ingresoMensualEquivalente: ZERO,
      ingresoOrdinario: ingresoOrdinarioMensual,
      impuestoConGratificacion: ZERO,
      impuestoOrdinario: ZERO,
      diferencia: ZERO,
      tasa: ZERO,
      isr: ZERO,
    };
  }
  const i = remuneracion.div(365).times(DIAS_MES_SAT); // I
  const conGrat = isrTarifa(ingresoOrdinarioMensual.plus(i), tarifa); // II
  const ordinario = isrTarifa(ingresoOrdinarioMensual, tarifa); // III
  const dif = conGrat.minus(ordinario);
  const tasa = dif.div(i); // V
  return {
    ingresoMensualEquivalente: i,
    ingresoOrdinario: ingresoOrdinarioMensual,
    impuestoConGratificacion: conGrat,
    impuestoOrdinario: ordinario,
    diferencia: dif,
    tasa,
    isr: r2(remuneracion.times(tasa)), // IV
  };
}

export interface IsrSeparacion {
  ultimoSueldoMensual: Dec;
  impuestoUltimoSueldo: Dec;
  tasa: Dec;
  aplicaTarifaDirecta: boolean;
  isr: Dec;
}

/** Retención sobre primas de antigüedad, indemnizaciones y otros pagos por separación (art. 95 y 96 LISR). */
export function isrSeparacion(gravado: Dec, ultimoSueldoMensual: Dec, tarifa: Tarifa): IsrSeparacion {
  const impuestoUltimo = isrTarifa(ultimoSueldoMensual, tarifa);
  if (gravado.lte(0)) {
    return { ultimoSueldoMensual, impuestoUltimoSueldo: impuestoUltimo, tasa: ZERO, aplicaTarifaDirecta: false, isr: ZERO };
  }
  if (gravado.lt(ultimoSueldoMensual)) {
    return { ultimoSueldoMensual, impuestoUltimoSueldo: impuestoUltimo, tasa: ZERO, aplicaTarifaDirecta: true, isr: isrTarifa(gravado, tarifa) };
  }
  const tasa = impuestoUltimo.div(ultimoSueldoMensual);
  return { ultimoSueldoMensual, impuestoUltimoSueldo: impuestoUltimo, tasa, aplicaTarifaDirecta: false, isr: r2(gravado.times(tasa)) };
}

/** Reparte un total (en centavos) entre partidas proporcionalmente; la diferencia por redondeo va a la última partida con peso. */
export function repartir(total: Dec, pesos: Dec[]): Dec[] {
  const suma = pesos.reduce((a, b) => a.plus(b), ZERO);
  if (suma.lte(0) || total.lte(0)) return pesos.map(() => ZERO);
  const out = pesos.map((p) => r2(total.times(p).div(suma)));
  const asignado = out.reduce((a, b) => a.plus(b), ZERO);
  const diff = total.minus(asignado);
  if (!diff.isZero()) {
    for (let i = pesos.length - 1; i >= 0; i--) {
      if (pesos[i].gt(0)) {
        out[i] = out[i].plus(diff);
        break;
      }
    }
  }
  return out;
}
