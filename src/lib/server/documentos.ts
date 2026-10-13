import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer, { type Browser } from "puppeteer-core";
import { createElement } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { env } from "../env";
import { HttpError, type SessionUser } from "./auth";
import { Documento, TITULOS } from "@/components/documentos";
import { DOC_CSS, DOC_CSS_PRINT } from "@/components/documentos/estilos";
import { cartaPorDefecto } from "@/components/documentos/Carta";
import type { CartaContenido, DocData, EmpresaDoc, TipoDocumento } from "@/components/documentos/tipos";
import type { FiniquitoInput } from "../finiquito/schema";
import type { ResultadoFiniquito } from "../finiquito/types";
import { hoyISO } from "../fechas";
import { s2 } from "../money";
import { registrar } from "./bitacora";

export async function obtenerEmpresaDoc(): Promise<EmpresaDoc> {
  const e = await prisma.empresa.upsert({ where: { id: "empresa" }, create: { id: "empresa" }, update: {} });
  return {
    nombreComercial: e.nombreComercial,
    razonSocial: e.razonSocial,
    rfc: e.rfc,
    registroPatronal: e.registroPatronal,
    domicilioFiscal: e.domicilioFiscal,
    ciudad: e.ciudad,
    estado: e.estado,
    pais: e.pais,
    representanteLegal: e.representanteLegal,
    cargoRepresentante: e.cargoRepresentante,
  };
}

export async function armarDocData(finiquitoId: string, opts: { carta?: boolean } = {}): Promise<DocData> {
  const f = await prisma.finiquito.findUnique({
    where: { id: finiquitoId },
    include: { pagos: { where: { anuladoEn: null }, orderBy: { fechaPago: "asc" } }, carta: true, revisiones: { orderBy: { creadoEn: "asc" } } },
  });
  if (!f) throw new HttpError(404, "Finiquito no encontrado");
  const empresa = await obtenerEmpresaDoc();
  const autorizador = f.autorizadoPorId ? await prisma.user.findUnique({ where: { id: f.autorizadoPorId }, select: { nombre: true } }) : null;
  const datos = f.datos as unknown as FiniquitoInput;
  const d: DocData = {
    empresa,
    folio: f.folio,
    version: f.version,
    estadoInterno: f.estado,
    datos,
    resultado: f.resultado as unknown as ResultadoFiniquito,
    pagos: f.pagos.map((p) => ({ fechaPago: p.fechaPago.toISOString().slice(0, 10), monto: s2(p.monto.toString()), forma: p.forma, referencia: p.referencia })),
    fechaGeneracion: hoyISO(env.timezone),
    autorizadoPor: autorizador?.nombre ?? null,
    historial: f.revisiones.map((r) => ({ version: r.version, tipo: r.tipo, motivo: r.motivo, usuario: r.userNombre, fecha: r.creadoEn.toISOString() })),
  };
  if (opts.carta !== false) {
    d.carta = f.carta ? (f.carta.contenido as unknown as CartaContenido) : cartaPorDefecto(d);
  }
  return d;
}

/** La carta solo puede generarse si el motivo es renuncia voluntaria y la voluntad fue manifestada. */
export function validarCarta(d: DocData) {
  if (d.datos.motivo !== "RENUNCIA_VOLUNTARIA") throw new HttpError(409, "La carta de renuncia solo aplica cuando el motivo es renuncia voluntaria.");
  if (!d.datos.voluntadRenunciaManifestada) throw new HttpError(409, "Para generar la carta, confirme en el finiquito que el trabajador manifestó su voluntad de renunciar.");
}

export async function htmlDocumento(tipo: TipoDocumento, d: DocData, modo: "pantalla" | "impresion" = "impresion"): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(createElement(Documento, { tipo, d }));
  const css = DOC_CSS + (modo === "impresion" ? DOC_CSS_PRINT : "");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${TITULOS[tipo]}${d.folio ? " " + d.folio : ""}</title><style>${css}</style></head><body>${body}</body></html>`;
}

let browserP: Promise<Browser> | null = null;
async function navegador(): Promise<Browser> {
  if (browserP) {
    try {
      const b = await browserP;
      if (b.connected) return b;
    } catch {
      /* se relanza abajo */
    }
    browserP = null;
  }
  browserP = puppeteer.launch({
    executablePath: env.chromiumPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--font-render-hinting=none"],
  });
  return browserP;
}

export async function htmlAPdf(html: string, etiquetaPie: string): Promise<Buffer> {
  const b = await navegador();
  const page = await b.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:7px;color:#666;padding:0 .6in;display:flex;justify-content:space-between;font-family:Arial,sans-serif"><span>${etiquetaPie.replace(/[<>&]/g, "")}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function htmlAPng(html: string): Promise<Buffer> {
  const b = await navegador();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("screen");
    await page.addStyleTag({ content: ".fb-solo-pantalla{display:none!important}body{margin:0;background:#fff}" });
    const png = await page.screenshot({ type: "png", fullPage: true });
    return Buffer.from(png);
  } finally {
    await page.close();
  }
}

export type FormatoDoc = "pdf" | "png" | "html";

export async function generarArchivo(user: SessionUser, finiquitoId: string, tipo: TipoDocumento, formato: FormatoDoc, modoHtml: "pantalla" | "impresion" = "pantalla") {
  const d = await armarDocData(finiquitoId);
  if (tipo === "carta") validarCarta(d);
  if (formato === "html") return { contentType: "text/html; charset=utf-8", body: Buffer.from(await htmlDocumento(tipo, d, modoHtml)), nombre: `${tipo}.html` };

  // Para PNG usamos estilos de pantalla (hoja 8.5in) y para PDF los de impresión (@page)
  const html = await htmlDocumento(tipo, d, formato === "pdf" ? "impresion" : "pantalla");
  const etiqueta = `${d.empresa.nombreComercial} · ${TITULOS[tipo]}${d.folio ? " · " + d.folio : ""}`;
  const body = formato === "pdf" ? await htmlAPdf(html, etiqueta) : await htmlAPng(html);

  // Conservar copia en el volumen persistente con huella SHA-256
  const sha = crypto.createHash("sha256").update(body).digest("hex");
  const dir = path.join(env.documentsDir, finiquitoId);
  await fs.mkdir(dir, { recursive: true });
  const nombre = `${(d.folio ?? finiquitoId).replace(/[^A-Za-z0-9_-]/g, "")}_${tipo}_v${d.version}_${sha.slice(0, 8)}.${formato}`;
  const ruta = path.join(dir, nombre);
  try {
    await fs.access(ruta);
  } catch {
    await fs.writeFile(ruta, body);
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.documento.create({
        data: { finiquitoId, tipo: tipo.toUpperCase(), formato: formato.toUpperCase(), versionFiniquito: d.version ?? 0, ruta: path.relative(env.documentsDir, ruta), sha256: sha, bytes: body.length, generadoPorId: user.id },
      });
      await registrar(tx, user, "Documento", finiquitoId, "GENERAR", { tipo, formato, sha256: sha, version: d.version });
    });
  }
  return { contentType: formato === "pdf" ? "application/pdf" : "image/png", body, nombre };
}
