"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  lista: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>,
  mas: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  ley: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M5 7h14M5 7l-3 8a4 4 0 0 0 6 0L5 7zm14 0l-3 8a4 4 0 0 0 6 0l-3-8z" /></svg>,
  emp: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6" /></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>,
};

export function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === "/" || path.startsWith("/finiquitos/") && !path.startsWith("/finiquitos/nuevo") : path.startsWith(h));
  const items = [
    { h: "/", t: "Finiquitos", i: I.lista },
    { h: "/finiquitos/nuevo", t: "Nuevo", i: I.mas },
    ...(admin ? [{ h: "/admin/parametros", t: "Parámetros", i: I.ley }, { h: "/admin/empresa", t: "Empresa", i: I.emp }, { h: "/admin/usuarios", t: "Usuarios", i: I.user }] : []),
  ];
  return (
    <>
      <nav className="hidden items-center gap-1 text-sm lg:flex">
        {items.map((x) => <Link key={x.h} href={x.h} className={`nav-link ${on(x.h) ? "on" : ""}`}>{x.t === "Nuevo" ? "+ Nuevo cálculo" : x.t === "Parámetros" ? "Parámetros legales" : x.t}</Link>)}
      </nav>
      <nav className="tabbar no-print lg:hidden" style={{ gridTemplateColumns: `repeat(${items.length},1fr)` }}>
        {items.map((x) => <Link key={x.h} href={x.h} className={on(x.h) ? "on" : ""}>{x.i}{x.t}</Link>)}
      </nav>
    </>
  );
}
