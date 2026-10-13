"use client";
import { fechaLarga } from "@/lib/fechas";
import { money, num } from "@/lib/money";
import type { ResultadoFiniquito } from "@/lib/finiquito/types";
import { Alerta } from "@/components/ui";

export function TotalNeto({ r, etiqueta = "TOTAL NETO A PAGAR" }: { r: ResultadoFiniquito; etiqueta?: string }) {
  const prov = r.estado !== "DEFINITIVO";
  return (
    <div className="hero !p-0">
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-3 p-4 pb-5 sm:p-5 sm:pb-6">
        <div>
          <p className="text-xs font-bold tracking-widest text-sun">{etiqueta}</p>
          <p className="text-[2.4rem] font-black leading-none text-sun drop-shadow sm:text-6xl">{money(r.totales.netoAPagar)}</p>
          {prov ? (
            <p className="mt-2 inline-block rounded bg-fire px-2 py-0.5 text-xs font-bold">
              {r.estado === "INCOMPLETO" ? "CÁLCULO INCOMPLETO" : "PROVISIONAL – pendiente de validación fiscal"}
            </p>
          ) : null}
        </div>
        <dl className="grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs text-white/80 sm:w-auto sm:grid-cols-2 sm:gap-x-6 sm:gap-y-1 sm:text-sm">
          <dt>Total bruto</dt><dd className="text-right font-bold text-white">{money(r.totales.saldoBruto)}</dd>
          <dt>ISR retenido</dt><dd className="text-right font-bold text-white">−{money(r.totales.retenciones)}</dd>
          {Number(r.totales.deduccionesAplicadas) > 0 ? <><dt>Deducciones</dt><dd className="text-right font-bold text-white">−{money(r.totales.deduccionesAplicadas)}</dd></> : null}
          {Number(r.totales.anticiposEntregados) > 0 ? <><dt>Anticipos entregados</dt><dd className="text-right font-bold text-white">−{money(r.totales.anticiposEntregados)}</dd></> : null}
        </dl>
      </div>
    </div>
  );
}

export function EstadoCalculoBanner({ r }: { r: ResultadoFiniquito }) {
  if (r.estado === "DEFINITIVO" && !r.pendientes.length) {
    return <Alerta tipo="ok" titulo="Sin pendientes de validación">Los parámetros usados están validados y no faltan datos. Aun así, el cálculo debe revisarlo una persona antes de autorizarse.</Alerta>;
  }
  return (
    <Alerta tipo={r.estado === "INCOMPLETO" ? "error" : "warn"} titulo={r.estado === "INCOMPLETO" ? "Cálculo incompleto" : "Cálculo provisional: pendiente de validación"}>
      <ul className="list-disc space-y-1 pl-5">
        {r.pendientes.map((p) => (
          <li key={p.id}>
            <b>{p.tipo === "DATO" ? "Falta dato: " : "Validar: "}</b>
            {p.mensaje}
          </li>
        ))}
      </ul>
    </Alerta>
  );
}

export function ResultView({ r }: { r: ResultadoFiniquito }) {
  const a = r.antiguedad;
  const aplicables = r.conceptos.filter((c) => c.aplica);
  const noAplican = r.conceptos.filter((c) => !c.aplica);
  return (
    <div className="space-y-3 sm:space-y-4">
      <TotalNeto r={r} />
      <EstadoCalculoBanner r={r} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <div className="card card-accent col-span-2 pl-5 sm:col-span-1"><p className="label">Antigüedad exacta</p><p className="text-base font-extrabold sm:text-lg">{a.texto}</p><p className="hint hidden sm:block">{a.diasTotales} días naturales · {num(a.aniosDecimal, 4)} años</p></div>
        <div className="card card-accent pl-5"><p className="label">Salario diario</p><p className="text-base font-extrabold sm:text-lg">{money(r.salario.diario)}</p><p className="hint hidden sm:block">{r.salario.explicacion}</p></div>
        <div className="card card-accent pl-5"><p className="label">Salario diario integrado</p><p className="text-base font-extrabold sm:text-lg">{money(r.salario.diarioIntegrado)}</p><p className="hint">Factor {r.salario.factorIntegracion}<span className="hidden sm:inline"> · base de las indemnizaciones</span></p></div>
      </div>

      <section className="card">
        <h3 className="mb-2 text-base font-extrabold">Desglose por concepto</h3>
        <ul className="divide-y divide-line sm:hidden">
          {aplicables.map((c) => (
            <li key={c.clave} className="py-2">
              <div className="flex items-baseline justify-between gap-2"><span className="text-sm font-bold leading-tight">{c.nombre}</span><span className="text-base font-black">{money(c.saldo)}</span></div>
              <p className="text-[11px] text-muted">{c.dias ?? ""} · gen. {money(c.generado)} − pag. {money(c.pagadoPreviamente)} · ISR {money(c.fiscal.isr)}{c.fiscal.estado === "PROVISIONAL" ? " (prov.)" : ""}</p>
            </li>
          ))}
          <li className="flex items-baseline justify-between pt-2 text-sm font-extrabold"><span>Bruto · ISR</span><span>{money(r.totales.saldoBruto)} · −{money(r.totales.retenciones)}</span></li>
        </ul>
        <div className="table-wrap hidden sm:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b-2 border-ink bg-sun-soft text-left text-xs uppercase tracking-wide">
                <th className="py-2 pr-2">Concepto</th><th className="px-2 text-right">Generado</th><th className="px-2 text-right">Pagado antes</th><th className="px-2 text-right">Saldo</th><th className="pl-2 text-right">ISR</th>
              </tr>
            </thead>
            <tbody>
              {aplicables.map((c) => (
                <tr key={c.clave} className="border-b border-line align-top">
                  <td className="py-2 pr-2 font-semibold">{c.nombre}<span className="block text-xs font-normal text-muted">{c.dias ?? ""}</span></td>
                  <td className="px-2 text-right">{money(c.generado)}</td>
                  <td className="px-2 text-right">{money(c.pagadoPreviamente)}</td>
                  <td className="px-2 text-right font-bold">{money(c.saldo)}</td>
                  <td className="pl-2 text-right">{money(c.fiscal.isr)}{c.fiscal.estado === "PROVISIONAL" ? <span className="block text-[10px] font-bold text-fire">provisional</span> : null}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-extrabold">
                <td className="py-2">Totales</td><td className="px-2 text-right">{money(r.totales.generado)}</td><td className="px-2 text-right">{money(r.totales.previamentePagado)}</td><td className="px-2 text-right">{money(r.totales.saldoBruto)}</td><td className="pl-2 text-right">{money(r.totales.retenciones)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-extrabold">¿De dónde sale cada peso?</h3>
        {aplicables.map((c) => (
          <details key={c.clave} className="card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <span className="text-sm font-bold sm:text-base">{c.nombre}</span>
              <span className="shrink-0 rounded-full bg-sun px-2.5 py-0.5 text-xs font-extrabold sm:px-3 sm:text-sm">{money(c.saldo)}</span>
            </summary>
            <div className="mt-3 space-y-2 text-sm">
              <p>{c.explicacion}</p>
              <p className="rounded-lg border-l-4 border-sun bg-sun-soft px-3 py-2 font-mono text-xs break-words">{c.formula}</p>
              <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                <div><dt className="label">Días considerados</dt><dd>{c.dias ?? "—"}{c.diasDetalle ? <span className="block text-xs text-muted">{c.diasDetalle}</span> : null}</dd></div>
                <div><dt className="label">Base salarial</dt><dd>{c.baseSalarial ? `${c.baseSalarial.etiqueta}: ${money(c.baseSalarial.monto)}` : "—"}</dd></div>
                <div><dt className="label">Generado − pagado = saldo</dt><dd>{money(c.generado)} − {money(c.pagadoPreviamente)} = <b>{money(c.saldo)}</b></dd></div>
                <div><dt className="label">Fundamento legal</dt><dd>{c.fundamento.join(" · ")}</dd></div>
                <div className="sm:col-span-2"><dt className="label">Tratamiento fiscal</dt><dd>{c.fiscal.tratamiento}. Exento {money(c.fiscal.exento)} · Gravado {money(c.fiscal.gravado)} · ISR {money(c.fiscal.isr)}</dd></div>
              </dl>
              {c.notas.map((n, i) => <p key={i} className="text-xs text-muted">Nota: {n}</p>)}
            </div>
          </details>
        ))}
        {noAplican.length ? (
          <details className="card bg-fog">
            <summary className="cursor-pointer font-bold text-muted">Conceptos que no aplican ({noAplican.length})</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {noAplican.map((c) => <li key={c.clave}><b>{c.nombre}:</b> {c.motivoNoAplica}</li>)}
            </ul>
          </details>
        ) : null}
      </section>

      {r.fiscal.bloques.length ? (
        <section className="card">
          <h3 className="text-base font-extrabold">Retenciones de ISR (sin tasa fija)</h3>
          <p className="hint mb-2">Exenciones calculadas con {r.fiscal.baseExencion === "UMA" ? `UMA ${money(r.fiscal.umaDiaria)}` : `salario mínimo ${money(r.fiscal.baseExencionMonto)}`}. Cada grupo de conceptos sigue su propio procedimiento legal.</p>
          <div className="space-y-3">
            {r.fiscal.bloques.map((b) => (
              <div key={b.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b>{b.titulo}</b>
                  <span className="rounded-full bg-ink px-3 py-0.5 text-sm font-bold text-sun">ISR {money(b.isr)}</span>
                </div>
                <p className="text-sm text-muted">Base {money(b.baseTotal)} · Exento {money(b.exento)} · Gravado {money(b.gravado)}{b.estado === "PROVISIONAL" ? " · PROVISIONAL" : ""}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">{b.procedimiento.map((p, i) => <li key={i}>{p}</li>)}</ul>
                <p className="mt-1 text-xs text-muted">{b.fundamento.join(" · ")}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {r.deducciones.length ? (
        <section className="card">
          <h3 className="mb-2 text-base font-extrabold">Deducciones evaluadas</h3>
          <ul className="space-y-2 text-sm">
            {r.deducciones.map((d, i) => (
              <li key={i} className={`rounded-lg border p-2 ${d.aplicada ? "border-ok bg-ok-soft" : "border-fire bg-fire-soft"}`}>
                <b>{d.tipo}: {d.descripcion}</b> — solicitado {money(d.montoSolicitado)}, aplicado <b>{money(d.montoAplicado)}</b>
                <span className="block text-xs">{d.aplicada ? "Aplicada. " : "NO aplicada. "}{d.motivo}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(r.avisos.length || r.supuestos.length) ? (
        <section className="card text-sm">
          {r.avisos.length ? <><h3 className="font-extrabold">Avisos</h3><ul className="mb-3 list-disc pl-5">{r.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></> : null}
          {r.supuestos.length ? <><h3 className="font-extrabold">Supuestos aplicados</h3><ul className="list-disc pl-5 text-muted">{r.supuestos.map((a, i) => <li key={i}>{a}</li>)}</ul></> : null}
        </section>
      ) : null}
      <p className="text-center text-xs text-muted">Calculado el {fechaLarga(r.fechaCalculo)} · motor v{r.motorVersion} · parámetros {r.parametros.pago.anio}</p>
    </div>
  );
}
