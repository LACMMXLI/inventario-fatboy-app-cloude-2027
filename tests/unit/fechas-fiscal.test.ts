import { describe, expect, it } from "vitest";
import { calcularAntiguedad, addMonths, parseISO, toISO } from "../../src/lib/fechas";
import { isrTarifa, isrArt174, isrSeparacion, repartir } from "../../src/lib/finiquito/fiscal";
import { PARAMETROS_DEFAULT } from "../../src/lib/legal/defaults";
import { D, money, r2 } from "../../src/lib/money";

const t2026 = PARAMETROS_DEFAULT.find((p) => p.anio === 2026)!.tarifaMensualIsr!;
const t2024 = PARAMETROS_DEFAULT.find((p) => p.anio === 2024)!.tarifaMensualIsr!;

describe("antigüedad", () => {
  it("2 años exactos incluyendo el día de terminación", () => {
    expect(calcularAntiguedad("2024-03-15", "2026-03-14")).toMatchObject({ anios: 2, meses: 0, dias: 0 });
  });
  it("un día después", () => {
    expect(calcularAntiguedad("2024-03-15", "2026-03-15")).toMatchObject({ anios: 2, meses: 0, dias: 1 });
  });
  it("mismo día de ingreso y terminación = 1 día", () => {
    const a = calcularAntiguedad("2026-05-01", "2026-05-01");
    expect(a).toMatchObject({ anios: 0, meses: 0, dias: 1, diasTotales: 1 });
  });
  it("ingreso 29 de febrero", () => {
    // el aniversario en año no bisiesto se ajusta al 28 de febrero
    expect(calcularAntiguedad("2024-02-29", "2026-02-27").anios).toBe(2);
    expect(calcularAntiguedad("2024-02-29", "2026-02-26").anios).toBe(1);
  });
  it("meses con fin de mes", () => {
    expect(toISO(addMonths(parseISO("2026-01-31"), 1))).toBe("2026-02-28");
    expect(calcularAntiguedad("2026-01-31", "2026-03-30")).toMatchObject({ anios: 0, meses: 2, dias: 0 });
  });
  it("fracción del año de servicio proporcional", () => {
    const a = calcularAntiguedad("2023-03-15", "2026-07-14");
    expect(Number(a.aniosDecimal)).toBeCloseTo(3 + 122 / 365, 6);
  });
});

describe("tarifa ISR art. 96 (Anexo 8 RMF)", () => {
  it("2026: límites y cuotas del Anexo 8", () => {
    expect(isrTarifa(D("844.59"), t2026).toString()).toBe("16.22"); // 844.59 × 1.92% = 16.2161 → 16.22
    expect(isrTarifa(D("844.60"), t2026).toString()).toBe("16.22");
    expect(isrTarifa(D("10000"), t2026).toString()).toBe(r2(420.95 + (10000 - 7168.52) * 0.1088).toString());
    expect(isrTarifa(D("15000"), t2026).toString()).toBe(r2(1339.14 + (15000 - 14644.65) * 0.1792).toString());
    expect(isrTarifa(D("500000"), t2026).toString()).toBe(r2(133488.54 + (500000 - 425642) * 0.35).toString());
  });
  it("2024: tarifa del Anexo 8 RMF 2024", () => {
    expect(isrTarifa(D("10000"), t2024).toString()).toBe(r2(371.83 + (10000 - 6332.06) * 0.1088).toString());
  });
  it("base cero o negativa = 0", () => {
    expect(isrTarifa(D(0), t2026).toString()).toBe("0");
  });
  it("tarifa continua entre tramos (sin saltos mayores a un centavo)", () => {
    for (let i = 0; i < t2026.length - 1; i++) {
      const ls = D(t2026[i].limiteSuperior!);
      const antes = isrTarifa(ls, t2026);
      const despues = isrTarifa(ls.plus("0.01"), t2026);
      expect(Math.abs(despues.minus(antes).toNumber())).toBeLessThanOrEqual(0.05);
    }
  });
});

describe("procedimientos de retención", () => {
  it("art. 174 RISR: la tasa es la diferencia de impuestos entre el ingreso mensualizado", () => {
    const r = isrArt174(D("1000"), D("15200"), t2026);
    const i = (1000 / 365) * 30.4;
    expect(r.ingresoMensualEquivalente.toNumber()).toBeCloseTo(i, 6);
    const esperado = (isrTarifa(D(15200 + i), t2026).toNumber() - isrTarifa(D(15200), t2026).toNumber()) / i;
    expect(r.tasa.toNumber()).toBeCloseTo(esperado, 8);
    expect(r.isr.toNumber()).toBeCloseTo(1000 * esperado, 1);
  });
  it("art. 95/96: si lo gravado es menor al último sueldo mensual se aplica la tarifa directa", () => {
    const r = isrSeparacion(D("5000"), D("15000"), t2026);
    expect(r.aplicaTarifaDirecta).toBe(true);
    expect(r.isr.toString()).toBe(isrTarifa(D("5000"), t2026).toString());
  });
  it("art. 95/96: tasa = ISR(último sueldo)/sueldo", () => {
    const r = isrSeparacion(D("50000"), D("15000"), t2026);
    expect(r.tasa.toNumber()).toBeCloseTo(isrTarifa(D(15000), t2026).toNumber() / 15000, 10);
  });
  it("repartir conserva el total al centavo", () => {
    const r = repartir(D("100.00"), [D(1), D(1), D(1)]);
    expect(r.reduce((a, b) => a.plus(b), D(0)).toString()).toBe("100");
  });
});

describe("dinero", () => {
  it("evita errores de punto flotante", () => {
    expect(D(0.1).plus(0.2).toString()).toBe("0.3");
  });
  it("redondeo mitad hacia arriba", () => {
    expect(r2("1.005").toString()).toBe("1.01");
    expect(r2("2.675").toString()).toBe("2.68");
  });
  it("formato monetario", () => {
    expect(money("1234567.8")).toBe("$1,234,567.80");
  });
});
