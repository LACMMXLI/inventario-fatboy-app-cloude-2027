import { CartaRenuncia } from "./Carta";
import { Desglose } from "./Desglose";
import { Recibo } from "./Recibo";
import { DOC_CSS } from "./estilos";
import type { DocData, TipoDocumento } from "./tipos";

export const TITULOS: Record<TipoDocumento, string> = {
  recibo: "Recibo y desglose de finiquito",
  desglose: "Desglose explicativo",
  carta: "Carta de renuncia voluntaria",
};

export function Documento({ tipo, d, conEstilos = false }: { tipo: TipoDocumento; d: DocData; conEstilos?: boolean }) {
  return (
    <>
      {conEstilos ? <style dangerouslySetInnerHTML={{ __html: DOC_CSS }} /> : null}
      {tipo === "recibo" ? <Recibo d={d} /> : tipo === "desglose" ? <Desglose d={d} /> : <CartaRenuncia d={d} />}
    </>
  );
}
