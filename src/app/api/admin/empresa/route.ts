import { z } from "zod";
import { responder } from "@/lib/server/api";
import { PUEDE, requerirUsuario } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { registrar } from "@/lib/server/bitacora";

const opt = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => (v ? v : null));
const Schema = z.object({
  nombreComercial: z.string().trim().min(1).max(100),
  razonSocial: opt(200),
  rfc: z.string().trim().toUpperCase().regex(/^([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})?$/, "RFC con formato inválido").optional().nullable().transform((v) => (v ? v : null)),
  registroPatronal: opt(30),
  domicilioFiscal: opt(300),
  ciudad: z.string().trim().min(1).max(100),
  estado: z.string().trim().min(1).max(100),
  representanteLegal: z.string().trim().min(3).max(150),
  cargoRepresentante: opt(100),
  telefono: opt(30),
  correo: z.string().email().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  zonaSalarialDefault: z.enum(["ZLFN", "GENERAL"]),
});

export async function GET() {
  return responder(async () => {
    await requerirUsuario();
    return prisma.empresa.upsert({ where: { id: "empresa" }, create: { id: "empresa" }, update: {} });
  });
}

export async function PUT(req: Request) {
  return responder(async () => {
    const user = await requerirUsuario(PUEDE.administrar);
    const data = Schema.parse(await req.json());
    const e = await prisma.$transaction(async (tx) => {
      const r = await tx.empresa.upsert({ where: { id: "empresa" }, create: { id: "empresa", ...data, actualizadoPor: user.nombre }, update: { ...data, actualizadoPor: user.nombre } });
      await registrar(tx, user, "Empresa", "empresa", "ACTUALIZAR", data);
      return r;
    });
    return e;
  }, { mutacion: true });
}
