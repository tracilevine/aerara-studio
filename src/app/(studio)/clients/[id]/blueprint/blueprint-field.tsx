"use client";
import { useState, useTransition } from "react";
import { saveBlueprintField } from "@/app/actions";

export function BlueprintField({ clientId, fieldKey, label, text, source, sources }: {
  clientId: string; fieldKey: string; label: string; text: string; source: string; sources: string[];
}) {
  const [t, setT] = useState(text);
  const [s, setS] = useState(source || "Client statement");
  const [pending, start] = useTransition();
  const save = (nt: string, ns: string) => start(() => saveBlueprintField(clientId, fieldKey, nt, ns));
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        <select className="rounded-full border border-line bg-transparent px-2 py-0.5 text-[11px] text-ink-soft" value={s} onChange={(e) => { setS(e.target.value); save(t, e.target.value); }}>
          {sources.map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>
      <textarea className="field mt-1 text-sm leading-relaxed" rows={3} value={t} placeholder="—" onChange={(e) => setT(e.target.value)} onBlur={() => t !== text && save(t, s)} />
      {pending && <i className="text-[11px] text-ink-soft">saving…</i>}
    </div>
  );
}
