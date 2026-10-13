import { describe, expect, it } from "vitest";
import { calcularFiniquito, diasVacaciones, ErrorCalculo } from "../../src/lib/finiquito/engine";
import { PARAMETROS_DEFAULT } from "../../src/lib/legal/defaults";
import { base, catalogoConfirmado } from "./helpers";

const cat = catalogoConfirmado();
const c = (r: ReturnType<typeof calcularFiniquito>, clave: string) => r.conceptos.find((x) => x.clave === clave)!;

describe("tabla de vacaciones (art. 76 LFT, reforma 2023)", () => {
  it.each([
    [1, 12], [2, 14], [3, 16], [4, 18], [5, 20], [6, 22], [10, 22], [11, 24], [15, 24], [16, 26], [21, 28], [26, 30], [31, 32],
  ])("año de servicio %i = %i días", (anio, dias) => expect(diasVacaciones(anio)).toBe(dias));
});

describe("renuncia voluntaria con 3 años 4 meses (caso base, cifras verificadas con cálculo independiente)", () => {
  const r = calcularFiniquito(base(), cat, { fechaCalculo: "2026-07-14" });

  it("antigüedad exacta", () => {
    expect(r.antiguedad).toMatchObject({ anios: 3, meses: 4, dias: 0, diasCicloTranscurridos: 122, diasCicloTotal: 365 });
  });
  it("vacaciones proporcionales: 18 × 122/365 × 500", () => expect(c(r, "VACACIONES").saldo).toBe("3008.22"));
  it("prima vacacional 25%", () => expect(c(r, "PRIMA_VACACIONAL").saldo).toBe("752.05"));
  it("aguinaldo proporcional: 15 × 195/365 × 500", () => expect(c(r, "AGUINALDO").saldo).toBe("4006.85"));
  it("sin prima de antigüedad ni indemnizaciones", () => {
    for (const k of ["PRIMA_ANTIGUEDAD", "INDEMNIZACION_3_MESES", "INDEMNIZACION_20_DIAS", "SALARIOS_VENCIDOS"]) {
      expect(c(r, k).aplica).toBe(false);
      expect(c(r, k).saldo).toBe("0.00");
    }
  });
  it("exenciones con UMA 117.31: aguinaldo 3,519.30 y prima 100% exenta", () => {
    expect(r.fiscal.umaDiaria).toBe("117.31");
    expect(c(r, "AGUINALDO").fiscal.exento).toBe("3519.30");
    expect(c(r, "AGUINALDO").fiscal.gravado).toBe("487.55");
    expect(c(r, "PRIMA_VACACIONAL").fiscal.gravado).toBe("0.00");
  });
  it("ISR: vacaciones por tarifa proporcional y excedente de aguinaldo por art. 174 RISR", () => {
    expect(c(r, "VACACIONES").fiscal.isr).toBe("284.72");
    expect(c(r, "AGUINALDO").fiscal.isr).toBe("87.41");
  });
  it("totales", () => {
    expect(r.totales.saldoBruto).toBe("7767.12");
    expect(r.totales.retenciones).toBe("372.13");
    expect(r.totales.netoAPagar).toBe("7394.99");
  });
  it("con parámetros confirmados y sin datos faltantes el cálculo es DEFINITIVO", () => {
    expect(r.pendientes).toEqual([]);
    expect(r.estado).toBe("DEFINITIVO");
  });
  it("el total bruto es exactamente la suma de los saldos de los conceptos", () => {
    const suma = r.conceptos.reduce((a, x) => a + Math.round(Number(x.saldo) * 100), 0);
    expect(suma).toBe(Math.round(Number(r.totales.saldoBruto) * 100));
  });
});

describe("parámetros sin confirmar → PROVISIONAL (nunca definitivo)", () => {
  it("con los parámetros sembrados (sin confirmar) el resultado es provisional", () => {
    const r = calcularFiniquito(base(), PARAMETROS_DEFAULT);
    expect(r.estado).toBe("PROVISIONAL");
    expect(r.pendientes.some((p) => p.id === "exenciones-no-validadas")).toBe(true);
  });
  it("ejercicio 2025 sin tarifa capturada: la retención queda pendiente y se explica", () => {
    const r = calcularFiniquito(base({ fechaIngreso: "2024-01-10", fechaTerminacion: "2025-06-30", sueldos: { diasPendientes: 10 } }), cat);
    expect(r.estado).toBe("PROVISIONAL");
    expect(r.pendientes.some((p) => p.id === "sin-tarifa")).toBe(true);
    expect(r.totales.retenciones).toBe("0.00");
  });
  it("ejercicio futuro sin parámetros usa el último disponible y lo advierte", () => {
    const r = calcularFiniquito(base({ fechaIngreso: "2026-01-10", fechaTerminacion: "2027-03-20" }), cat);
    expect(r.estado).toBe("PROVISIONAL");
    expect(r.parametros.usoParametrosSustitutos.length).toBeGreaterThan(0);
  });
  it("sin ningún parámetro aplicable lanza error de parámetros", () => {
    expect(() => calcularFiniquito(base({ fechaIngreso: "2020-01-01", fechaTerminacion: "2020-05-01" }), cat)).toThrow(ErrorCalculo);
  });
});

describe("tipos de terminación", () => {
  it("despido injustificado: 3 meses + 20 días por año + prima de antigüedad (salario integrado)", () => {
    const r = calcularFiniquito(base({ motivo: "DESPIDO_INJUSTIFICADO", fechaIngreso: "2022-07-15", fechaTerminacion: "2026-07-14" }), cat);
    // 4 años cumplidos → quinto año de servicio: 20 días de vacaciones; factor = (365+15+20×.25)/365 = 385/365
    expect(r.salario.factorIntegracion).toBe("1.054795");
    const sdi = 500 * (385 / 365);
    expect(Number(r.salario.diarioIntegrado)).toBeCloseTo(sdi, 3);
    expect(Number(c(r, "INDEMNIZACION_3_MESES").saldo)).toBeCloseTo(90 * sdi, 1);
    expect(Number(c(r, "INDEMNIZACION_20_DIAS").saldo)).toBeCloseTo(20 * 4 * sdi, 1);
    // prima antigüedad: 12 días × 4 años × SD(500) con tope 2×440.87 = 881.74 (no se alcanza)
    expect(c(r, "PRIMA_ANTIGUEDAD").saldo).toBe("24000.00");
  });
  it("prima de antigüedad topada al doble del salario mínimo", () => {
    const r = calcularFiniquito(base({ motivo: "DESPIDO_JUSTIFICADO", salario: { tipo: "DIARIO", monto: 1500, zona: "ZLFN" }, fechaIngreso: "2022-07-15", fechaTerminacion: "2026-07-14" }), cat);
    expect(c(r, "PRIMA_ANTIGUEDAD").saldo).toBe(((12 * 4 * 881.74)).toFixed(2));
    expect(c(r, "INDEMNIZACION_3_MESES").aplica).toBe(false);
  });
  it("renuncia con 15 años o más sí genera prima de antigüedad; con menos no", () => {
    const con15 = calcularFiniquito(base({ fechaIngreso: "2011-07-15", fechaTerminacion: "2026-07-14" }), cat);
    expect(c(con15, "PRIMA_ANTIGUEDAD").aplica).toBe(true);
    const con14 = calcularFiniquito(base({ fechaIngreso: "2012-07-16", fechaTerminacion: "2026-07-14" }), cat);
    expect(c(con14, "PRIMA_ANTIGUEDAD").aplica).toBe(false);
  });
  it("contrato determinado menor a un año: indemnización = salarios de la mitad del tiempo", () => {
    const r = calcularFiniquito(base({ motivo: "DESPIDO_INJUSTIFICADO", tipoContrato: "DETERMINADO", fechaIngreso: "2026-01-01", fechaTerminacion: "2026-04-10" }), cat);
    // 100 días de servicio → 50 días × SDI
    expect(Number(c(r, "INDEMNIZACION_20_DIAS").saldo)).toBeCloseTo(50 * Number(r.salario.diarioIntegrado), 1);
    expect(c(r, "PRIMA_ANTIGUEDAD").aplica).toBe(false);
  });
  it("fallecimiento exige identificar beneficiarios (bloqueante)", () => {
    const r = calcularFiniquito(base({ motivo: "FALLECIMIENTO" }), cat);
    expect(r.estado).toBe("INCOMPLETO");
  });
  it("otra causa no calcula indemnizaciones y queda incompleta", () => {
    const r = calcularFiniquito(base({ motivo: "OTRA_CAUSA" }), cat);
    expect(r.estado).toBe("INCOMPLETO");
    expect(c(r, "INDEMNIZACION_3_MESES").aplica).toBe(false);
  });
});

describe("salario", () => {
  it("convierte mensual, quincenal y semanal a salario diario", () => {
    expect(calcularFiniquito(base({ salario: { tipo: "MENSUAL", monto: 15000, zona: "ZLFN" } }), cat).salario.diario).toBe("500.000000");
    expect(calcularFiniquito(base({ salario: { tipo: "QUINCENAL", monto: 7500, zona: "ZLFN" } }), cat).salario.diario).toBe("500.000000");
    expect(calcularFiniquito(base({ salario: { tipo: "SEMANAL", monto: 3500, zona: "ZLFN" } }), cat).salario.diario).toBe("500.000000");
  });
  it("salario mínimo ZLFN 2026 = 440.87", () => {
    const r = calcularFiniquito(base({ salario: { tipo: "MINIMO", zona: "ZLFN" } }), cat);
    expect(r.salario.diario).toBe("440.870000");
    const g = calcularFiniquito(base({ salario: { tipo: "MINIMO", zona: "GENERAL" } }), cat);
    expect(g.salario.diario).toBe("315.040000");
  });
  it("advierte si el salario es menor al mínimo", () => {
    const r = calcularFiniquito(base({ salario: { tipo: "DIARIO", monto: 300, zona: "ZLFN" } }), cat);
    expect(r.avisos.some((a) => a.includes("menor al mínimo"))).toBe(true);
  });
});

describe("pagos previos y no duplicación", () => {
  it("aguinaldo y prima ya pagados reducen el saldo y nunca generan saldo negativo", () => {
    const r = calcularFiniquito(base({ aguinaldo: { pagadoMonto: 9999 }, primaVacacional: { pagadoMonto: 100, pagoPrevioEnEjercicioActual: true } }), cat);
    expect(c(r, "AGUINALDO").saldo).toBe("0.00");
    expect(c(r, "PRIMA_VACACIONAL").saldo).toBe("652.05");
  });
  it("aguinaldo parcialmente pagado consume primero la exención", () => {
    const r = calcularFiniquito(base({ aguinaldo: { pagadoMonto: 2000 } }), cat);
    expect(c(r, "AGUINALDO").saldo).toBe("2006.85");
    expect(c(r, "AGUINALDO").fiscal.exento).toBe("1519.30"); // 3,519.30 − 2,000
    expect(c(r, "AGUINALDO").fiscal.gravado).toBe("487.55");
  });
  it("vacaciones disfrutadas y pagadas se descuentan en días", () => {
    const r = calcularFiniquito(base({ vacaciones: { diasDisfrutadosCicloActual: 2, diasPagadosEnDinero: 1, diasPendientesCiclosAnteriores: 0 } }), cat);
    // (6.016438 − 3) × 500
    expect(c(r, "VACACIONES").saldo).toBe("1508.22");
  });
  it("prima ya pagada sin indicar el ejercicio genera pendiente de dato", () => {
    const r = calcularFiniquito(base({ primaVacacional: { pagadoMonto: 100 } }), cat);
    expect(r.pendientes.some((p) => p.id === "prima-previa-ejercicio")).toBe(true);
    expect(r.estado).toBe("PROVISIONAL");
  });
  it("anticipos reducen el neto a pagar", () => {
    const r = calcularFiniquito(base({ anticipos: [{ descripcion: "Pago parcial", monto: 1000 }] }), cat);
    expect(r.totales.netoAPagar).toBe("6394.99");
  });
});

describe("sueldos pendientes", () => {
  it("calcula días desde el último día pagado", () => {
    const r = calcularFiniquito(base({ sueldos: { ultimoDiaPagado: "2026-07-04" } }), cat);
    expect(c(r, "SUELDOS_PENDIENTES").dias).toBe("10 días");
    expect(c(r, "SUELDOS_PENDIENTES").generado).toBe("5000.00");
  });
  it("pide el dato cuando no se capturó", () => {
    const r = calcularFiniquito(base({ sueldos: {} }), cat);
    expect(r.pendientes.some((p) => p.id === "sueldos-sin-dato")).toBe(true);
  });
});

describe("pagos por separación: exención y retención (art. 93 XIII, 95 y 96 LISR)", () => {
  const r = calcularFiniquito(base({ motivo: "DESPIDO_INJUSTIFICADO", salario: { tipo: "MENSUAL", monto: 15000, zona: "ZLFN" }, fechaIngreso: "2022-07-15", fechaTerminacion: "2026-07-14" }), cat);
  const bloque = r.fiscal.bloques.find((b) => b.id === "SEPARACION")!;
  it("exención = 90 UMA × 4 años", () => {
    expect(bloque.exento).toBe((90 * 117.31 * 4).toFixed(2));
  });
  it("gravado = total − exento y ISR con la tasa del último sueldo mensual", () => {
    const total = Number(bloque.baseTotal);
    expect(Number(bloque.gravado)).toBeCloseTo(total - 90 * 117.31 * 4, 2);
    // ISR(15,000) con tarifa 2026: 5,665.16... fila 17,533.64 no; 14,644.65–17,533.64: 1,339.14 + (15000−14644.65)×17.92%
    const isrUltimo = 1339.14 + (15000 - 14644.65) * 0.1792;
    const tasa = isrUltimo / 15000;
    expect(Number(bloque.isr)).toBeCloseTo(Number(bloque.gravado) * tasa, 1);
  });
  it("la suma del ISR por concepto coincide con el bloque", () => {
    const suma = r.conceptos.filter((x) => x.grupo === "SEPARACION").reduce((a, x) => a + Math.round(Number(x.fiscal.isr) * 100), 0);
    expect(suma).toBe(Math.round(Number(bloque.isr) * 100));
  });
});

describe("deducciones: solo las procedentes", () => {
  const ded = (o: object) => base({ deducciones: [{ tipo: "ANTICIPO_SALARIO", descripcion: "Anticipo", monto: 500, sustentoDocumental: true, consentimientoEscrito: true, ...o } as never] });
  it("se aplica con sustento y consentimiento", () => {
    const r = calcularFiniquito(ded({}), cat);
    expect(r.deducciones[0].aplicada).toBe(true);
    expect(r.totales.deduccionesAplicadas).toBe("500.00");
    expect(r.totales.netoAPagar).toBe("6894.99");
  });
  it("sin sustento o sin consentimiento NO se aplica y se advierte", () => {
    for (const o of [{ sustentoDocumental: false }, { consentimientoEscrito: false }]) {
      const r = calcularFiniquito(ded(o), cat);
      expect(r.deducciones[0].aplicada).toBe(false);
      expect(r.totales.deduccionesAplicadas).toBe("0.00");
      expect(r.estado).toBe("PROVISIONAL");
    }
  });
  it("la categoría 'otra' nunca se aplica automáticamente", () => {
    const r = calcularFiniquito(ded({ tipo: "OTRA" }), cat);
    expect(r.deducciones[0].aplicada).toBe(false);
  });
  it("limita el anticipo a un mes de salario", () => {
    const r = calcularFiniquito(ded({ monto: 50000 }), cat);
    expect(Number(r.deducciones[0].montoAplicado)).toBeLessThanOrEqual(15000);
  });
  it("no se descuentan deudas del trabajador de las indemnizaciones", () => {
    const r = calcularFiniquito(
      base({ motivo: "DESPIDO_INJUSTIFICADO", fechaIngreso: "2022-07-15", deducciones: [{ tipo: "ANTICIPO_SALARIO", descripcion: "Anticipo", monto: 14000, sustentoDocumental: true, consentimientoEscrito: true }] as never }),
      cat,
    );
    const netoNoIndem = r.conceptos.filter((x) => x.grupo !== "SEPARACION").reduce((a, x) => a + Number(x.saldo) - Number(x.fiscal.isr), 0);
    expect(Number(r.deducciones[0].montoAplicado)).toBeLessThanOrEqual(netoNoIndem + 0.01);
  });
});

describe("otros conceptos", () => {
  it("sin tratamiento fiscal definido no retiene y marca provisional", () => {
    const r = calcularFiniquito(base({ otrosConceptos: [{ nombre: "Bono", monto: 1000, tratamientoFiscal: "DESCONOCIDO" }] as never }), cat);
    expect(r.estado).toBe("PROVISIONAL");
    expect(c(r, "OTRO_1").saldo).toBe("1000.00");
    expect(c(r, "OTRO_1").fiscal.isr).toBe("0.00");
  });
  it("exento sin fundamento no se acepta como exento", () => {
    const r = calcularFiniquito(base({ otrosConceptos: [{ nombre: "Despensa", monto: 800, tratamientoFiscal: "EXENTO" }] as never }), cat);
    expect(r.pendientes.some((p) => p.id === "otro-0-exento")).toBe(true);
  });
});

describe("validaciones de entrada", () => {
  it("rechaza terminación anterior al ingreso", () => {
    expect(() => calcularFiniquito(base({ fechaTerminacion: "2020-01-01" }), cat)).toThrow();
  });
  it("rechaza prima vacacional menor al 25%", () => {
    expect(() => calcularFiniquito(base({ integracion: { primaVacacionalPct: 10 } as never }), cat)).toThrow();
  });
  it("rechaza fechas inexistentes", () => {
    expect(() => calcularFiniquito(base({ fechaIngreso: "2025-02-30" }), cat)).toThrow();
  });
});

describe("determinismo", () => {
  it("mismos datos y parámetros producen exactamente el mismo resultado", () => {
    const a = calcularFiniquito(base(), cat, { fechaCalculo: "2026-07-14" });
    const b = calcularFiniquito(base(), cat, { fechaCalculo: "2026-07-14" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
