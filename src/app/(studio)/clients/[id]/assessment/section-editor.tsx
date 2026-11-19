"use client";
import { useState, useTransition } from "react";
import { saveAssessmentSection } from "@/app/actions";
import { Markdown } from "@/components/markdown";

export function SectionEditor({ assessmentId, sectionKey, text, path, plain }: { assessmentId: string; sectionKey: string; text: string; path: string; plain?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(text);
  const [pending, start] = useTransition();
  if (!editing) return (
    <div className="group relative">
      {plain ? <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{text}</pre> : <Markdown text={text} className="text-[15px]" />}
      <button className="mt-2 text-xs text-mauve hover:underline" onClick={() => setEditing(true)}>Edit</button>
    </div>
  );
  return (
    <div>
      <textarea className="input min-h-64 font-mono text-[13px] leading-relaxed" value={v} onChange={(e) => setV(e.target.value)} />
      <div className="mt-2 flex gap-2">
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => { await saveAssessmentSection(assessmentId, sectionKey, v, path); setEditing(false); })}>{pending ? "Saving…" : "Save"}</button>
        <button className="btn btn-ghost" onClick={() => { setV(text); setEditing(false); }}>Cancel</button>
      </div>
    </div>
  );
}
