"use client";
import { useState, type ReactNode } from "react";

/** Búsqueda en una fila; el resto de filtros se despliega en móvil y siempre se ve en pantallas grandes. */
export function FiltrosForm({ buscar, extra, activos }: { buscar: ReactNode; extra: ReactNode; activos: number }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <form className="card card-accent grid grid-cols-2 gap-2 pl-5 sm:grid-cols-6 sm:gap-3" action="/">
      <div className="col-span-2 flex items-end gap-2 sm:col-span-2 sm:block">
        <div className="min-w-0 flex-1">{buscar}</div>
        <button type="button" onClick={() => setAbierto((v) => !v)} className="btn btn-ghost btn-sm shrink-0 sm:hidden" aria-expanded={abierto}>
          Filtros{activos ? ` (${activos})` : ""} {abierto ? "▴" : "▾"}
        </button>
      </div>
      <div className={`${abierto ? "grid" : "hidden"} col-span-2 grid-cols-2 gap-2 sm:contents`}>{extra}</div>
    </form>
  );
}
