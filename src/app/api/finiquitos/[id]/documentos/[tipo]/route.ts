import { responder } from "@/lib/server/api";
import { HttpError, requerirUsuario } from "@/lib/server/auth";
import { generarArchivo } from "@/lib/server/documentos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string; tipo: string }> }) {
  return responder(async () => {
    const user = await requerirUsuario();
    const { id, tipo } = await params;
    if (!["recibo", "desglose", "carta"].includes(tipo)) throw new HttpError(404, "Documento desconocido");
    const sp = new URL(req.url).searchParams;
    const formato = (sp.get("formato") ?? "pdf").toLowerCase();
    if (!["pdf", "png", "html"].includes(formato)) throw new HttpError(400, "Formato no soportado");
    const a = await generarArchivo(user, id, tipo as "recibo" | "desglose" | "carta", formato as "pdf" | "png" | "html", sp.get("modo") === "impresion" ? "impresion" : "pantalla");
    const inline = sp.get("descargar") !== "1";
    return new Response(new Uint8Array(a.body), {
      headers: {
        "Content-Type": a.contentType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${a.nombre}"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
