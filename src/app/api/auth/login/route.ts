import { z } from "zod";
import { responder } from "@/lib/server/api";
import { iniciarSesion, HttpError } from "@/lib/server/auth";

const Schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  return responder(async () => {
    const { email, password } = Schema.parse(await req.json());
    const r = await iniciarSesion(email, password);
    if (!r.ok) throw new HttpError(401, r.error);
    return { ok: true };
  }, { mutacion: true });
}
