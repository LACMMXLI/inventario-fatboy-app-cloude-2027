import { PARAMETROS_DEFAULT } from "../../src/lib/legal/defaults";
import type { ParametrosLegales } from "../../src/lib/legal/types";
import type { FiniquitoInputRaw } from "../../src/lib/finiquito/schema";

/** Catálogo de pruebas con todos los grupos CONFIRMADOS (simula que el administrador validó los parámetros) */
export function catalogoConfirmado(): ParametrosLegales[] {
  return PARAMETROS_DEFAULT.map((p) => ({
    ...structuredClone(p),
    estatus: { salariosMinimos: "CONFIRMADO", uma: "CONFIRMADO", tarifaIsr: p.tarifaMensualIsr ? "CONFIRMADO" : "PENDIENTE", exenciones: "CONFIRMADO", subsidio: "CONFIRMADO" },
  }));
}

export function base(over: Partial<FiniquitoInputRaw> = {}): FiniquitoInputRaw {
  return {
    trabajador: { nombre: "Juan Pérez López", puesto: "Cocinero", sucursal: "Venecia" },
    fechaIngreso: "2023-03-15",
    fechaTerminacion: "2026-07-14",
    motivo: "RENUNCIA_VOLUNTARIA",
    tipoContrato: "INDETERMINADO",
    salario: { tipo: "DIARIO", monto: 500, zona: "ZLFN" },
    sueldos: { diasPendientes: 0 },
    ...over,
  } as FiniquitoInputRaw;
}
