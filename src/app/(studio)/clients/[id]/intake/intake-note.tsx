"use client";
import { useState, useTransition } from "react";
import { saveIntakeNote } from "@/app/actions";

export function IntakeNote({ submissionId, questionId, note, clarified, followup, path }: {
  submissionId: string; questionId: string; note: string; clarified: string; followup: boolean; path: string;
}) {
  const [open, setOpen] = useState(!!(note || clarified || followup));
  const [n, setN] = useState(note);
  const [c, setC] = useState(clarified);
  const [, start] = useTransition();
  const save = (field: "note" | "clarified_answer" | "needs_followup", v: string | boolean) =>
    start(() => saveIntakeNote(submissionId, questionId, field, v, path));
  if (!open) return <button className="text-xs text-mauve hover:underline" onClick={() => setOpen(true)}>+ Add note</button>;
  return (
    <div className="space-y-1.5 rounded-lg border border-line p-2 text-sm">
      <textarea className="field text-sm" rows={2} placeholder="Advisor note (private)" value={n} onChange={(e) => setN(e.target.value)} onBlur={() => n !== note && save("note", n)} />
      <textarea className="field text-sm" rows={2} placeholder="Clarified answer (from conversation)" value={c} onChange={(e) => setC(e.target.value)} onBlur={() => c !== clarified && save("clarified_answer", c)} />
      <label className="flex items-center gap-2 px-2 text-xs text-ink-soft">
        <input type="checkbox" defaultChecked={followup} className="accent-[#59445D]" onChange={(e) => save("needs_followup", e.target.checked)} /> Ask client to clarify
      </label>
    </div>
  );
}
