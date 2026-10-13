import { responder } from "@/lib/server/api";
import { cerrarSesion } from "@/lib/server/auth";

export async function POST() {
  return responder(async () => {
    await cerrarSesion();
    return { ok: true };
  }, { mutacion: true });
}
