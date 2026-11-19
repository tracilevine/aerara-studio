"use client";
import { useState, useTransition } from "react";
import { importFromTally, importPasted, type ImportResult } from "@/app/actions";
import { Section } from "@/components/ui";

export function ImportPanel({ apiKey }: { apiKey: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ImportResult | null>(null);
  const [text, setText] = useState("");
  const show = (r: ImportResult) => setRes(r);
  return (
    <Section title="Import from Tally">
      <p className="mb-4 text-sm text-ink-soft">New submissions arrive automatically through the Tally webhook. Use these if a delivery was missed. Duplicates are skipped by submission ID.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending || !apiKey} onClick={() => start(async () => show(await importFromTally()))}>
          {pending ? "Importing…" : "Sync from Tally"}
        </button>
        {!apiKey && <span className="text-xs text-ink-soft">Add TALLY_API_KEY to enable sync.</span>}
      </div>
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-mauve">Paste JSON instead</summary>
        <textarea className="input mt-3 h-40 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"questions":[…],"submissions":[…]}' />
        <button className="btn btn-ghost mt-2" disabled={pending || !text} onClick={() => start(async () => show(await importPasted(text)))}>Import pasted JSON</button>
      </details>
      {res && (
        <p className="mt-4 text-sm">
          {res.created} new · {res.duplicates} already saved · {res.skipped} skipped
          {res.errors.map((e, i) => <span key={i} className="block text-[#9A4B36]">{e}</span>)}
        </p>
      )}
    </Section>
  );
}
