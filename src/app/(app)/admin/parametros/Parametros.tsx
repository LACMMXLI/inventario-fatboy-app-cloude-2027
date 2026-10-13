"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParametrosLegales } from "@/lib/legal/types";
import { Alerta, Field, Input, Money, Num, Select } from "@/components/ui";

const GRUPOS: [keyof ParametrosLegales["estatus"], string][] = [
  ["salariosMinimos", "Salarios mínimos"], ["uma", "UMA"], ["tarifaIsr", "Tarifa ISR art. 96"], ["exenciones", "Criterio de exenciones art. 93"], ["subsidio", "Subsidio para el empleo (aviso)"],
];
const COLOR: Record<string, string> = { OFICIAL: "bg-ok-soft text-ok border-ok", CONFIRMADO: "bg-ok-soft text-ok border-ok", CORROBORADO: "bg-sun-soft text-[#7a5600] border-sun-deep", PENDIENTE: "bg-fire-soft text-fire border-fire" };

export function Parametros({ inicial }: { inicial: ParametrosLegales[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(inicial);
  const [anio, setAnio] = useState(inicial.at(-1)?.anio ?? new Date().getFullYear());
  const p = lista.find((x) => x.anio === anio)!;
  const [msg, setMsg] = useState<{ t: "ok" | "error"; m: string } | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [declaro, setDeclaro] = useState(false);

  const upd = (fn: (x: ParametrosLegales) => ParametrosLegales) => setLista((l) => l.map((x) => (x.anio === anio ? fn(structuredClone(x)) : x)));

  async function guardar() {
    setMsg(null);
    const r = await fetch(`/api/admin/parametros/${anio}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    const j = await r.json();
    setMsg(r.ok ? { t: "ok", m: "Guardado. Los grupos modificados regresaron a PENDIENTE hasta que los confirme." } : { t: "error", m: j.campos?.map((c: { campo: string; mensaje: string }) => `${c.campo}: ${c.mensaje}`).join("; ") ?? j.error });
    if (r.ok) { router.refresh(); const c = await (await fetch("/api/admin/parametros")).json(); setLista(c.ejercicios); }
  }
  async function confirmar() {
    setMsg(null);
    const r = await fetch(`/api/admin/parametros/${anio}/confirmar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grupos: sel, declaro: true }) });
    const j = await r.json();
    setMsg(r.ok ? { t: "ok", m: "Grupos confirmados. Quedó registrado quién y cuándo." } : { t: "error", m: j.error ?? "Error" });
    if (r.ok) { setSel([]); setDeclaro(false); const c = await (await fetch("/api/admin/parametros")).json(); setLista(c.ejercicios); router.refresh(); }
  }
  function nuevoEjercicio() {
    const y = Number(prompt("Ejercicio (año) a crear. Se copiará el más reciente y todos sus grupos quedarán PENDIENTES:", String((lista.at(-1)?.anio ?? 2026) + 1)));
    if (!y || lista.some((x) => x.anio === y)) return;
    const base = structuredClone(lista.at(-1)!);
    base.anio = y;
    base.estatus = { salariosMinimos: "PENDIENTE", uma: "PENDIENTE", tarifaIsr: "PENDIENTE", exenciones: "PENDIENTE", subsidio: "PENDIENTE" };
    base.uma = base.uma.map((u) => ({ ...u, desde: u.desde.replace(/^\d{4}/, String(y)) }));
    base.confirmacion = null;
    base.fuentes = [{ concepto: `Parámetros ${y}`, referencia: "Copiados del ejercicio anterior; actualice con las publicaciones oficiales (CONASAMI, INEGI, Anexo 8 RMF).", estatus: "PENDIENTE" }];
    setLista([...lista, base]);
    setAnio(y);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Parámetros legales por ejercicio</h1>
        <div className="flex gap-2">
          <Select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>{lista.map((x) => <option key={x.anio}>{x.anio}</option>)}</Select>
          <button className="btn btn-ghost" onClick={nuevoEjercicio}>+ Ejercicio</button>
        </div>
      </div>
      <Alerta tipo="warn" titulo="Un resultado solo queda “sin pendientes” si estos parámetros están OFICIAL o CONFIRMADO">
        Contraste cada dato con la publicación oficial (DOF, CONASAMI, INEGI, SAT) antes de confirmarlo. Si modifica un grupo, regresa a PENDIENTE.
      </Alerta>
      {msg && <Alerta tipo={msg.t === "ok" ? "ok" : "error"}>{msg.m}</Alerta>}

      <section className="card">
        <h2 className="mb-2 text-lg font-extrabold">Estatus de validación {anio}</h2>
        <ul className="space-y-2">
          {GRUPOS.map(([k, l]) => (
            <li key={k} className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" className="h-5 w-5 accent-black" disabled={p.estatus[k] === "OFICIAL" || p.estatus[k] === "CONFIRMADO"} checked={sel.includes(k)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))} />
                {l}
              </label>
              <span className={`chip ${COLOR[p.estatus[k]]}`}>{p.estatus[k]}</span>
            </li>
          ))}
        </ul>
        {p.confirmacion && <p className="hint mt-2">Última confirmación: {p.confirmacion.por}, {new Date(p.confirmacion.en).toLocaleString("es-MX", { timeZone: "America/Tijuana" })} ({p.confirmacion.grupos.join(", ")})</p>}
        {sel.length > 0 && (
          <div className="mt-3 space-y-2 rounded-xl bg-fog p-3">
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-black" checked={declaro} onChange={(e) => setDeclaro(e.target.checked)} /> Declaro que contrasté los grupos seleccionados con la publicación oficial vigente.</label>
            <button className="btn btn-primary btn-sm" disabled={!declaro} onClick={confirmar}>Confirmar grupos seleccionados</button>
          </div>
        )}
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-extrabold sm:col-span-2">Salarios mínimos diarios</h2>
        <Field label="Salario mínimo general"><Money value={p.salariosMinimos.general} onChange={(v) => upd((x) => ({ ...x, salariosMinimos: { ...x.salariosMinimos, general: v } }))} /></Field>
        <Field label="Zona Libre de la Frontera Norte (Mexicali)"><Money value={p.salariosMinimos.zlfn} onChange={(v) => upd((x) => ({ ...x, salariosMinimos: { ...x.salariosMinimos, zlfn: v } }))} /></Field>
        <div className="sm:col-span-2">
          <p className="label">Salarios mínimos profesionales (CONASAMI)</p>
          {p.salariosMinimos.profesionales.map((pr, i) => (
            <div key={i} className="mb-2 grid gap-2 sm:grid-cols-4">
              <Input value={pr.ocupacion} placeholder="Ocupación" onChange={(e) => upd((x) => { x.salariosMinimos.profesionales[i].ocupacion = e.target.value; return x; })} className="sm:col-span-2" />
              <Money value={pr.general} onChange={(v) => upd((x) => { x.salariosMinimos.profesionales[i].general = v; return x; })} />
              <Money value={pr.zlfn} onChange={(v) => upd((x) => { x.salariosMinimos.profesionales[i].zlfn = v; return x; })} />
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => upd((x) => ({ ...x, salariosMinimos: { ...x.salariosMinimos, profesionales: [...x.salariosMinimos.profesionales, { clave: String(x.salariosMinimos.profesionales.length + 1), ocupacion: "", general: "0", zlfn: "0" }] } }))}>+ Ocupación</button>
          <p className="hint">Columnas: ocupación, resto del país, ZLFN. La tabla oficial (61 oficios) no se sembró porque no pudo contrastarse; capture las que utilice.</p>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">UMA (valor diario y fecha desde la que rige)</h2>
        {p.uma.map((u, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <Input type="date" value={u.desde} onChange={(e) => upd((x) => { x.uma[i].desde = e.target.value; return x; })} />
            <Money value={u.valor} onChange={(v) => upd((x) => { x.uma[i].valor = v; return x; })} />
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={() => upd((x) => ({ ...x, uma: [...x.uma, { desde: `${anio}-02-01`, valor: "0" }] }))}>+ Vigencia</button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">Criterio de exenciones (art. 93 LISR)</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Base de cálculo"><Select value={p.exenciones.base} onChange={(e) => upd((x) => ({ ...x, exenciones: { ...x.exenciones, base: e.target.value as "UMA" | "SALARIO_MINIMO" } }))}><option value="UMA">UMA (criterio SAT)</option><option value="SALARIO_MINIMO">Salario mínimo (texto literal)</option></Select></Field>
          <Field label="Aguinaldo (veces)"><Num value={String(p.exenciones.aguinaldoDias)} onChange={(v) => upd((x) => ({ ...x, exenciones: { ...x.exenciones, aguinaldoDias: Number(v) } }))} /></Field>
          <Field label="Prima vacacional (veces)"><Num value={String(p.exenciones.primaVacacionalDias)} onChange={(v) => upd((x) => ({ ...x, exenciones: { ...x.exenciones, primaVacacionalDias: Number(v) } }))} /></Field>
          <Field label="Separación (veces por año)"><Num value={String(p.exenciones.separacionDiasPorAnio)} onChange={(v) => upd((x) => ({ ...x, exenciones: { ...x.exenciones, separacionDiasPorAnio: Number(v) } }))} /></Field>
        </div>
        {p.notas && <p className="hint">{p.notas}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">Tarifa mensual ISR (art. 96 LISR – Anexo 8 RMF)</h2>
        {!p.tarifaMensualIsr && <Alerta tipo="error">Sin tarifa capturada: las retenciones de este ejercicio quedan pendientes.</Alerta>}
        <div className="table-wrap">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted"><th>Límite inferior</th><th>Límite superior</th><th>Cuota fija</th><th>% excedente</th></tr></thead>
            <tbody>
              {(p.tarifaMensualIsr ?? []).map((r, i) => (
                <tr key={i}>
                  {(["limiteInferior", "limiteSuperior", "cuotaFija", "porcentaje"] as const).map((c) => (
                    <td key={c} className="p-1"><Input value={r[c] ?? ""} placeholder={c === "limiteSuperior" ? "en adelante" : ""} onChange={(e) => upd((x) => { const row = x.tarifaMensualIsr![i]; (row as Record<string, string | null>)[c] = c === "limiteSuperior" && e.target.value === "" ? null : e.target.value; return x; })} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => upd((x) => ({ ...x, tarifaMensualIsr: [...(x.tarifaMensualIsr ?? []), { limiteInferior: "0", limiteSuperior: null, cuotaFija: "0", porcentaje: "0" }] }))}>+ Renglón</button>
          {p.tarifaMensualIsr && <button className="btn btn-ghost btn-sm" onClick={() => upd((x) => ({ ...x, tarifaMensualIsr: x.tarifaMensualIsr!.slice(0, -1) }))}>− Quitar último</button>}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-extrabold">Fuentes documentadas</h2>
        <ul className="space-y-2 text-sm">
          {p.fuentes.map((f, i) => (
            <li key={i}><span className={`chip mr-2 ${COLOR[f.estatus]}`}>{f.estatus}</span><b>{f.concepto}.</b> {f.referencia} {f.url && <a className="font-bold underline" href={f.url} target="_blank" rel="noreferrer">Abrir fuente</a>}</li>
          ))}
        </ul>
      </section>
      <button className="btn btn-primary" onClick={guardar}>Guardar ejercicio {anio}</button>
    </div>
  );
}
