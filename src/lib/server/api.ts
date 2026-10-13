import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError, verificarOrigen } from "./auth";
import { ErrorCalculo } from "../finiquito/engine";

type Handler = () => Promise<Response | object>;

/** Envuelve un handler de ruta con manejo uniforme de errores (nunca filtra trazas al cliente). */
export async function responder(fn: Handler, opts: { mutacion?: boolean } = {}): Promise<Response> {
  try {
    if (opts.mutacion) await verificarOrigen();
    const r = await fn();
    return r instanceof Response ? r : NextResponse.json(r);
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message, detalle: e.detalle }, { status: e.status });
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", campos: e.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })) },
        { status: 422 },
      );
    }
    if (e instanceof ErrorCalculo) return NextResponse.json({ error: e.message, codigo: e.codigo }, { status: 422 });
    console.error("[api] error no controlado:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
