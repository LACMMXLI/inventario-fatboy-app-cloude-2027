"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MOTIVOS, MOTIVO_LABEL, TIPO_DEDUCCION_LABEL, TIPOS_DEDUCCION } from "@/lib/finiquito/schema";
import type { FiniquitoInput } from "@/lib/finiquito/schema";
import type { ResultadoFiniquito } from "@/lib/finiquito/types";
import { money } from "@/lib/money";
import { Alerta, Field, Input, Money, Num, Select, Seccion, Textarea, Toggle } from "@/components/ui";
import { ResultView } from "./ResultView";
import { HojaPreview } from "@/components/documentos/HojaPreview";
import { cartaPorDefecto } from "@/components/documentos/Carta";
import type { DocData, TipoDocumento } from "@/components/documentos/tipos";
import type { Meta } from "@/lib/server/meta";
import { formAPayload, formInicial, pasoDeCampo, datosAForm, type FormState } from "./form";

const PASOS = ["Empleado", "Salario", "Prestaciones y pagos", "Resultado", "Documentos"];

type Errores = Record<string, string>;
interface Inicial { id: string; version: number; estado: string; datos: FiniquitoInput }

export function Asistente({ meta, hoy, inicial }: { meta: Meta; hoy: string; inicial?: Inicial }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => (inicial ? datosAForm(inicial.datos) : formInicial(hoy, meta.zonaDefault)));
  const [paso, setPaso] = useState(1);
  const [alcanzado, setAlcanzado] = useState(1);
  const [intentado, setIntentado] = useState<Record<number, boolean>>({});
  const [resultado, setResultado] = useState<ResultadoFiniquito | null>(null);
  const [datosParsed, setDatosParsed] = useState<FiniquitoInput | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [docTipo, setDocTipo] = useState<TipoDocumento>("recibo");
  const seq = useRef(0);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  // ── Cálculo automático en el servidor ante cualquier cambio (con retardo para no saturar) ──
  const payload = useMemo(() => formAPayload(f), [f]);
  const payloadKey = JSON.stringify(payload);
  useEffect(() => {
    const mi = ++seq.current;
    setCalculando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/calculo", { method: "POST", headers: { "Content-Type": "application/json" }, body: payloadKey });
        const j = await r.json();
        if (mi !== seq.current) return;
        if (r.ok) {
          setResultado(j.resultado);
          setDatosParsed(j.datos);
          setErrores({});
          setErrorGeneral(null);
        } else if (r.status === 422 && j.campos) {
          const e: Errores = {};
          for (const c of j.campos as { campo: string; mensaje: string }[]) e[c.campo] = e[c.campo] ?? c.mensaje;
          setErrores(e);
          setResultado(null);
          setErrorGeneral(null);
        } else {
          setResultado(null);
          setErrorGeneral(j.error ?? "No se pudo calcular");
        }
      } catch {
        if (mi === seq.current) setErrorGeneral("Sin conexión con el servidor");
      } finally {
        if (mi === seq.current) setCalculando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [payloadKey]);

  const erroresPaso = (p: number) => Object.entries(errores).filter(([c]) => pasoDeCampo(c) === p);
  const err = (campo: string) => (intentado[pasoDeCampo(campo)] ? errores[campo] : undefined);

  function siguiente() {
    if (paso <= 3) {
      setIntentado((x) => ({ ...x, [paso]: true }));
      if (erroresPaso(paso).length) return;
    }
    const n = Math.min(5, paso + 1);
    setPaso(n);
    setAlcanzado((a) => Math.max(a, n));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const irA = (p: number) => {
    if (p <= alcanzado) {
      setPaso(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  async function guardar(calcular: boolean) {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const url = inicial ? `/api/finiquitos/${inicial.id}` : "/api/finiquitos";
      const r = await fetch(url, {
        method: inicial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datos: payload, calcular, version: inicial?.version }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErrorGuardar(j.error ?? "No se pudo guardar");
        return;
      }
      router.push(`/finiquitos/${inicial?.id ?? j.id}`);
      router.refresh();
    } catch {
      setErrorGuardar("Sin conexión con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  const anioTerm = Number(f.fechaTerminacion.slice(0, 4)) || new Date().getFullYear();
  const ejercicio = meta.ejercicios.find((e) => e.anio === anioTerm) ?? [...meta.ejercicios].sort((a, b) => b.anio - a.anio).find((e) => e.anio < anioTerm);
  const smZona = ejercicio ? (f.zona === "ZLFN" ? ejercicio.salarioMinimoZlfn : ejercicio.salarioMinimoGeneral) : null;
  const motivoDespido = f.motivo === "DESPIDO_INJUSTIFICADO" || f.motivo === "RESCISION_IMPUTABLE_PATRON";
  const pend = (prefijo: string) => resultado?.pendientes.filter((p) => p.campo?.startsWith(prefijo)) ?? [];

  const docData: DocData | null = useMemo(() => {
    if (!resultado || !datosParsed) return null;
    const base: DocData = { empresa: meta.empresa, folio: null, version: null, estadoInterno: "SIN_GUARDAR", datos: datosParsed, resultado, pagos: [], fechaGeneracion: hoy };
    return { ...base, carta: cartaPorDefecto(base) };
  }, [resultado, datosParsed, meta.empresa, hoy]);

  const editandoBloqueado = inicial && ["AUTORIZADO", "PAGADO"].includes(inicial.estado);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-black">{inicial ? "Editar cálculo" : "Nuevo cálculo de finiquito"}</h1>
        {calculando ? <span className="text-xs font-bold text-muted">Calculando…</span> : <span className="text-xs font-bold text-ok">Actualizado</span>}
      </div>

      {/* Progreso */}
      <ol className="no-print grid grid-cols-5 gap-1 sm:gap-2">
        {PASOS.map((n, i) => {
          const num = i + 1;
          const activo = num === paso;
          const hecho = num < paso;
          return (
            <li key={n}>
              <button onClick={() => irA(num)} disabled={num > alcanzado} className={`w-full rounded-xl border-2 px-1 py-2 text-center text-[11px] font-bold leading-tight sm:text-sm ${activo ? "border-ink bg-sun" : hecho ? "border-ink bg-white" : "border-line bg-white text-muted"}`}>
                <span className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${activo ? "bg-ink text-sun" : hecho ? "bg-ink text-white" : "bg-fog"}`}>{hecho ? "✓" : num}</span>
                <span className="hidden sm:inline">{n}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-center text-sm font-bold sm:hidden">{PASOS[paso - 1]}</p>

      {editandoBloqueado ? <Alerta tipo="warn" titulo="Finiquito autorizado o pagado">Esta captura es una corrección: al guardar deberá indicar el motivo y el finiquito volverá a estado “calculado”. El cálculo anterior se conserva en el historial.</Alerta> : null}
      {errorGeneral ? <Alerta tipo="error" titulo="No se pudo calcular">{errorGeneral}</Alerta> : null}

      {/* ───────── Paso 1: Empleado ───────── */}
      {paso === 1 && (
        <div className="space-y-4">
          <section className="card grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo del trabajador" error={err("trabajador.nombre")} className="sm:col-span-2">
              <Input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} error={!!err("trabajador.nombre")} autoComplete="off" placeholder="Como aparece en su alta" />
            </Field>
            <Field label="Puesto" error={err("trabajador.puesto")}>
              <Input value={f.puesto} onChange={(e) => set("puesto", e.target.value)} error={!!err("trabajador.puesto")} placeholder="Ej. Cocinero, Cajero" />
            </Field>
            <Field label="Sucursal" error={err("trabajador.sucursal")}>
              <Select value={f.sucursalId} error={!!err("trabajador.sucursal")} onChange={(e) => { const s = meta.sucursales.find((x) => x.id === e.target.value); setF((p) => ({ ...p, sucursalId: e.target.value, sucursal: s?.nombre ?? "" })); }}>
                <option value="">Seleccione…</option>
                {meta.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Select>
            </Field>
            <Field label="Fecha de ingreso" error={err("fechaIngreso")} hint="Primer día de trabajo">
              <Input type="date" value={f.fechaIngreso} max={hoy} onChange={(e) => set("fechaIngreso", e.target.value)} error={!!err("fechaIngreso")} />
            </Field>
            <Field label="Fecha de terminación" error={err("fechaTerminacion")} hint="Último día de la relación laboral">
              <Input type="date" value={f.fechaTerminacion} onChange={(e) => set("fechaTerminacion", e.target.value)} error={!!err("fechaTerminacion")} />
            </Field>
            <Field label="Motivo de separación" className="sm:col-span-2">
              <Select value={f.motivo} onChange={(e) => set("motivo", e.target.value)}>
                {MOTIVOS.map((m) => <option key={m} value={m}>{MOTIVO_LABEL[m]}</option>)}
              </Select>
            </Field>
            {f.motivo === "RENUNCIA_VOLUNTARIA" && (
              <div className="sm:col-span-2">
                <Toggle checked={f.voluntadRenuncia} onChange={(v) => set("voluntadRenuncia", v)} label="El trabajador manifestó por sí mismo su voluntad de renunciar" hint="Solo si es cierto. Habilita la carta de renuncia para su revisión (nunca se genera firmada)." />
              </div>
            )}
            {["DESPIDO_JUSTIFICADO", "DESPIDO_INJUSTIFICADO", "RESCISION_IMPUTABLE_PATRON", "FALLECIMIENTO", "OTRA_CAUSA", "MUTUO_CONSENTIMIENTO"].includes(f.motivo) && (
              <Field label={f.motivo === "FALLECIMIENTO" ? "Beneficiarios (art. 501 LFT)" : "Detalle del motivo / causa"} className="sm:col-span-2" hint={f.motivo === "DESPIDO_JUSTIFICADO" ? "Describa la causa del art. 47 LFT y confirme que se entregó el aviso de rescisión." : undefined}>
                <Textarea value={f.detalleMotivo} onChange={(e) => set("detalleMotivo", e.target.value)} maxLength={1000} />
              </Field>
            )}
            <Field label="Tipo de contrato">
              <Select value={f.tipoContrato} onChange={(e) => set("tipoContrato", e.target.value as FormState["tipoContrato"])}>
                <option value="INDETERMINADO">Tiempo indeterminado (de planta)</option>
                <option value="DETERMINADO">Tiempo u obra determinada</option>
              </Select>
            </Field>
          </section>
          <Seccion titulo="Datos de identificación (opcionales)" descripcion="Solo si desea que aparezcan en los registros." abierta={false}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CURP"><Input value={f.curp} maxLength={18} onChange={(e) => set("curp", e.target.value.toUpperCase())} /></Field>
              <Field label="RFC del trabajador"><Input value={f.rfc} maxLength={13} onChange={(e) => set("rfc", e.target.value.toUpperCase())} /></Field>
              <Field label="NSS"><Input value={f.nss} maxLength={11} onChange={(e) => set("nss", e.target.value)} /></Field>
              <Field label="Número de empleado"><Input value={f.numeroEmpleado} maxLength={30} onChange={(e) => set("numeroEmpleado", e.target.value)} /></Field>
              <Field label="Fecha en que se pagará (si es distinta a la terminación)" hint="Define el ejercicio fiscal, la UMA y la tarifa de ISR aplicables."><Input type="date" value={f.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} /></Field>
            </div>
          </Seccion>
        </div>
      )}

      {/* ───────── Paso 2: Salario ───────── */}
      {paso === 2 && (
        <div className="space-y-4">
          <section className="card space-y-4">
            <Field label="¿Cómo se paga el salario?">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[["DIARIO", "Diario"], ["SEMANAL", "Semanal"], ["QUINCENAL", "Quincenal"], ["MENSUAL", "Mensual"], ["MINIMO", "Salario mínimo"]].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => set("salarioTipo", v)} className={`rounded-xl border-2 px-3 py-3 text-sm font-bold ${f.salarioTipo === v ? "border-ink bg-sun" : "border-line bg-white hover:border-ink"}`}>{l}</button>
                ))}
              </div>
            </Field>
            {f.salarioTipo !== "MINIMO" ? (
              <Field label={`Salario ${f.salarioTipo.toLowerCase()}`} error={err("salario.monto")} hint="Cuota diaria, sin aguinaldo ni prima. Si es semanal se divide entre 7, quincenal entre 15 y mensual entre 30.">
                <Money value={f.salarioMonto} onChange={(v) => set("salarioMonto", v)} error={!!err("salario.monto")} />
              </Field>
            ) : (
              <Alerta tipo="info" titulo="Se usará el salario mínimo vigente">
                {smZona ? <>Ejercicio {ejercicio?.anio}: <b>{money(smZona)}</b> diarios ({f.zona === "ZLFN" ? "Zona Libre de la Frontera Norte" : "resto del país"}).</> : "No hay un ejercicio capturado para esa fecha."}
              </Alerta>
            )}
            <Field label="Zona geográfica del salario mínimo" hint="Mexicali pertenece a la Zona Libre de la Frontera Norte (ZLFN).">
              <Select value={f.zona} onChange={(e) => set("zona", e.target.value as FormState["zona"])}>
                <option value="ZLFN">Zona Libre de la Frontera Norte{ejercicio ? ` – ${money(ejercicio.salarioMinimoZlfn)}` : ""}</option>
                <option value="GENERAL">Zona del Salario Mínimo General{ejercicio ? ` – ${money(ejercicio.salarioMinimoGeneral)}` : ""}</option>
              </Select>
            </Field>
            <Toggle checked={f.minimoProf} onChange={(v) => set("minimoProf", v)} label="El puesto tiene salario mínimo profesional" hint="Aplica solo a oficios de la tabla de la CONASAMI. Se usa como referencia mínima y para el tope de la prima de antigüedad." />
            {f.minimoProf && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ocupación (CONASAMI)"><Input value={f.ocupacionProf} onChange={(e) => set("ocupacionProf", e.target.value)} list="profesionales" />
                  <datalist id="profesionales">{(ejercicio?.profesionales ?? []).map((p) => <option key={p.clave} value={p.ocupacion} />)}</datalist></Field>
                <Field label="Salario mínimo profesional diario" error={err("salario.minimoProfesionalDiario")}>
                  <Money value={f.minimoProfMonto} onChange={(v) => set("minimoProfMonto", v)} />
                </Field>
              </div>
            )}
          </section>
          {resultado && (
            <Alerta tipo="info" titulo={`Salario diario: ${money(resultado.salario.diario)} · Antigüedad: ${resultado.antiguedad.texto}`}>
              {resultado.salario.explicacion}
            </Alerta>
          )}
          <Seccion titulo="Integración del salario (avanzado)" descripcion="Solo si la empresa otorga más que la ley o hay percepciones fijas adicionales." abierta={false}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Días de aguinaldo al año" error={err("integracion.aguinaldoDias")} hint="Mínimo legal: 15"><Num value={f.aguinaldoDias} onChange={(v) => set("aguinaldoDias", v)} suffix="días" error={!!err("integracion.aguinaldoDias")} /></Field>
              <Field label="Prima vacacional" error={err("integracion.primaVacacionalPct")} hint="Mínimo legal: 25%"><Num value={f.primaPct} onChange={(v) => set("primaPct", v)} suffix="%" error={!!err("integracion.primaVacacionalPct")} /></Field>
              <Field label="Otras percepciones diarias que integran salario" hint="Bonos fijos, despensa en efectivo, etc. (art. 84 LFT). Solo afecta indemnizaciones."><Money value={f.otrasPercepciones} onChange={(v) => set("otrasPercepciones", v)} /></Field>
              <Field label="Salario diario integrado conocido" hint="Si ya lo tiene calculado, reemplaza al estimado."><Money value={f.sdiManual} onChange={(v) => set("sdiManual", v)} /></Field>
            </div>
          </Seccion>
        </div>
      )}

      {/* ───────── Paso 3: Prestaciones y pagos ───────── */}
      {paso === 3 && (
        <div className="space-y-3">
          <Alerta tipo="info">Solo capture lo que aplique. Todo lo que deje vacío se asume en cero y los conceptos se calculan solos.</Alerta>

          <Seccion titulo="Sueldos pendientes" descripcion="¿Hasta qué día se le pagó?" derecha={resultado ? <b className="text-sm">{money(resultado.conceptos.find((c) => c.clave === "SUELDOS_PENDIENTES")?.saldo ?? 0)}</b> : null}>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => set("sueldosModo", "FECHA")} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${f.sueldosModo === "FECHA" ? "border-ink bg-sun" : "border-line"}`}>Por fecha</button>
              <button type="button" onClick={() => set("sueldosModo", "DIAS")} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${f.sueldosModo === "DIAS" ? "border-ink bg-sun" : "border-line"}`}>Por número de días</button>
            </div>
            {f.sueldosModo === "FECHA" ? (
              <Field label="Último día pagado" error={err("sueldos.ultimoDiaPagado")} hint="Se pagan los días posteriores hasta la terminación (inclusive).">
                <Input type="date" value={f.ultimoDiaPagado} onChange={(e) => set("ultimoDiaPagado", e.target.value)} error={!!err("sueldos.ultimoDiaPagado")} />
              </Field>
            ) : (
              <Field label="Días de sueldo pendientes" hint="Capture 0 si no hay sueldos pendientes."><Num value={f.diasPendientes} onChange={(v) => set("diasPendientes", v)} suffix="días" /></Field>
            )}
            <Field label="Sueldo de esos días que ya se pagó (si aplica)"><Money value={f.sueldosPagado} onChange={(v) => set("sueldosPagado", v)} /></Field>
            {pend("sueldos").map((p) => <Alerta key={p.id} tipo="warn">{p.mensaje}</Alerta>)}
          </Seccion>

          <Seccion titulo="Vacaciones" descripcion="Se calculan según la antigüedad (art. 76 LFT)." derecha={resultado ? <b className="text-sm">{money(resultado.conceptos.find((c) => c.clave === "VACACIONES")?.saldo ?? 0)}</b> : null}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Disfrutadas este año de servicio" error={err("vacaciones.diasDisfrutadosCicloActual")}><Num value={f.vacDisfrutadas} onChange={(v) => set("vacDisfrutadas", v)} suffix="días" /></Field>
              <Field label="Pendientes de años anteriores" hint="Solo si no las tomó"><Num value={f.vacPendAnt} onChange={(v) => set("vacPendAnt", v)} suffix="días" /></Field>
              <Field label="Ya pagadas en dinero"><Num value={f.vacPagadas} onChange={(v) => set("vacPagadas", v)} suffix="días" /></Field>
            </div>
            {resultado && <p className="hint">{resultado.conceptos.find((c) => c.clave === "VACACIONES")?.diasDetalle}</p>}
          </Seccion>

          <Seccion titulo="Prima vacacional" derecha={resultado ? <b className="text-sm">{money(resultado.conceptos.find((c) => c.clave === "PRIMA_VACACIONAL")?.saldo ?? 0)}</b> : null}>
            <Field label="Prima vacacional ya pagada (monto)" hint="Por las vacaciones de este año de servicio."><Money value={f.primaPagada} onChange={(v) => set("primaPagada", v)} /></Field>
            {Number(f.primaPagada) > 0 && (
              <Field label="¿Se pagó en el mismo año calendario que este pago?" hint="De esto depende la exención del ISR.">
                <Select value={f.primaMismoEjercicio} onChange={(e) => set("primaMismoEjercicio", e.target.value as FormState["primaMismoEjercicio"])}>
                  <option value="">Seleccione…</option><option value="si">Sí, en este mismo año</option><option value="no">No, en un año anterior</option>
                </Select>
              </Field>
            )}
          </Seccion>

          <Seccion titulo="Aguinaldo" derecha={resultado ? <b className="text-sm">{money(resultado.conceptos.find((c) => c.clave === "AGUINALDO")?.saldo ?? 0)}</b> : null}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Aguinaldo del año ya pagado (monto)" hint="Anticipos o pago parcial."><Money value={f.aguinaldoPagado} onChange={(v) => set("aguinaldoPagado", v)} /></Field>
              <Field label="Días de aguinaldo de años anteriores sin pagar"><Num value={f.aguinaldoAntDias} onChange={(v) => set("aguinaldoAntDias", v)} suffix="días" /></Field>
            </div>
          </Seccion>

          {motivoDespido && (
            <Seccion titulo="Indemnizaciones" descripcion="Despido injustificado o rescisión imputable al patrón (arts. 48, 50 y 52 LFT).">
              <Toggle checked={f.incluir20} onChange={(v) => set("incluir20", v)} label="Incluir 20 días de salario por año de servicios" hint="Art. 50 fr. II. Además se calculan 3 meses de salario y la prima de antigüedad." />
              {f.motivo === "DESPIDO_INJUSTIFICADO" && <Field label="Salarios vencidos (días), si se pactaron o se resolvieron" hint="Normalmente se determinan en juicio; déjelo vacío si no aplica."><Num value={f.salariosVencidosDias} onChange={(v) => set("salariosVencidosDias", v)} suffix="días" /></Field>}
            </Seccion>
          )}

          <Seccion titulo="Otros pagos o prestaciones pendientes" descripcion="Bonos, comisiones, prestaciones contractuales, pago pactado por mutuo consentimiento…" abierta={f.otros.length > 0}>
            {f.otros.map((o, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-line p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Concepto" error={err(`otrosConceptos.${i}.nombre`)}><Input value={o.nombre} onChange={(e) => set("otros", f.otros.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} /></Field>
                  <Field label="Importe"><Money value={o.monto} onChange={(v) => set("otros", f.otros.map((x, j) => (j === i ? { ...x, monto: v } : x)))} /></Field>
                  <Field label="Ya pagado"><Money value={o.pagado} onChange={(v) => set("otros", f.otros.map((x, j) => (j === i ? { ...x, pagado: v } : x)))} /></Field>
                </div>
                <Field label="Tratamiento fiscal" hint="Si no lo sabe, deje 'No sé': el cálculo quedará pendiente de validación.">
                  <Select value={o.trat} onChange={(e) => set("otros", f.otros.map((x, j) => (j === i ? { ...x, trat: e.target.value as OtroTrat } : x)))}>
                    <option value="DESCONOCIDO">No sé (pendiente de validación)</option>
                    <option value="SALARIAL">Ingreso salarial (gravado)</option>
                    <option value="SEPARACION">Pago por separación</option>
                    <option value="EXENTO">Exento (indicar fundamento)</option>
                  </Select>
                </Field>
                {o.trat === "EXENTO" && <Field label="Fundamento de la exención"><Input value={o.fundExencion} onChange={(e) => set("otros", f.otros.map((x, j) => (j === i ? { ...x, fundExencion: e.target.value } : x)))} /></Field>}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("otros", f.otros.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("otros", [...f.otros, { nombre: "", monto: "", pagado: "", trat: "DESCONOCIDO", fundExencion: "" }])}>+ Agregar concepto</button>
          </Seccion>

          <Seccion titulo="Anticipos y pagos parciales ya entregados" descripcion="Cantidades del finiquito que ya se le entregaron." abierta={f.anticipos.length > 0}>
            {f.anticipos.map((a, i) => (
              <div key={i} className="grid items-end gap-3 rounded-xl border border-line p-3 sm:grid-cols-4">
                <Field label="Descripción" className="sm:col-span-2" error={err(`anticipos.${i}.descripcion`)}><Input value={a.descripcion} onChange={(e) => set("anticipos", f.anticipos.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))} /></Field>
                <Field label="Monto"><Money value={a.monto} onChange={(v) => set("anticipos", f.anticipos.map((x, j) => (j === i ? { ...x, monto: v } : x)))} /></Field>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("anticipos", f.anticipos.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("anticipos", [...f.anticipos, { descripcion: "", monto: "", fecha: "" }])}>+ Agregar anticipo</button>
          </Seccion>

          <Seccion titulo="Deducciones" descripcion="Solo se aplican si cumplen el art. 110 LFT. Las demás se muestran como no aplicadas." abierta={f.deducciones.length > 0}>
            {f.deducciones.map((d, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-line p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Tipo"><Select value={d.tipo} onChange={(e) => set("deducciones", f.deducciones.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)))}>{TIPOS_DEDUCCION.map((t) => <option key={t} value={t}>{TIPO_DEDUCCION_LABEL[t]}</option>)}</Select></Field>
                  <Field label="Descripción" error={err(`deducciones.${i}.descripcion`)}><Input value={d.descripcion} onChange={(e) => set("deducciones", f.deducciones.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))} /></Field>
                  <Field label="Monto"><Money value={d.monto} onChange={(v) => set("deducciones", f.deducciones.map((x, j) => (j === i ? { ...x, monto: v } : x)))} /></Field>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle checked={d.sustento} onChange={(v) => set("deducciones", f.deducciones.map((x, j) => (j === i ? { ...x, sustento: v } : x)))} label="Cuento con el documento que lo sustenta" hint="Pagaré, recibo, orden judicial, aviso, etc." />
                  <Toggle checked={d.consent} onChange={(v) => set("deducciones", f.deducciones.map((x, j) => (j === i ? { ...x, consent: v } : x)))} label="El trabajador lo autorizó por escrito" />
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("deducciones", f.deducciones.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("deducciones", [...f.deducciones, { tipo: "ANTICIPO_SALARIO", descripcion: "", monto: "", sustento: false, consent: false, referencia: "" }])}>+ Agregar deducción</button>
          </Seccion>

          <Seccion titulo="Datos fiscales (avanzado)" descripcion="Opcional: si no se capturan, se derivan del salario." abierta={false}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Último sueldo mensual ordinario" hint="Para la retención de pagos por separación (art. 95/96 LISR)."><Money value={f.ultimoSueldoMensual} onChange={(v) => set("ultimoSueldoMensual", v)} /></Field>
              <Field label="Ingreso ordinario mensual regular" hint="Para la retención de aguinaldo y prima (art. 174 RISR)."><Money value={f.ingresoOrdMensual} onChange={(v) => set("ingresoOrdMensual", v)} /></Field>
            </div>
          </Seccion>

          {resultado && (
            <div className="sticky bottom-16 z-10 rounded-xl border-2 border-ink bg-ink px-4 py-2 text-white shadow-lg sm:bottom-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wide text-sun">NETO A PAGAR (en vivo)</span>
                <span className="text-xl font-black text-sun">{money(resultado.totales.netoAPagar)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────── Paso 4: Resultado ───────── */}
      {paso === 4 && (
        <div className="space-y-4">
          {resultado ? <ResultView r={resultado} /> : <Alerta tipo="warn" titulo="Aún no hay resultado">Complete los datos faltantes de los pasos anteriores.</Alerta>}
          {Object.keys(errores).length > 0 && (
            <Alerta tipo="error" titulo="Faltan datos válidos">
              <ul className="list-disc pl-5">{Object.entries(errores).map(([c, m]) => <li key={c}>{m}</li>)}</ul>
            </Alerta>
          )}
        </div>
      )}

      {/* ───────── Paso 5: Documentos ───────── */}
      {paso === 5 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([["recibo", "Recibo y desglose"], ["desglose", "Desglose explicativo"], ["carta", "Carta de renuncia"]] as const).map(([t, l]) => (
              <button key={t} onClick={() => setDocTipo(t)} className={`btn btn-sm ${docTipo === t ? "btn-dark" : "btn-ghost"}`}>{l}</button>
            ))}
          </div>
          {docTipo === "carta" && !(f.motivo === "RENUNCIA_VOLUNTARIA" && f.voluntadRenuncia) ? (
            <Alerta tipo="warn" titulo="La carta de renuncia no está disponible">Solo se genera cuando el motivo es renuncia voluntaria y se confirmó que el trabajador manifestó su voluntad (paso 1).</Alerta>
          ) : docData ? (
            <HojaPreview tipo={docTipo} d={docData} />
          ) : (
            <Alerta tipo="warn">Complete los datos para ver la vista previa.</Alerta>
          )}
          <Alerta tipo="info" titulo="Guarde para imprimir o exportar">Al guardar se asigna folio y quedan habilitados Imprimir, PDF y PNG. Estos documentos se generan en el servidor.</Alerta>
        </div>
      )}

      {errorGuardar ? <Alerta tipo="error">{errorGuardar}</Alerta> : null}
      {intentado[paso] && erroresPaso(paso).length > 0 && paso <= 3 ? <Alerta tipo="error" titulo="Revise los campos marcados" /> : null}

      {/* Navegación */}
      <div className="no-print sticky bottom-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border">
        <button className="btn btn-ghost" disabled={paso === 1} onClick={() => irA(paso - 1)}>← Atrás</button>
        <div className="flex flex-wrap gap-2">
          {paso >= 4 && (
            <>
              {!editandoBloqueado && <button className="btn btn-ghost" disabled={guardando || !resultado} onClick={() => guardar(false)}>Guardar borrador</button>}
              {!editandoBloqueado ? (
                <button className="btn btn-dark" disabled={guardando || !resultado || resultado.estado === "INCOMPLETO"} onClick={() => guardar(true)} title={resultado?.estado === "INCOMPLETO" ? "Resuelva los pendientes bloqueantes" : ""}>{guardando ? "Guardando…" : "Guardar y calcular"}</button>
              ) : (
                <CorreccionBoton disabled={guardando || !resultado || !inicial} onConfirm={async (motivo) => {
                  setGuardando(true); setErrorGuardar(null);
                  const r = await fetch(`/api/finiquitos/${inicial!.id}/correccion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datos: payload, motivo, version: inicial!.version }) });
                  const j = await r.json();
                  setGuardando(false);
                  if (!r.ok) setErrorGuardar(j.error ?? "No se pudo corregir");
                  else { router.push(`/finiquitos/${inicial!.id}`); router.refresh(); }
                }} />
              )}
            </>
          )}
          {paso < 5 && <button className="btn btn-primary" onClick={siguiente}>{paso === 3 ? "Ver resultado →" : "Siguiente →"}</button>}
        </div>
      </div>
    </div>
  );
}

type OtroTrat = FormState["otros"][number]["trat"];

function CorreccionBoton({ onConfirm, disabled }: { onConfirm: (motivo: string) => Promise<void>; disabled: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  return (
    <>
      <button className="btn btn-danger" disabled={disabled} onClick={() => setAbierto(true)}>Guardar corrección…</button>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="card w-full max-w-md space-y-3">
            <h3 className="text-lg font-extrabold">Motivo de la corrección</h3>
            <p className="hint">Queda registrado con su nombre y fecha. El cálculo anterior se conserva. El finiquito vuelve a “calculado” y deberá revisarse y autorizarse de nuevo.</p>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo 15 caracteres" />
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setAbierto(false)}>Cancelar</button>
              <button className="btn btn-danger" disabled={motivo.trim().length < 15} onClick={() => onConfirm(motivo)}>Confirmar corrección</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
