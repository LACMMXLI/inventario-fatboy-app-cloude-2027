import { fechaCorta, fechaLarga } from "@/lib/fechas";
import { D, money } from "@/lib/money";
import { AvisoConfiguracion, DatosEmpresa, DatosTerminacion, DatosTrabajador, Encabezado, Pie, lugarFecha } from "./comunes";
import type { DocData } from "./tipos";

export function estadoPagoDoc(d: DocData) {
  const neto = D(d.resultado.totales.netoAPagar);
  const pagado = d.pagos.reduce((a, p) => a.plus(p.monto), D(0));
  const saldo = neto.minus(pagado);
  const tipo: "PENDIENTE" | "PARCIAL" | "PAGADO" = pagado.lte(0) ? "PENDIENTE" : saldo.gt(0) ? "PARCIAL" : "PAGADO";
  return { neto, pagado, saldo: saldo.lt(0) ? D(0) : saldo, tipo };
}

export function Recibo({ d }: { d: DocData }) {
  const r = d.resultado;
  const t = r.totales;
  const ep = estadoPagoDoc(d);
  const titulo = ep.tipo === "PENDIENTE" ? "Cálculo y desglose de finiquito" : ep.tipo === "PARCIAL" ? "Recibo de pago parcial de finiquito" : "Recibo de pago de finiquito";
  const conceptos = r.conceptos.filter((c) => c.aplica && (Number(c.generado) > 0 || Number(c.saldo) > 0));
  const sinGuardar = d.estadoInterno === "SIN_GUARDAR";
  const noAutorizado = ["SIN_GUARDAR", "BORRADOR", "CALCULADO", "REVISADO"].includes(d.estadoInterno);

  return (
    <div className="fb-doc">
      {r.estado !== "DEFINITIVO" || noAutorizado ? (
        <div className="fb-marca-agua"><span>{r.estado === "INCOMPLETO" ? "INCOMPLETO" : r.estado === "PROVISIONAL" ? "PROVISIONAL" : "NO AUTORIZADO"}</span></div>
      ) : null}
      <AvisoConfiguracion empresa={d.empresa} />
      <Encabezado
        empresa={d.empresa}
        titulo={titulo}
        subtitulo={
          <>
            {d.folio ? <>Folio {d.folio}{d.version ? ` · versión ${d.version}` : ""}<br /></> : null}
            {lugarFecha(d.empresa, d.fechaGeneracion)}
          </>
        }
      />

      {ep.tipo === "PENDIENTE" ? (
        <div className="fb-banner pend">
          <div>
            PENDIENTE DE PAGO — este documento es un cálculo y NO acredita el pago de cantidad alguna.
            <small>Estado interno: {sinGuardar ? "sin guardar" : d.estadoInterno.toLowerCase()}{d.autorizadoPor ? ` · autorizado por ${d.autorizadoPor}` : ""}.</small>
          </div>
        </div>
      ) : (
        <div className="fb-banner pago">
          <div>
            {ep.tipo === "PAGADO" ? "PAGO REGISTRADO POR EL TOTAL DEL NETO" : `PAGO PARCIAL REGISTRADO — saldo pendiente ${money(ep.saldo)}`}
            <small>Solo se acreditan los pagos listados en la sección “Pagos registrados”.</small>
          </div>
        </div>
      )}
      {r.estado !== "DEFINITIVO" ? (
        <div className="fb-banner alerta">
          <div>
            {r.estado === "INCOMPLETO" ? "CÁLCULO INCOMPLETO" : "CÁLCULO PROVISIONAL — PENDIENTE DE VALIDACIÓN FISCAL / JURÍDICA"}
            <small>Los importes pueden cambiar al resolver los siguientes puntos:</small>
            <ul>{r.pendientes.slice(0, 6).map((p) => <li key={p.id}>{p.mensaje}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="fb-grid"><DatosEmpresa empresa={d.empresa} /><DatosTrabajador d={d} /></div>
      <DatosTerminacion d={d} />

      <table className="fb-tabla">
        <thead>
          <tr><th>Concepto</th><th className="n">Generado</th><th className="n">Pagado antes</th><th className="n">Saldo</th><th className="n">ISR retenido</th></tr>
        </thead>
        <tbody>
          {conceptos.map((c) => (
            <tr key={c.clave}>
              <td>{c.nombre}<small>{[c.dias, c.fiscal.estado === "PROVISIONAL" ? "retención provisional" : null].filter(Boolean).join(" · ")}</small></td>
              <td className="n">{money(c.generado)}</td>
              <td className="n">{money(c.pagadoPreviamente)}</td>
              <td className="n">{money(c.saldo)}</td>
              <td className="n">{money(c.fiscal.isr)}</td>
            </tr>
          ))}
          {!conceptos.length ? <tr><td colSpan={5}>Sin conceptos con importe.</td></tr> : null}
        </tbody>
        <tfoot>
          <tr><td>Totales</td><td className="n">{money(t.generado)}</td><td className="n">{money(t.previamentePagado)}</td><td className="n">{money(t.saldoBruto)}</td><td className="n">{money(t.retenciones)}</td></tr>
        </tfoot>
      </table>

      <div className="fb-tot">
        <div className="fila"><span>Total bruto (saldo pendiente)</span><span>{money(t.saldoBruto)}</span></div>
        <div className="fila"><span>(−) Retenciones de ISR</span><span>{money(t.retenciones)}</span></div>
        <div className="fila"><span>(−) Deducciones procedentes</span><span>{money(t.deduccionesAplicadas)}</span></div>
        {D(t.anticiposEntregados).gt(0) ? <div className="fila"><span>(−) Anticipos ya entregados</span><span>{money(t.anticiposEntregados)}</span></div> : null}
        <div className="fila neto"><span>TOTAL NETO A PAGAR</span><span>{money(t.netoAPagar)}</span></div>
        {d.pagos.length ? (
          <>
            <div className="fila"><span>Pagos registrados</span><span>{money(ep.pagado)}</span></div>
            <div className="fila saldo"><span>Saldo por pagar</span><span>{money(ep.saldo)}</span></div>
          </>
        ) : null}
      </div>

      {d.pagos.length ? (
        <>
          <h2 className="fb-h2">Pagos registrados</h2>
          <table className="fb-tabla">
            <thead><tr><th>Fecha de pago</th><th>Forma</th><th>Referencia</th><th className="n">Importe</th></tr></thead>
            <tbody>
              {d.pagos.map((p, i) => (
                <tr key={i}><td>{fechaLarga(p.fechaPago)}</td><td>{p.forma}</td><td>{p.referencia ?? "—"}</td><td className="n">{money(p.monto)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {r.deducciones.some((x) => x.aplicada) ? (
        <p className="fb-nota">
          Deducciones aplicadas: {r.deducciones.filter((x) => x.aplicada).map((x) => `${x.descripcion} (${money(x.montoAplicado)})`).join("; ")}.
        </p>
      ) : null}
      <p className="fb-nota">
        Los cálculos, fórmulas y fundamento de cada concepto se detallan en el documento “Desglose explicativo”. Retenciones de ISR calculadas conforme a la LISR y su Reglamento; este documento no sustituye al CFDI de nómina.
      </p>

      <div className="fb-firmas">
        <div className="fb-firma">
          <b>{d.datos.trabajador.nombre}</b>
          <span>Trabajador(a){ep.pagado.gt(0) ? " — acuse de recepción de los pagos registrados" : " — acuse de recepción de este cálculo"}</span>
        </div>
        <div className="fb-firma">
          <b>{d.empresa.representanteLegal}</b>
          <span>{d.empresa.cargoRepresentante ?? "Representante legal"} de {d.empresa.razonSocial ?? d.empresa.nombreComercial}</span>
        </div>
      </div>
      <p className="fb-nota" style={{ marginTop: 10 }}>
        La firma de este documento solo acredita la recepción de lo que en él consta. No constituye renuncia de derechos ni finiquito general.
      </p>
      <Pie d={d} texto={`${d.empresa.nombreComercial} · ${d.empresa.ciudad}, ${d.empresa.estado}`} />
    </div>
  );
}
