"use client";
import { useRef, useTransition } from "react";
import { createRow } from "@/app/actions";

/** One-line "add" form for a child table. Extra fixed values merge in. */
export function AddRow({ table, fixed, placeholder, path, field = "title", extra }: {
  table: string; fixed: Record<string, unknown>; placeholder: string; path: string; field?: string;
  extra?: { name: string; options: { value: string; label: string }[] };
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  return (
    <form ref={ref} className="mt-3 flex gap-2" action={(fd) => start(async () => {
      const v = String(fd.get(field) || "").trim();
      if (!v) return;
      const values: Record<string, unknown> = { ...fixed, [field]: v };
      if (extra) values[extra.name] = fd.get(extra.name);
      await createRow(table, values, path);
      ref.current?.reset();
    })}>
      <input name={field} className="input flex-1" placeholder={placeholder} />
      {extra && <select name={extra.name} className="input w-auto">{extra.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
    </form>
  );
}
