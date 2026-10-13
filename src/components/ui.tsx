"use client";
import { ESTADO_LABEL, ESTADO_STYLE } from "@/lib/estados";
import { useId, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Field({ label, hint, error, children, className = "" }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="errtxt">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Input({ error, ...p }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input {...p} className={`input ${error ? "err" : ""} ${p.className ?? ""}`} />;
}

export function Money({ value, onChange, error, placeholder = "0.00", ...p }: { value: string; onChange: (v: string) => void; error?: boolean; placeholder?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">$</span>
      <input
        {...p}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
        className={`input pl-7 ${error ? "err" : ""}`}
      />
    </div>
  );
}

export function Num({ value, onChange, error, suffix, ...p }: { value: string; onChange: (v: string) => void; error?: boolean; suffix?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="relative">
      <input {...p} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} className={`input ${suffix ? "pr-14" : ""} ${error ? "err" : ""}`} />
      {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">{suffix}</span> : null}
    </div>
  );
}

export function Select({ error, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select {...p} className={`input ${error ? "err" : ""} ${p.className ?? ""}`}>
      {children}
    </select>
  );
}

export function Textarea({ error, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea {...p} className={`input min-h-24 ${error ? "err" : ""} ${p.className ?? ""}`} />;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3 hover:border-ink">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 flex-none accent-[#0b0b0c]" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="hint block">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Alerta({ tipo = "info", titulo, children }: { tipo?: "info" | "warn" | "error" | "ok"; titulo?: ReactNode; children?: ReactNode }) {
  const c = { info: "border-ink bg-sun-soft", warn: "border-sun-deep bg-sun-soft", error: "border-fire bg-fire-soft text-[#7a1014]", ok: "border-ok bg-ok-soft text-[#14502a]" }[tipo];
  return (
    <div className={`rounded-xl border-l-4 p-3 text-sm ${c}`}>
      {titulo ? <p className="font-bold">{titulo}</p> : null}
      {children ? <div className={titulo ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

export function Seccion({ titulo, descripcion, children, abierta = true, derecha }: { titulo: ReactNode; descripcion?: ReactNode; children: ReactNode; abierta?: boolean; derecha?: ReactNode }) {
  return (
    <details open={abierta} className="card card-accent group pl-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold">{titulo}</h3>
          {descripcion ? <p className="hint">{descripcion}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {derecha}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xl font-black text-sun transition group-open:rotate-45">+</span>
        </div>
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}


export function EstadoChip({ estado }: { estado: string }) {
  return <span className={`chip ${ESTADO_STYLE[estado] ?? ""}`}>{ESTADO_LABEL[estado] ?? estado}</span>;
}

export function CalculoChip({ estado }: { estado: string }) {
  const m: Record<string, [string, string]> = {
    DEFINITIVO: ["Sin pendientes", "bg-ok-soft text-ok border-ok"],
    PROVISIONAL: ["Provisional", "bg-sun-soft text-[#7a5600] border-sun-deep"],
    INCOMPLETO: ["Incompleto", "bg-fire-soft text-fire border-fire"],
  };
  const [t, c] = m[estado] ?? [estado, ""];
  return <span className={`chip ${c}`}>{t}</span>;
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`inline-block rounded-md border-b-4 border-fire bg-ink font-black tracking-wider text-sun ${small ? "px-2.5 py-1 text-base" : "px-4 py-2 text-2xl"}`}>FATBOY</span>
  );
}
