import { fechaLarga } from "@/lib/fechas";
import { AvisoConfiguracion, lugarFecha } from "./comunes";
import type { CartaContenido, DocData } from "./tipos";

/** Texto base de la carta, generado SOLO con datos capturados. Es editable antes de imprimir. */
export function cartaPorDefecto(d: Pick<DocData, "empresa" | "datos" | "fechaGeneracion">): CartaContenido {
  const e = d.empresa;
  const t = d.datos.trabajador;
  const dest = e.razonSocial ?? e.nombreComercial;
  return {
    lugar: `${e.ciudad}, ${e.estado}`,
    fecha: d.fechaGeneracion,
    destinatario: dest,
    atencion: e.representanteLegal,
    fechaEfectiva: d.datos.fechaTerminacion,
    parrafos: [
      `Por medio de la presente, yo, ${t.nombre}, quien me desempeño como ${t.puesto} en la sucursal ${t.sucursal} de ${e.nombreComercial}, con fecha de ingreso ${fechaLarga(d.datos.fechaIngreso)}, manifiesto mi decisión de dar por terminada la relación de trabajo que me une con ${dest}, a partir del ${fechaLarga(d.datos.fechaTerminacion)}.`,
      `Esta decisión la tomo de manera libre y voluntaria.`,
      `Solicito que se realice el cálculo y pago de las prestaciones que conforme a la ley me correspondan, y que se me entregue el desglose correspondiente para su revisión.`,
      `Agradezco la oportunidad de haber formado parte del equipo.`,
    ],
    revisada: false,
  };
}

export function CartaRenuncia({ d }: { d: DocData }) {
  const c = d.carta ?? cartaPorDefecto(d);
  return (
    <div className="fb-doc fb-carta">
      {!c.revisada ? <div className="fb-marca-agua"><span>BORRADOR SIN REVISAR</span></div> : null}
      <AvisoConfiguracion empresa={d.empresa} />
      <div className="fb-head">
        <div className="fb-marca"><div className="fb-logo">{d.empresa.nombreComercial.toUpperCase()}</div></div>
        <div className="fb-titulo"><h1>Carta de renuncia voluntaria</h1></div>
      </div>
      <p className="der" style={{ marginTop: 18 }}>{c.lugar ? `${c.lugar}, a ${fechaLarga(c.fecha)}` : lugarFecha(d.empresa, c.fecha)}</p>
      <p style={{ marginTop: 18 }}>
        <b>{c.destinatario}</b><br />
        {c.atencion ? <>At’n: {c.atencion}<br /></> : null}
        P r e s e n t e
      </p>
      <div style={{ marginTop: 14 }}>
        {c.parrafos.filter((p) => p.trim()).map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <p style={{ marginTop: 16 }}>Atentamente,</p>
      <div className="fb-firmas" style={{ gridTemplateColumns: "1fr", maxWidth: "3.4in", marginTop: 70 }}>
        <div className="fb-firma">
          <b>{d.datos.trabajador.nombre}</b>
          <span>Firma del trabajador(a) — {d.datos.trabajador.puesto}</span>
        </div>
      </div>
      <p className="fb-nota" style={{ marginTop: 30 }}>
        Este documento no está firmado. Su validez depende de la firma autógrafa del trabajador(a), quien debe haber manifestado por sí mismo(a) su voluntad de renunciar.
      </p>
    </div>
  );
}
