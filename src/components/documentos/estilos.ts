/** Hoja de estilo compartida por la vista previa en pantalla y la generación de PDF/PNG en el servidor. */
export const DOC_CSS = `
.fb-doc{--negro:#0b0b0c;--amarillo:#ffc400;--rojo:#e5262c;--gris:#5b5b61;--linea:#d9d9dd;--fondo:#f6f6f7;
  font-family:"Helvetica Neue",Arial,"Liberation Sans",sans-serif;color:var(--negro);font-size:10pt;line-height:1.3;
  width:8.5in;background:#fff;padding:.55in .6in;box-sizing:border-box;position:relative}
.fb-doc *{box-sizing:border-box}
.fb-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid var(--negro);padding-bottom:10px;margin-bottom:10px;position:relative}
.fb-head:after{content:"";position:absolute;left:0;bottom:-6px;height:3px;width:96px;background:var(--rojo)}
.fb-marca{display:flex;align-items:center;gap:10px}
.fb-logo{background:var(--negro);color:var(--amarillo);font-weight:900;letter-spacing:.06em;font-size:19pt;padding:5px 12px;border-radius:4px;border-bottom:4px solid var(--rojo)}
.fb-marca small{display:block;color:var(--gris);font-size:8pt;line-height:1.25;max-width:2.9in}
.fb-titulo{text-align:right}
.fb-titulo h1{margin:0;font-size:15pt;font-weight:800;text-transform:uppercase;letter-spacing:.02em;line-height:1.1}
.fb-titulo p{margin:2px 0 0;font-size:8.5pt;color:var(--gris)}
.fb-banner{border:2px solid var(--negro);border-radius:6px;padding:7px 10px;margin:10px 0 6px;font-weight:700;font-size:9.5pt;display:flex;gap:8px;align-items:flex-start}
.fb-banner.pend{background:#fff6d1;border-color:var(--amarillo)}
.fb-banner.pago{background:#e9f7ec;border-color:#1c8c3c;color:#14562a}
.fb-banner.alerta{background:#fdeaea;border-color:var(--rojo);color:#8a1015}
.fb-banner small{display:block;font-weight:500;font-size:8.5pt;margin-top:2px}
.fb-banner ul{margin:3px 0 0;padding-left:16px;font-weight:500;font-size:8.5pt}
.fb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;margin:8px 0}
.fb-caja{border:1px solid var(--linea);border-radius:6px;padding:7px 10px;background:var(--fondo)}
.fb-caja h3{margin:0 0 4px;font-size:8pt;text-transform:uppercase;letter-spacing:.08em;color:var(--gris)}
.fb-kv{display:flex;justify-content:space-between;gap:10px;font-size:9.5pt;padding:1.5px 0;border-bottom:1px dotted #e1e1e4}
.fb-kv:last-child{border-bottom:0}
.fb-kv span:first-child{color:var(--gris);flex:none}
.fb-kv span:last-child{font-weight:600;text-align:right}
.fb-nc{color:#9a6b00;font-style:italic;font-weight:500}
.fb-tabla{width:100%;border-collapse:collapse;margin:8px 0;font-size:9.2pt}
.fb-tabla th{background:var(--negro);color:#fff;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.05em;padding:5px 7px}
.fb-tabla th.n,.fb-tabla td.n{text-align:right;white-space:nowrap}
.fb-tabla td{border-bottom:1px solid var(--linea);padding:5px 7px;vertical-align:top}
.fb-tabla tr{break-inside:avoid}
.fb-tabla td small{display:block;color:var(--gris);font-size:7.8pt}
.fb-tabla tfoot td{font-weight:700;border-top:2px solid var(--negro);border-bottom:0}
.fb-tot{margin:10px 0 0 auto;width:3.7in;font-size:10pt}
.fb-tot .fila{display:flex;justify-content:space-between;padding:3px 8px;border-bottom:1px solid var(--linea)}
.fb-tot .neto{background:var(--negro);color:var(--amarillo);font-weight:900;font-size:12.5pt;border-radius:5px;margin-top:6px;padding:8px 10px;border-bottom:0;border-left:6px solid var(--rojo)}
.fb-tot .fila.sub{font-weight:700;background:var(--fondo)}
.fb-tot .fila.saldo{font-weight:800;color:var(--rojo)}
.fb-h2{font-size:10.5pt;text-transform:uppercase;letter-spacing:.06em;margin:16px 0 4px;padding-bottom:3px;border-bottom:2px solid var(--amarillo);break-after:avoid}
.fb-nota{font-size:8.5pt;color:var(--gris)}
.fb-firmas{display:grid;grid-template-columns:1fr 1fr;gap:42px;margin-top:40px;break-inside:avoid}
.fb-firma{border-top:1.5px solid var(--negro);padding-top:4px;text-align:center;font-size:9pt}
.fb-firma b{display:block;font-size:9.5pt}
.fb-firma span{color:var(--gris);font-size:8pt}
.fb-pie{margin-top:16px;border-top:1px solid var(--linea);padding-top:5px;font-size:7.8pt;color:var(--gris);display:flex;justify-content:space-between;gap:10px}
.fb-concepto{border:1px solid var(--linea);border-radius:6px;margin:8px 0;padding:8px 10px;break-inside:avoid}
.fb-concepto h4{margin:0 0 3px;font-size:10pt;display:flex;justify-content:space-between;gap:8px}
.fb-concepto h4 em{font-style:normal;background:var(--amarillo);padding:0 7px;border-radius:9px;font-size:9pt}
.fb-concepto p{margin:2px 0;font-size:9pt}
.fb-concepto .lbl{color:var(--gris);font-size:7.8pt;text-transform:uppercase;letter-spacing:.06em;display:block;margin-top:4px}
.fb-concepto.noaplica{background:var(--fondo);opacity:.85}
.fb-formula{font-family:"Courier New",monospace;background:#fff8dc;border-left:3px solid var(--amarillo);padding:3px 7px;font-size:8.6pt;word-break:break-word}
.fb-carta p{margin:0 0 12pt;text-align:justify;font-size:11.5pt;line-height:1.6}
.fb-carta .der{text-align:right}
.fb-marca-agua{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;overflow:hidden}
.fb-marca-agua span{transform:rotate(-30deg);font-size:46pt;font-weight:900;color:rgba(229,38,44,.13);border:6px solid rgba(229,38,44,.13);padding:4px 24px;white-space:nowrap}
.fb-solo-pantalla{background:#fff6d1;border:1px dashed #b88a00;color:#6b4e00;padding:6px 10px;border-radius:6px;font-size:9pt;margin-bottom:10px}
@media print{.fb-solo-pantalla{display:none!important}}
`;

/** CSS adicional para impresión/PDF en el servidor: la página la define @page, no el padding de la hoja. */
export const DOC_CSS_PRINT = `
@page{size:Letter;margin:.4in .55in .55in .55in}
html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.fb-doc{width:auto;padding:0}
`;
