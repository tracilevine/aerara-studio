"use client";
import { useState, useTransition } from "react";
import { saveField } from "@/app/actions";

type Opt = string | { value: string; label: string };
type Props = {
  table: string; id: string; field: string; value: unknown; path?: string;
  type?: "text" | "textarea" | "select" | "number" | "date" | "datetime" | "checkbox";
  options?: Opt[]; placeholder?: string; className?: string; rows?: number;
};

/** Inline field that saves on blur/change. Shows a quiet saved/error state. */
export function Editable({ table, id, field, value, path, type = "text", options, placeholder = "—", className = "", rows = 3 }: Props) {
  const initial = value == null ? "" : type === "datetime" && typeof value === "string" ? toLocalInput(value) : String(value);
  const [v, setV] = useState(initial);
  const [last, setLast] = useState(initial);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();

  const commit = (next: string | boolean) => {
    const s = String(next);
    if (s === last) return;
    start(async () => {
      try {
        let out: unknown = next;
        if (type === "number") out = s === "" ? null : Number(s);
        if (type === "datetime") out = s ? new Date(s).toISOString() : null;
        await saveField(table, id, field, out, path);
        setLast(s); setState("saved"); setTimeout(() => setState("idle"), 1200);
      } catch { setState("error"); }
    });
  };

  const cls = `field ${className}`;
  const marker = pending ? <i className="ml-1 text-[11px] text-ink-soft">saving…</i>
    : state === "saved" ? <i className="ml-1 text-[11px] text-[#56684A]">saved</i>
    : state === "error" ? <i className="ml-1 text-[11px] text-[#9A4B36]">not saved — retry</i> : null;

  if (type === "checkbox") {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v === "true"} onChange={(e) => { setV(String(e.target.checked)); commit(e.target.checked); }} className="accent-[#59445D]" />
        {marker}
      </label>
    );
  }
  if (type === "select") {
    return (
      <span className="inline-flex items-center">
        <select className={cls} value={v} onChange={(e) => { setV(e.target.value); commit(e.target.value); }}>
          <option value="">{placeholder}</option>
          {options?.map((o) => {
            const ov = typeof o === "string" ? o : o.value;
            const ol = typeof o === "string" ? o.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : o.label;
            return <option key={ov} value={ov}>{ol}</option>;
          })}
        </select>{marker}
      </span>
    );
  }
  if (type === "textarea") {
    return (
      <div>
        <textarea className={`${cls} resize-y leading-relaxed`} rows={rows} value={v} placeholder={placeholder}
          onChange={(e) => setV(e.target.value)} onBlur={() => commit(v)} />
        {marker}
      </div>
    );
  }
  return (
    <span className="inline-flex w-full items-center">
      <input className={cls} placeholder={placeholder} value={v}
        type={type === "datetime" ? "datetime-local" : type === "date" ? "date" : type === "number" ? "number" : "text"}
        onChange={(e) => setV(e.target.value)} onBlur={() => commit(v)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      {marker}
    </span>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
