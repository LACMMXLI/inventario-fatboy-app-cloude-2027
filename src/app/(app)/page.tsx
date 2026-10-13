import Link from "next/link";
import { EstadoFiniquito } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { listarFiniquitos } from "@/lib/server/finiquitos";
import { usuarioActual } from "@/lib/server/auth";
import { cargarCatalogo } from "@/lib/server/parametros";
import { CalculoChip, EstadoChip, Alerta } from "@/components/ui";
import { ESTADO_LABEL } from "@/lib/estados";
import { money } from "@/lib/money";
import { fechaCorta } from "@/lib/fechas";
import { MOTIVO_LABEL, type Motivo } from "@/lib/finiquito/schema";

export const metadata = { title: "Finiquitos" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function Inicio({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = (await usuarioActual())!;
  const estadoRaw = one(sp.estado);
  const estado = estadoRaw && estadoRaw in EstadoFiniquito ? (estadoRaw as EstadoFiniquito) : undefined;
  const filtros = { q: one(sp.q), sucursalId: one(sp.sucursalId), estado, desde: one(sp.desde), hasta: one(sp.hasta), pagina: Number(one(sp.pagina)) || 1 };
  const [lista, sucursales, porEstado, catalogo] = await Promise.all([
    listarFiniquitos(filtros),
    prisma.sucursal.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    prisma.finiquito.groupBy({ by: ["estado"], _count: { _all: true }, _sum: { totalNeto: true } }),
    cargarCatalogo(),
  ]);
  const cuenta = (e: EstadoFiniquito) => porEstado.find((x) => x.estado === e)?._count._all ?? 0;
  const porPagar = porEstado.find((x) => x.estado === "AUTORIZADO")?._sum.totalNeto?.toString() ?? "0";
  const sinConfirmar = catalogo.filter((p) => Object.values(p.estatus).some((s) => s === "PENDIENTE" || s === "CORROBORADO")).map((p) => p.anio);
  const totalPaginas = Math.max(1, Math.ceil(lista.total / lista.porPagina));
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filtros, ...extra })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <section className="hero">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-sun">Fatboy · Mexicali, B.C.</p>
            <h1 className="mt-1 text-3xl sm:text-4xl">Finiquitos<br className="sm:hidden" /> y terminación laboral</h1>
            <p className="mt-2 max-w-md text-sm text-white/75">Hola, {user.nombre}. Calcula, revisa, autoriza y documenta cada salida con respaldo legal.</p>
          </div>
          <Link href="/finiquitos/nuevo" className="btn btn-primary w-full text-base sm:w-auto">+ Nuevo cálculo</Link>
        </div>
      </section>

      {user.rol === "ADMIN" && sinConfirmar.length > 0 && (
        <Alerta tipo="warn" titulo="Parámetros legales sin confirmar">
          Los ejercicios {sinConfirmar.join(", ")} tienen datos pendientes o sin contrastar con la fuente oficial, por lo que los cálculos salen como <b>PROVISIONALES</b>. <Link className="font-bold underline" href="/admin/parametros">Revisar y confirmar parámetros</Link>.
        </Alerta>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["BORRADOR", "CALCULADO", "REVISADO", "AUTORIZADO", "PAGADO"] as EstadoFiniquito[]).map((e, i) => (
          <Link key={e} href={qs({ estado: e, pagina: 1 })} className={`stat stat-${i} ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
            <b>{cuenta(e)}</b>
            <span>{ESTADO_LABEL[e]}</span>
          </Link>
        ))}
      </div>
      {Number(porPagar) > 0 && <p className="text-sm font-semibold">Autorizado pendiente de pago: <b>{money(porPagar)}</b> (monto total de los autorizados, antes de restar pagos parciales).</p>}

      <form className="card card-accent grid gap-3 pl-5 sm:grid-cols-6" action="/">
        <div className="sm:col-span-2"><label className="label">Trabajador, folio o puesto</label><input name="q" defaultValue={filtros.q} className="input" placeholder="Buscar…" /></div>
        <div><label className="label">Sucursal</label>
          <select name="sucursalId" defaultValue={filtros.sucursalId ?? ""} className="input"><option value="">Todas</option>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
        <div><label className="label">Estado</label>
          <select name="estado" defaultValue={estado ?? ""} className="input"><option value="">Todos</option>{Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label">Terminación desde</label><input type="date" name="desde" defaultValue={filtros.desde} className="input" /></div>
        <div><label className="label">hasta</label><input type="date" name="hasta" defaultValue={filtros.hasta} className="input" /></div>
        <div className="flex gap-2 sm:col-span-6"><button className="btn btn-dark btn-sm">Filtrar</button><Link href="/" className="btn btn-ghost btn-sm">Limpiar</Link></div>
      </form>

      <section className="space-y-3 sm:hidden">
        {lista.items.map((f) => (
          <Link key={f.id} href={`/finiquitos/${f.id}`} className={`row-card e-${f.estado}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-extrabold leading-tight">{f.trabajadorNombre}</p>
                <p className="text-xs text-muted">{f.puesto} · {f.sucursalNombre}</p>
              </div>
              <p className="whitespace-nowrap text-lg font-black">{money(f.totalNeto.toString())}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <EstadoChip estado={f.estado} /><CalculoChip estado={f.estadoCalculo} />
              <span className="ml-auto font-mono text-[11px] text-muted">{f.folio} · {fechaCorta(f.fechaTerminacion.toISOString().slice(0, 10))}</span>
            </div>
          </Link>
        ))}
        {!lista.items.length && <p className="card text-center text-muted">No hay finiquitos con esos filtros.</p>}
      </section>

      <section className="card hidden p-0 sm:block">
        <div className="table-wrap">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left text-xs uppercase tracking-wide text-muted">
                <th className="p-3">Folio</th><th className="p-3">Trabajador</th><th className="p-3">Sucursal</th><th className="p-3">Terminación</th><th className="p-3">Motivo</th><th className="p-3 text-right">Neto</th><th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.items.map((f) => (
                <tr key={f.id} className="border-b border-line hover:bg-fog">
                  <td className="p-3 font-mono text-xs"><Link className="font-bold underline" href={`/finiquitos/${f.id}`}>{f.folio}</Link></td>
                  <td className="p-3 font-semibold">{f.trabajadorNombre}<span className="block text-xs font-normal text-muted">{f.puesto}</span></td>
                  <td className="p-3">{f.sucursalNombre}</td>
                  <td className="p-3">{fechaCorta(f.fechaTerminacion.toISOString().slice(0, 10))}</td>
                  <td className="p-3 text-xs">{MOTIVO_LABEL[f.motivo as Motivo]?.split(" (")[0] ?? f.motivo}</td>
                  <td className="p-3 text-right font-bold">{money(f.totalNeto.toString())}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-1"><EstadoChip estado={f.estado} /><CalculoChip estado={f.estadoCalculo} /></div></td>
                </tr>
              ))}
              {!lista.items.length && <tr><td colSpan={7} className="p-8 text-center text-muted">No hay finiquitos con esos filtros. <Link href="/finiquitos/nuevo" className="font-bold underline">Crear el primero</Link></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm font-bold">
          {lista.pagina > 1 && <Link className="btn btn-ghost btn-sm" href={qs({ pagina: lista.pagina - 1 })}>← Anterior</Link>}
          <span>Página {lista.pagina} de {totalPaginas}</span>
          {lista.pagina < totalPaginas && <Link className="btn btn-ghost btn-sm" href={qs({ pagina: lista.pagina + 1 })}>Siguiente →</Link>}
        </div>
      )}
    </div>
  );
}
