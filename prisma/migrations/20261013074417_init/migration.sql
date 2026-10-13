-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'AUTORIZADOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "EstadoFiniquito" AS ENUM ('BORRADOR', 'CALCULADO', 'REVISADO', 'AUTORIZADO', 'PAGADO');

-- CreateEnum
CREATE TYPE "TipoRevision" AS ENUM ('CREACION', 'MODIFICACION', 'CAMBIO_ESTADO', 'CORRECCION', 'PAGO', 'ANULACION_PAGO', 'VALIDACION_FISCAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL DEFAULT 'empresa',
    "nombreComercial" TEXT NOT NULL DEFAULT 'Fatboy',
    "razonSocial" TEXT,
    "rfc" TEXT,
    "registroPatronal" TEXT,
    "domicilioFiscal" TEXT,
    "ciudad" TEXT NOT NULL DEFAULT 'Mexicali',
    "estado" TEXT NOT NULL DEFAULT 'Baja California',
    "pais" TEXT NOT NULL DEFAULT 'México',
    "representanteLegal" TEXT NOT NULL DEFAULT 'Joseph Anthony Baez Cárdenas',
    "cargoRepresentante" TEXT DEFAULT 'Representante legal',
    "telefono" TEXT,
    "correo" TEXT,
    "zonaSalarialDefault" TEXT NOT NULL DEFAULT 'ZLFN',
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "actualizadoPor" TEXT,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "domicilio" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroLegal" (
    "anio" INTEGER NOT NULL,
    "datos" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "actualizadoPor" TEXT,

    CONSTRAINT "ParametroLegal_pkey" PRIMARY KEY ("anio")
);

-- CreateTable
CREATE TABLE "Finiquito" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "estado" "EstadoFiniquito" NOT NULL DEFAULT 'BORRADOR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "trabajadorNombre" TEXT NOT NULL,
    "puesto" TEXT NOT NULL,
    "sucursalId" TEXT,
    "sucursalNombre" TEXT NOT NULL,
    "fechaIngreso" DATE NOT NULL,
    "fechaTerminacion" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "resultado" JSONB NOT NULL,
    "estadoCalculo" TEXT NOT NULL,
    "totalBruto" DECIMAL(14,2) NOT NULL,
    "totalRetenciones" DECIMAL(14,2) NOT NULL,
    "totalNeto" DECIMAL(14,2) NOT NULL,
    "validacionManual" JSONB,
    "creadoPorId" TEXT NOT NULL,
    "modificadoPorId" TEXT,
    "revisadoPorId" TEXT,
    "autorizadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "revisadoEn" TIMESTAMP(3),
    "autorizadoEn" TIMESTAMP(3),
    "pagadoEn" TIMESTAMP(3),

    CONSTRAINT "Finiquito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "finiquitoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "tipo" "TipoRevision" NOT NULL,
    "motivo" TEXT,
    "estadoAnterior" "EstadoFiniquito",
    "estadoNuevo" "EstadoFiniquito",
    "datos" JSONB,
    "resultado" JSONB,
    "userId" TEXT NOT NULL,
    "userNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "finiquitoId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fechaPago" DATE NOT NULL,
    "forma" TEXT NOT NULL,
    "referencia" TEXT,
    "notas" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "registradoPorNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anuladoEn" TIMESTAMP(3),
    "anuladoPor" TEXT,
    "motivoAnulacion" TEXT,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "finiquitoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "versionFiniquito" INTEGER NOT NULL,
    "ruta" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "generadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartaRenuncia" (
    "id" TEXT NOT NULL,
    "finiquitoId" TEXT NOT NULL,
    "contenido" JSONB NOT NULL,
    "actualizadoPorId" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartaRenuncia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bitacora" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "accion" TEXT NOT NULL,
    "detalle" JSONB,
    "userId" TEXT,
    "userNombre" TEXT,
    "ip" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folio" (
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Folio_pkey" PRIMARY KEY ("anio")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiraEn_idx" ON "Session"("expiraEn");

-- CreateIndex
CREATE UNIQUE INDEX "Sucursal_nombre_key" ON "Sucursal"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Finiquito_folio_key" ON "Finiquito"("folio");

-- CreateIndex
CREATE INDEX "Finiquito_estado_idx" ON "Finiquito"("estado");

-- CreateIndex
CREATE INDEX "Finiquito_trabajadorNombre_idx" ON "Finiquito"("trabajadorNombre");

-- CreateIndex
CREATE INDEX "Finiquito_fechaTerminacion_idx" ON "Finiquito"("fechaTerminacion");

-- CreateIndex
CREATE INDEX "Finiquito_sucursalId_idx" ON "Finiquito"("sucursalId");

-- CreateIndex
CREATE INDEX "Revision_finiquitoId_creadoEn_idx" ON "Revision"("finiquitoId", "creadoEn");

-- CreateIndex
CREATE INDEX "Pago_finiquitoId_idx" ON "Pago"("finiquitoId");

-- CreateIndex
CREATE INDEX "Documento_finiquitoId_idx" ON "Documento"("finiquitoId");

-- CreateIndex
CREATE UNIQUE INDEX "CartaRenuncia_finiquitoId_key" ON "CartaRenuncia"("finiquitoId");

-- CreateIndex
CREATE INDEX "Bitacora_entidad_entidadId_idx" ON "Bitacora"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Bitacora_creadoEn_idx" ON "Bitacora"("creadoEn");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finiquito" ADD CONSTRAINT "Finiquito_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_finiquitoId_fkey" FOREIGN KEY ("finiquitoId") REFERENCES "Finiquito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_finiquitoId_fkey" FOREIGN KEY ("finiquitoId") REFERENCES "Finiquito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_finiquitoId_fkey" FOREIGN KEY ("finiquitoId") REFERENCES "Finiquito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartaRenuncia" ADD CONSTRAINT "CartaRenuncia_finiquitoId_fkey" FOREIGN KEY ("finiquitoId") REFERENCES "Finiquito"("id") ON DELETE CASCADE ON UPDATE CASCADE;
