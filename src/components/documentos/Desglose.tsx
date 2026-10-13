import { fechaLarga } from "@/lib/fechas";
import { MOTIVO_LABEL } from "@/lib/finiquito/schema";
import { money, num } from "@/lib/money";
import { AvisoConfiguracion, Encabezado, Pie, lugarFecha } from "./comunes";
import type { DocData } from "./tipos";

export function Desglose({ d }: { d: DocData }) {
  const r = d.resultado;
  const a = r.antiguedad;
  const t = r.totales;
  const p = r.parametros;
  return (
    <div className="fb-doc">
      <AvisoConfiguracion empresa={d.empresa} />
      <Encabezado
        empresa={d.empresa}
        titulo="Desglose explicativo del cálculo"
        subtitulo={<>{d.folio ? <>Folio {d.folio}{d.version ? ` · versión ${d.version}` : ""}<br /></> : null}{lugarFecha(d.empresa, d.fechaGeneracion)}<br />Documento de revisión administrativa</>}
      />
      <div className={`fb-banner ${r.estado === "DEFINITIVO" ? "pend" : "alerta"}`}>
        <div>
          Estado del cálculo: {r.estado === "DEFINITIVO" ? "SIN PENDIENTES DE VALIDACIÓN" : r.estado === "PROVISIONAL" ? "PROVISIONAL — pendiente de validación" : "INCOMPLETO"}
          <small>Motor v{r.motorVersion} · Calculado con datos al {fechaLarga(r.fechaCalculo)} · Ejercicio fiscal de pago {r.ejercicioPago}.</small>
        </div>
      </div>

      <h2 className="fb-h2">1. Datos del cálculo</h2>
      <table className="fb-tabla">
        <tbody>
          <tr><td>Trabajador</td><td>{d.datos.trabajador.nombre} — {d.datos.trabajador.puesto} — {d.datos.trabajador.sucursal}</td></tr>
          <tr><td>Periodo</td><td>Ingreso {fechaLarga(d.datos.fechaIngreso)}; terminación {fechaLarga(d.datos.fechaTerminacion)}</td></tr>
          <tr><td>Motivo</td><td>{MOTIVO_LABEL[d.datos.motivo]}{d.datos.detalleMotivo ? ` — ${d.datos.detalleMotivo}` : ""}</td></tr>
          <tr><td>Antigüedad exacta</td><td>{a.texto} ({a.diasTotales} días naturales; {num(a.aniosDecimal, 6)} años). Año de servicio en curso: {a.diasCicloTranscurridos} de {a.diasCicloTotal} días (desde {fechaLarga(a.ultimoAniversario)}).</td></tr>
          <tr><td>Salario diario</td><td>{r.salario.explicacion}</td></tr>
          <tr><td>Salario diario integrado</td><td>{r.salario.detalleIntegracion}</td></tr>
          <tr><td>Mínimo de referencia</td><td>{r.salario.minimoReferencia.etiqueta}: {money(r.salario.minimoReferencia.monto)}</td></tr>
        </tbody>
      </table>

      <h2 className="fb-h2">2. Conceptos</h2>
      {r.conceptos.map((c) => (
        <div key={c.clave} className={`fb-concepto ${c.aplica ? "" : "noaplica"}`}>
          <h4><span>{c.nombre}</span><em>{c.aplica ? money(c.saldo) : "No aplica"}</em></h4>
          {!c.aplica ? <p><b>Por qué no aplica:</b> {c.motivoNoAplica}</p> : (
            <>
              <p>{c.explicacion}</p>
              <span className="lbl">Fórmula</span>
              <div className="fb-formula">{c.formula}</div>
              <span className="lbl">Días considerados / base salarial</span>
              <p>{c.dias ?? "—"}{c.diasDetalle ? ` (${c.diasDetalle})` : ""}{c.baseSalarial ? ` · ${c.baseSalarial.etiqueta}: ${money(c.baseSalarial.monto)}` : ""}</p>
              <span className="lbl">Fundamento</span>
              <p>{c.fundamento.join(" · ")}</p>
              <span className="lbl">Cuentas</span>
              <p>Generado {money(c.generado)} − Pagado antes {money(c.pagadoPreviamente)} = <b>Saldo {money(c.saldo)}</b></p>
              <span className="lbl">Tratamiento fiscal</span>
              <p>{c.fiscal.tratamiento}. Exento {money(c.fiscal.exento)} · Gravado {money(c.fiscal.gravado)} · ISR {money(c.fiscal.isr)}{c.fiscal.estado === "PROVISIONAL" ? " (PROVISIONAL)" : ""}</p>
              {c.notas.map((n, i) => <p key={i} className="fb-nota">Nota: {n}</p>)}
            </>
          )}
        </div>
      ))}

      <h2 className="fb-h2">3. Retenciones de ISR</h2>
      <p className="fb-nota">Exenciones calculadas con {r.fiscal.baseExencion === "UMA" ? `UMA ${money(r.fiscal.umaDiaria)}` : `salario mínimo ${money(r.fiscal.baseExencionMonto)}`}. No se aplica una tasa fija: cada concepto sigue su procedimiento.</p>
      {r.fiscal.bloques.length ? r.fiscal.bloques.map((b) => (
        <div key={b.id} className="fb-concepto">
          <h4><span>{b.titulo}</span><em>ISR {money(b.isr)}</em></h4>
          <p>Base {money(b.baseTotal)} · Exento {money(b.exento)} · Gravado {money(b.gravado)}{b.estado === "PROVISIONAL" ? " · PROVISIONAL" : ""}</p>
          {b.procedimiento.map((x, i) => <p key={i} className="fb-nota">{x}</p>)}
          <span className="lbl">Fundamento</span>
          <p>{b.fundamento.join(" · ")}</p>
        </div>
      )) : <p>No hay conceptos gravados.</p>}

      <h2 className="fb-h2">4. Totales</h2>
      <table className="fb-tabla">
        <tbody>
          <tr><td>Total generado</td><td className="n">{money(t.generado)}</td></tr>
          <tr><td>(−) Previamente pagado</td><td className="n">{money(t.previamentePagado)}</td></tr>
          <tr><td>Total bruto (saldo)</td><td className="n">{money(t.saldoBruto)}</td></tr>
          <tr><td>(−) Retenciones de ISR</td><td className="n">{money(t.retenciones)}</td></tr>
          <tr><td>(−) Deducciones procedentes</td><td className="n">{money(t.deduccionesAplicadas)}</td></tr>
          <tr><td>Neto calculado</td><td className="n">{money(t.netoCalculado)}</td></tr>
          <tr><td>(−) Anticipos entregados</td><td className="n">{money(t.anticiposEntregados)}</td></tr>
          <tr><td><b>TOTAL NETO A PAGAR</b></td><td className="n"><b>{money(t.netoAPagar)}</b></td></tr>
        </tbody>
      </table>

      {r.deducciones.length ? (
        <>
          <h2 className="fb-h2">5. Deducciones evaluadas</h2>
          <table className="fb-tabla">
            <thead><tr><th>Deducción</th><th className="n">Solicitada</th><th className="n">Aplicada</th><th>Resultado</th></tr></thead>
            <tbody>{r.deducciones.map((x, i) => <tr key={i}><td>{x.tipo}: {x.descripcion}</td><td className="n">{money(x.montoSolicitado)}</td><td className="n">{money(x.montoAplicado)}</td><td>{x.aplicada ? "Aplicada. " : "NO aplicada. "}{x.motivo}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}

      {(r.pendientes.length || r.avisos.length || r.supuestos.length) ? (
        <>
          <h2 className="fb-h2">6. Pendientes, avisos y supuestos</h2>
          {r.pendientes.length ? <><b>Pendientes de validación o dato:</b><ul>{r.pendientes.map((x) => <li key={x.id}>[{x.severidad}] {x.mensaje}</li>)}</ul></> : null}
          {r.avisos.length ? <><b>Avisos:</b><ul>{r.avisos.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
          {r.supuestos.length ? <><b>Supuestos aplicados:</b><ul>{r.supuestos.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
        </>
      ) : null}

      <h2 className="fb-h2">7. Parámetros legales utilizados (se conservan con el cálculo)</h2>
      <table className="fb-tabla">
        <tbody>
          <tr><td>Salarios mínimos {p.salario.anio}</td><td>General {money(p.salario.salariosMinimos.general)} · ZLFN {money(p.salario.salariosMinimos.zlfn)} · estatus {p.salario.estatus.salariosMinimos}</td></tr>
          <tr><td>UMA / exenciones {p.pago.anio}</td><td>UMA {money(r.fiscal.umaDiaria)} (estatus {p.pago.estatus.uma}) · exenciones: {p.pago.exenciones.aguinaldoDias} aguinaldo, {p.pago.exenciones.primaVacacionalDias} prima vacacional, {p.pago.exenciones.separacionDiasPorAnio}/año separación, base {p.pago.exenciones.base} (estatus {p.pago.estatus.exenciones})</td></tr>
          <tr><td>Tarifa ISR {p.pago.anio}</td><td>{p.pago.tarifaMensualIsr ? `Tarifa mensual art. 96 LISR capturada (estatus ${p.pago.estatus.tarifaIsr})` : "No capturada"}</td></tr>
          {p.pago.fuentes.map((f, i) => <tr key={i}><td>Fuente: {f.concepto}</td><td>{f.referencia} [{f.estatus}]</td></tr>)}
        </tbody>
      </table>
      {d.historial?.length ? (
        <>
          <h2 className="fb-h2">8. Historial de modificaciones</h2>
          <table className="fb-tabla">
            <thead><tr><th>Versión</th><th>Movimiento</th><th>Usuario</th><th>Fecha</th></tr></thead>
            <tbody>{d.historial.map((h, i) => <tr key={i}><td>v{h.version}</td><td>{h.tipo}{h.motivo ? ` — ${h.motivo}` : ""}</td><td>{h.usuario}</td><td>{fechaLarga(h.fecha.slice(0, 10))}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      <Pie d={d} texto="Documento interno de revisión. No acredita pago ni sustituye al recibo." />
    </div>
  );
}

