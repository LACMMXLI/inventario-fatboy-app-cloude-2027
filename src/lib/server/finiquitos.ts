import type { EstadoFiniquito, Prisma, TipoRevision } from "@prisma/client";
import { prisma } from "./db";
import { HttpError, PUEDE, type SessionUser } from "./auth";
import { cargarCatalogo } from "./parametros";
import { registrar } from "./bitacora";
import { calcularFiniquito } from "../finiquito/engine";
import { FiniquitoInputSchema, type FiniquitoInput } from "../finiquito/schema";
import type { ResultadoFiniquito } from "../finiquito/types";
import { D, s2 } from "../money";

const EDITABLES: EstadoFiniquito[] = ["BORRADOR", "CALCULADO", "REVISADO"];
const BLOQUEADOS: EstadoFiniquito[] = ["AUTORIZADO", "PAGADO"];

export type AccionEstado = "CALCULAR" | "REVISAR" | "AUTORIZAR" | "DEVOLVER";

async function calcular(datosRaw: unknown): Promise<{ datos: FiniquitoInput; resultado: ResultadoFiniquito }> {
  const datos = FiniquitoInputSchema.parse(datosRaw);
  const resultado = calcularFiniquito(datos, await cargarCatalogo());
  return { datos, resultado };
}

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const json = (v: unknown) => v as Prisma.InputJsonValue;

async function siguienteFolio(tx: Prisma.TransactionClient, anio: number): Promise<string> {
  const f = await tx.folio.upsert({ where: { anio }, create: { anio, ultimo: 1 }, update: { ultimo: { increment: 1 } } });
  return `FB-${anio}-${String(f.ultimo).padStart(4, "0")}`;
}

function columnas(datos: FiniquitoInput, r: ResultadoFiniquito) {
  return {
    trabajadorNombre: datos.trabajador.nombre,
    puesto: datos.trabajador.puesto,
    sucursalNombre: datos.trabajador.sucursal,
    sucursalId: datos.trabajador.sucursalId || null,
    fechaIngreso: toDate(datos.fechaIngreso),
    fechaTerminacion: toDate(datos.fechaTerminacion),
    motivo: datos.motivo,
    datos: json(datos),
    resultado: json(r),
    estadoCalculo: r.estado,
    totalBruto: r.totales.saldoBruto,
    totalRetenciones: r.totales.retenciones,
    totalNeto: r.totales.netoAPagar,
  };
}

export async function crearFiniquito(user: SessionUser, datosRaw: unknown, calcularYa: boolean) {
  const { datos, resultado } = await calcular(datosRaw);
  if (calcularYa && resultado.estado === "INCOMPLETO") {
    throw new HttpError(422, "El cálculo está incompleto. Resuelva los pendientes bloqueantes o guárdelo como borrador.", resultado.pendientes);
  }
  const estado: EstadoFiniquito = calcularYa ? "CALCULADO" : "BORRADOR";
  return prisma.$transaction(async (tx) => {
    const folio = await siguienteFolio(tx, Number(datos.fechaTerminacion.slice(0, 4)) || new Date().getFullYear());
    const f = await tx.finiquito.create({
      data: { folio, estado, version: 1, creadoPorId: user.id, ...columnas(datos, resultado) },
    });
    await tx.revision.create({
      data: { finiquitoId: f.id, version: 1, tipo: "CREACION", estadoNuevo: estado, datos: json(datos), resultado: json(resultado), userId: user.id, userNombre: user.nombre, motivo: "Cálculo original" },
    });
    await registrar(tx, user, "Finiquito", f.id, "CREAR", { folio, estado });
    return f;
  });
}

export async function actualizarFiniquito(user: SessionUser, id: string, datosRaw: unknown, versionEsperada: number, calcularYa: boolean) {
  const { datos, resultado } = await calcular(datosRaw);
  return prisma.$transaction(async (tx) => {
    const [actual] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Finiquito" WHERE id = ${id} FOR UPDATE`;
    if (!actual) throw new HttpError(404, "Finiquito no encontrado");
    const f = await tx.finiquito.findUniqueOrThrow({ where: { id } });
    if (BLOQUEADOS.includes(f.estado)) {
      throw new HttpError(409, "Un finiquito autorizado o pagado no se puede modificar. Use una corrección documentada.");
    }
    if (f.version !== versionEsperada) throw new HttpError(409, "Otro usuario modificó este finiquito. Recargue la página.");
    let estado: EstadoFiniquito = f.estado;
    if (f.estado === "REVISADO") estado = "CALCULADO"; // un cambio invalida la revisión
    if (calcularYa && f.estado === "BORRADOR") {
      if (resultado.estado === "INCOMPLETO") throw new HttpError(422, "El cálculo está incompleto.", resultado.pendientes);
      estado = "CALCULADO";
    }
    const version = f.version + 1;
    const u = await tx.finiquito.update({
      where: { id },
      data: { ...columnas(datos, resultado), estado, version, modificadoPorId: user.id, revisadoPorId: null, revisadoEn: null, validacionManual: undefined },
    });
    await tx.revision.create({
      data: { finiquitoId: id, version, tipo: "MODIFICACION", estadoAnterior: f.estado, estadoNuevo: estado, datos: json(datos), resultado: json(resultado), userId: user.id, userNombre: user.nombre },
    });
    await registrar(tx, user, "Finiquito", id, "MODIFICAR", { version, estado });
    return u;
  });
}

export async function cambiarEstado(user: SessionUser, id: string, accion: AccionEstado, nota?: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Finiquito" WHERE id = ${id} FOR UPDATE`;
    const f = await tx.finiquito.findUnique({ where: { id } });
    if (!f) throw new HttpError(404, "Finiquito no encontrado");
    const r = f.resultado as unknown as ResultadoFiniquito;
    let nuevo: EstadoFiniquito;
    const data: Prisma.FiniquitoUncheckedUpdateInput = {};
    let tipo: TipoRevision = "CAMBIO_ESTADO";
    let validacion: Prisma.InputJsonValue | undefined;

    switch (accion) {
      case "CALCULAR":
        if (f.estado !== "BORRADOR") throw new HttpError(409, "Solo un borrador puede pasar a calculado.");
        if (r.estado === "INCOMPLETO") throw new HttpError(422, "El cálculo está incompleto.", r.pendientes);
        nuevo = "CALCULADO";
        break;
      case "REVISAR":
        if (f.estado !== "CALCULADO") throw new HttpError(409, "Solo un cálculo en estado 'calculado' puede marcarse como revisado.");
        if (!PUEDE.revisar.includes(user.rol)) throw new HttpError(403, "Sin permiso para revisar");
        nuevo = "REVISADO";
        data.revisadoPorId = user.id;
        data.revisadoEn = new Date();
        break;
      case "AUTORIZAR":
        if (f.estado !== "REVISADO") throw new HttpError(409, "Debe estar revisado antes de autorizarse.");
        if (!PUEDE.autorizar.includes(user.rol)) throw new HttpError(403, "Sin permiso para autorizar");
        if (r.estado === "INCOMPLETO") throw new HttpError(422, "No puede autorizarse un cálculo incompleto.", r.pendientes);
        if (r.estado === "PROVISIONAL") {
          if (!nota || nota.trim().length < 20) {
            throw new HttpError(422, "El cálculo es PROVISIONAL (pendiente de validación fiscal/jurídica). Para autorizarlo describa (mín. 20 caracteres) quién y cómo validó los pendientes.", r.pendientes);
          }
          validacion = { por: user.nombre, porId: user.id, en: new Date().toISOString(), nota: nota.trim(), pendientes: r.pendientes.map((p) => p.mensaje) };
          data.validacionManual = validacion;
          tipo = "VALIDACION_FISCAL";
        }
        nuevo = "AUTORIZADO";
        data.autorizadoPorId = user.id;
        data.autorizadoEn = new Date();
        break;
      case "DEVOLVER":
        if (f.estado === "REVISADO") nuevo = "CALCULADO";
        else if (f.estado === "CALCULADO") nuevo = "BORRADOR";
        else throw new HttpError(409, "Un finiquito autorizado o pagado solo puede cambiar mediante una corrección documentada.");
        if (!nota || nota.trim().length < 5) throw new HttpError(422, "Indique el motivo de la devolución.");
        data.revisadoPorId = null;
        data.revisadoEn = null;
        break;
      default:
        throw new HttpError(400, "Acción desconocida");
    }
    const version = f.version + 1;
    const u = await tx.finiquito.update({ where: { id }, data: { ...data, estado: nuevo, version, modificadoPorId: user.id } });
    await tx.revision.create({
      data: { finiquitoId: id, version, tipo, motivo: nota?.trim() || null, estadoAnterior: f.estado, estadoNuevo: nuevo, userId: user.id, userNombre: user.nombre, datos: json(f.datos), resultado: json(f.resultado) },
    });
    await registrar(tx, user, "Finiquito", id, accion, { de: f.estado, a: nuevo, nota });
    return u;
  });
}

/** Corrección documentada de un finiquito autorizado/pagado: conserva el cálculo anterior en el historial. */
export async function corregirFiniquito(user: SessionUser, id: string, datosRaw: unknown, motivo: string, versionEsperada: number) {
  if (!PUEDE.corregir.includes(user.rol)) throw new HttpError(403, "Solo un autorizador o administrador puede corregir un finiquito autorizado.");
  if (!motivo || motivo.trim().length < 15) throw new HttpError(422, "Describa el motivo de la corrección (mínimo 15 caracteres).");
  const { datos, resultado } = await calcular(datosRaw);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Finiquito" WHERE id = ${id} FOR UPDATE`;
    const f = await tx.finiquito.findUnique({ where: { id } });
    if (!f) throw new HttpError(404, "Finiquito no encontrado");
    if (!BLOQUEADOS.includes(f.estado)) throw new HttpError(409, "Solo se corrigen finiquitos autorizados o pagados; los demás se editan directamente.");
    if (f.version !== versionEsperada) throw new HttpError(409, "El finiquito cambió. Recargue la página.");
    const version = f.version + 1;
    const u = await tx.finiquito.update({
      where: { id },
      data: {
        ...columnas(datos, resultado),
        estado: "CALCULADO",
        version,
        modificadoPorId: user.id,
        revisadoPorId: null,
        revisadoEn: null,
        autorizadoPorId: null,
        autorizadoEn: null,
        pagadoEn: null,
        validacionManual: undefined,
      },
    });
    await tx.revision.create({
      data: { finiquitoId: id, version, tipo: "CORRECCION", motivo: motivo.trim(), estadoAnterior: f.estado, estadoNuevo: "CALCULADO", datos: json(datos), resultado: json(resultado), userId: user.id, userNombre: user.nombre },
    });
    await registrar(tx, user, "Finiquito", id, "CORREGIR", { motivo, estadoAnterior: f.estado, netoAnterior: f.totalNeto.toString(), netoNuevo: resultado.totales.netoAPagar });
    return u;
  });
}

export async function totalPagado(tx: Prisma.TransactionClient | typeof prisma, finiquitoId: string) {
  const agg = await tx.pago.aggregate({ where: { finiquitoId, anuladoEn: null }, _sum: { monto: true } });
  return D(agg._sum.monto?.toString() ?? 0);
}

export interface PagoInput {
  monto: number;
  fechaPago: string;
  forma: "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "OTRO";
  referencia?: string | null;
  notas?: string | null;
}

export async function registrarPago(user: SessionUser, id: string, p: PagoInput) {
  if (!PUEDE.pagar.includes(user.rol)) throw new HttpError(403, "Sin permiso para registrar pagos");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Finiquito" WHERE id = ${id} FOR UPDATE`;
    const f = await tx.finiquito.findUnique({ where: { id } });
    if (!f) throw new HttpError(404, "Finiquito no encontrado");
    if (f.estado !== "AUTORIZADO") throw new HttpError(409, "Solo se registran pagos en finiquitos autorizados.");
    const monto = D(p.monto);
    if (monto.lte(0)) throw new HttpError(422, "El monto debe ser mayor a cero.");
    const pagado = await totalPagado(tx, id);
    const neto = D(f.totalNeto.toString());
    const saldo = neto.minus(pagado);
    if (monto.gt(saldo)) throw new HttpError(422, `El pago ($${s2(monto)}) excede el saldo pendiente ($${s2(saldo)}).`);
    const hoy = new Date().toISOString().slice(0, 10);
    if (p.fechaPago > hoy) throw new HttpError(422, "La fecha de pago no puede ser futura.");
    const pago = await tx.pago.create({
      data: { finiquitoId: id, monto: s2(monto), fechaPago: toDate(p.fechaPago), forma: p.forma, referencia: p.referencia || null, notas: p.notas || null, registradoPorId: user.id, registradoPorNombre: user.nombre },
    });
    const nuevoSaldo = saldo.minus(monto);
    const version = f.version + 1;
    const liquidado = nuevoSaldo.lte(0);
    await tx.finiquito.update({
      where: { id },
      data: { version, modificadoPorId: user.id, ...(liquidado ? { estado: "PAGADO", pagadoEn: toDate(p.fechaPago) } : {}) },
    });
    await tx.revision.create({
      data: {
        finiquitoId: id,
        version,
        tipo: "PAGO",
        motivo: `Pago de $${s2(monto)} (${p.forma}) el ${p.fechaPago}${p.referencia ? `, ref. ${p.referencia}` : ""}. Saldo: $${s2(nuevoSaldo)}`,
        estadoAnterior: f.estado,
        estadoNuevo: liquidado ? "PAGADO" : f.estado,
        userId: user.id,
        userNombre: user.nombre,
      },
    });
    await registrar(tx, user, "Pago", pago.id, "REGISTRAR", { finiquitoId: id, monto: s2(monto), saldo: s2(nuevoSaldo) });
    return pago;
  });
}

export async function anularPago(user: SessionUser, id: string, pagoId: string, motivo: string) {
  if (!PUEDE.pagar.includes(user.rol)) throw new HttpError(403, "Sin permiso");
  if (!motivo || motivo.trim().length < 10) throw new HttpError(422, "Describa el motivo de la anulación (mínimo 10 caracteres).");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Finiquito" WHERE id = ${id} FOR UPDATE`;
    const f = await tx.finiquito.findUnique({ where: { id } });
    const pago = await tx.pago.findFirst({ where: { id: pagoId, finiquitoId: id } });
    if (!f || !pago) throw new HttpError(404, "No encontrado");
    if (pago.anuladoEn) throw new HttpError(409, "El pago ya fue anulado.");
    await tx.pago.update({ where: { id: pagoId }, data: { anuladoEn: new Date(), anuladoPor: user.nombre, motivoAnulacion: motivo.trim() } });
    const version = f.version + 1;
    const estado: EstadoFiniquito = f.estado === "PAGADO" ? "AUTORIZADO" : f.estado;
    await tx.finiquito.update({ where: { id }, data: { version, estado, pagadoEn: null, modificadoPorId: user.id } });
    await tx.revision.create({
      data: { finiquitoId: id, version, tipo: "ANULACION_PAGO", motivo: `Se anuló el pago de $${pago.monto.toString()}: ${motivo.trim()}`, estadoAnterior: f.estado, estadoNuevo: estado, userId: user.id, userNombre: user.nombre },
    });
    await registrar(tx, user, "Pago", pagoId, "ANULAR", { finiquitoId: id, motivo });
  });
}

export interface FiltrosListado {
  q?: string;
  sucursalId?: string;
  estado?: EstadoFiniquito;
  desde?: string;
  hasta?: string;
  pagina?: number;
  porPagina?: number;
}

export async function listarFiniquitos(f: FiltrosListado) {
  const where: Prisma.FiniquitoWhereInput = {};
  if (f.q) where.OR = [{ trabajadorNombre: { contains: f.q, mode: "insensitive" } }, { folio: { contains: f.q, mode: "insensitive" } }, { puesto: { contains: f.q, mode: "insensitive" } }];
  if (f.sucursalId) where.sucursalId = f.sucursalId;
  if (f.estado) where.estado = f.estado;
  if (f.desde || f.hasta) {
    where.fechaTerminacion = { ...(f.desde ? { gte: toDate(f.desde) } : {}), ...(f.hasta ? { lte: toDate(f.hasta) } : {}) };
  }
  const porPagina = Math.min(f.porPagina ?? 20, 100);
  const pagina = Math.max(f.pagina ?? 1, 1);
  const [items, total] = await Promise.all([
    prisma.finiquito.findMany({
      where,
      orderBy: { creadoEn: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: { id: true, folio: true, estado: true, estadoCalculo: true, trabajadorNombre: true, puesto: true, sucursalNombre: true, fechaTerminacion: true, motivo: true, totalNeto: true, creadoEn: true, version: true },
    }),
    prisma.finiquito.count({ where }),
  ]);
  return { items, total, pagina, porPagina };
}
