"use client";
import { useState, useTransition } from "react";
import { saveField } from "@/app/actions";
import { Markdown } from "@/components/markdown";

export function DocEditor({ id, title, content, path }: { id: string; title: string; content: string; path: string }) {
  const [t, setT] = useState(title);
  const [c, setC] = useState(content);
  const [saved, setSaved] = useState(content);
  const [pending, start] = useTransition();
  const dirty = c !== saved;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <input className="field mb-3 font-serif text-2xl" value={t} onChange={(e) => setT(e.target.value)} onBlur={() => t !== title && start(() => saveField("documents", id, "title", t, path))} />
        <textarea className="input min-h-[60vh] font-mono text-[13px] leading-relaxed" value={c} onChange={(e) => setC(e.target.value)} />
        <div className="mt-3 flex items-center gap-3">
          <button className="btn btn-primary" disabled={!dirty || pending} onClick={() => start(async () => { await saveField("documents", id, "content", c, path); setSaved(c); })}>{pending ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
          <span className="text-xs text-ink-soft">## heading · ### subheading · - bullet · **bold** · _italic_. Saving returns the document to draft.</span>
        </div>
      </div>
      <div className="card p-8"><p className="label mb-2">Preview</p><h2 className="font-serif text-3xl">{t}</h2><Markdown text={c} className="mt-4 text-[15px]" /></div>
    </div>
  );
}
