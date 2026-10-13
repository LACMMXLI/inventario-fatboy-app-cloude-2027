"use client";
/** Imprime directamente el documento generado por el servidor (HTML con @page carta) mediante un iframe oculto. */
export function imprimirDocumento(finiquitoId: string, tipo: string) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  f.src = `/api/finiquitos/${finiquitoId}/documentos/${tipo}?formato=html&modo=impresion`;
  f.onload = () => {
    try {
      f.contentWindow?.focus();
      f.contentWindow?.print();
    } finally {
      setTimeout(() => f.remove(), 60_000);
    }
  };
  document.body.appendChild(f);
}

export const urlDocumento = (id: string, tipo: string, formato: "pdf" | "png", descargar = true) =>
  `/api/finiquitos/${id}/documentos/${tipo}?formato=${formato}${descargar ? "&descargar=1" : ""}`;
