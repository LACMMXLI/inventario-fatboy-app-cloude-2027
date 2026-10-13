/**
 * Pruebas de integración contra PostgreSQL real (DATABASE_URL). Recorren el flujo principal:
 * crear → calcular → revisar → autorizar → pagos → corrección documentada, y los bloqueos de seguridad.
 * Usan los servicios directamente (la capa HTTP se cubre en el recorrido manual/E2E documentado).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }), headers: async () => new Headers() }));

import { prisma } from "../../src/lib/server/db";
import { bootstrap } from "../../src/lib/server/bootstrap";
import { actualizarFiniquito, anularPago, cambiarEstado, corregirFiniquito, crearFiniquito, listarFiniquitos, registrarPago } from "../../src/lib/server/finiquitos";
import { cargarCatalogo, guardarParametros } from "../../src/lib/server/parametros";
import { armarDocData, generarArchivo } from "../../src/lib/server/documentos";
import type { SessionUser } from "../../src/lib/server/auth";

const dbOk = !!process.env.DATABASE_URL;
const sufijo = Date.now().toString(36);
let admin: SessionUser, operador: SessionUser;

const datos = (nombre: string, extra: object = {}) => ({
  trabajador: { nombre, puesto: "Cocinero", sucursal: "Venecia" },
  fechaIngreso: "2023-03-15",
  fechaTerminacion: "2026-07-14",
  motivo: "RENUNCIA_VOLUNTARIA",
  voluntadRenunciaManifestada: true,
  salario: { tipo: "DIARIO", monto: 500, zona: "ZLFN" },
  sueldos: { diasPendientes: 0 },
  ...extra,
});

describe.skipIf(!dbOk)("flujo principal con PostgreSQL", () => {
  beforeAll(async () => {
    await bootstrap();
    const a = await prisma.user.upsert({ where: { email: `admin-${sufijo}@test.local` }, create: { email: `admin-${sufijo}@test.local`, nombre: "Admin Test", passwordHash: "x", rol: "ADMIN" }, update: {} });
    const o = await prisma.user.upsert({ where: { email: `op-${sufijo}@test.local` }, create: { email: `op-${sufijo}@test.local`, nombre: "Operador Test", passwordHash: "x", rol: "OPERADOR" }, update: {} });
    admin = { id: a.id, email: a.email, nombre: a.nombre, rol: a.rol };
    operador = { id: o.id, email: o.email, nombre: o.nombre, rol: o.rol };
    // Confirma los parámetros 2026 como lo haría un administrador, para obtener un cálculo sin pendientes
    const p = (await cargarCatalogo()).find((x) => x.anio === 2026)!;
    for (const g of ["salariosMinimos", "uma", "tarifaIsr", "exenciones", "subsidio"] as const) p.estatus[g] = "CONFIRMADO";
    await guardarParametros(p, "Test");
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  let id = "";
  let version = 1;

  it("crea un finiquito calculado con folio, revisión original y bitácora", async () => {
    const f = await crearFiniquito(operador, datos(`Trabajador ${sufijo}`), true);
    id = f.id;
    expect(f.estado).toBe("CALCULADO");
    expect(f.folio).toMatch(/^FB-2026-\d{4}$/);
    expect(f.estadoCalculo).toBe("DEFINITIVO");
    expect(f.totalNeto.toString()).toBe("7394.99");
    const revs = await prisma.revision.findMany({ where: { finiquitoId: id } });
    expect(revs).toHaveLength(1);
    expect(revs[0].tipo).toBe("CREACION");
  });

  it("rechaza datos inválidos en el servidor", async () => {
    await expect(crearFiniquito(operador, { ...datos("X"), fechaTerminacion: "2020-01-01" }, false)).rejects.toThrow();
  });

  it("la edición incrementa la versión y conserva el historial", async () => {
    const u = await actualizarFiniquito(operador, id, datos(`Trabajador ${sufijo}`, { sueldos: { diasPendientes: 2 } }), 1, false);
    version = u.version;
    expect(version).toBe(2);
    expect(await prisma.revision.count({ where: { finiquitoId: id } })).toBe(2);
  });

  it("detecta edición concurrente (versión desactualizada)", async () => {
    await expect(actualizarFiniquito(operador, id, datos(`Trabajador ${sufijo}`), 1, false)).rejects.toThrow(/Otro usuario/);
  });

  it("un operador no puede autorizar y no se autoriza sin revisar", async () => {
    await expect(cambiarEstado(operador, id, "AUTORIZAR")).rejects.toThrow();
    await expect(cambiarEstado(admin, id, "AUTORIZAR")).rejects.toThrow(/revisado/);
  });

  it("revisa y autoriza", async () => {
    await cambiarEstado(operador, id, "REVISAR");
    const f = await cambiarEstado(admin, id, "AUTORIZAR");
    expect(f.estado).toBe("AUTORIZADO");
    version = f.version;
  });

  it("NO permite modificar silenciosamente un finiquito autorizado", async () => {
    await expect(actualizarFiniquito(admin, id, datos("Otro nombre"), version, false)).rejects.toThrow(/corrección documentada/);
  });

  it("registra pagos parciales y pasa a PAGADO al liquidar; no admite excesos", async () => {
    const f0 = await prisma.finiquito.findUniqueOrThrow({ where: { id } });
    const neto = Number(f0.totalNeto);
    await registrarPago(admin, id, { monto: 1000, fechaPago: "2026-07-14", forma: "EFECTIVO" });
    await expect(registrarPago(admin, id, { monto: neto, fechaPago: "2026-07-14", forma: "EFECTIVO" })).rejects.toThrow(/excede/);
    const pagoUlt = await registrarPago(admin, id, { monto: Math.round((neto - 1000) * 100) / 100, fechaPago: "2026-07-14", forma: "TRANSFERENCIA", referencia: "SPEI-1" });
    expect((await prisma.finiquito.findUniqueOrThrow({ where: { id } })).estado).toBe("PAGADO");
    // anular reabre el saldo
    await anularPago(admin, id, pagoUlt.id, "Pago registrado por error de captura");
    expect((await prisma.finiquito.findUniqueOrThrow({ where: { id } })).estado).toBe("AUTORIZADO");
  });

  it("operadores no registran pagos", async () => {
    await expect(registrarPago(operador, id, { monto: 1, fechaPago: "2026-07-14", forma: "EFECTIVO" })).rejects.toThrow(/permiso/);
  });

  it("corrección documentada conserva el cálculo original y exige motivo", async () => {
    const f = await prisma.finiquito.findUniqueOrThrow({ where: { id } });
    await expect(corregirFiniquito(admin, id, datos("X"), "corto", f.version)).rejects.toThrow(/motivo/);
    const c = await corregirFiniquito(admin, id, datos(`Trabajador ${sufijo}`, { sueldos: { diasPendientes: 5 } }), "Se omitieron cinco días de sueldo pendientes", f.version);
    expect(c.estado).toBe("CALCULADO");
    const revs = await prisma.revision.findMany({ where: { finiquitoId: id }, orderBy: { version: "asc" } });
    expect(revs.at(-1)?.tipo).toBe("CORRECCION");
    expect(revs.at(-1)?.motivo).toContain("cinco días");
    const original = revs.find((r) => r.tipo === "CREACION")!;
    expect((original.resultado as { totales: { netoAPagar: string } }).totales.netoAPagar).toBe("7394.99");
  });

  it("guarda el parámetro legal usado dentro del resultado (cálculo histórico reproducible)", async () => {
    const f = await prisma.finiquito.findUniqueOrThrow({ where: { id } });
    const r = f.resultado as { parametros: { pago: { anio: number; uma: { valor: string }[] } } };
    expect(r.parametros.pago.anio).toBe(2026);
    expect(r.parametros.pago.uma.some((u) => u.valor === "117.31")).toBe(true);
  });

  it("lista y filtra por trabajador, sucursal y estado", async () => {
    const l = await listarFiniquitos({ q: sufijo });
    expect(l.total).toBeGreaterThanOrEqual(1);
    expect((await listarFiniquitos({ q: sufijo, estado: "PAGADO" })).total).toBe(0);
  });

  it("genera PDF y PNG reales y los registra con huella SHA-256", async () => {
    if (!process.env.CHROMIUM_PATH) return; // requiere Chromium disponible
    const pdf = await generarArchivo(admin, id, "recibo", "pdf");
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
    const png = await generarArchivo(admin, id, "desglose", "png");
    expect(png.body.subarray(1, 4).toString()).toBe("PNG");
    const docs = await prisma.documento.findMany({ where: { finiquitoId: id } });
    expect(docs.every((d) => d.sha256.length === 64)).toBe(true);
  });

  it("la carta de renuncia solo existe si la voluntad fue manifestada", async () => {
    const f = await crearFiniquito(operador, datos(`Sin voluntad ${sufijo}`, { voluntadRenunciaManifestada: false }), false);
    await expect(generarArchivo(admin, f.id, "carta", "html")).rejects.toThrow(/voluntad/);
    const d = await armarDocData(id);
    expect(d.carta?.revisada).toBe(false); // nunca nace como revisada ni firmada
  });
});
