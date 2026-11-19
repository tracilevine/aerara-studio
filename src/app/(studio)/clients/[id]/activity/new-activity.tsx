"use client";
import { useRef, useTransition } from "react";
import { createRow } from "@/app/actions";

export function NewActivity({ clientId, path }: { clientId: string; path: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  return (
    <form ref={ref} className="grid gap-3 text-sm md:grid-cols-4" action={(fd) => start(async () => {
      const when = String(fd.get("occurred_at") || "");
      await createRow("activities", {
        client_id: clientId, activity_type: fd.get("activity_type"), title: fd.get("title"),
        occurred_at: when ? new Date(when).toISOString() : new Date().toISOString(),
        notes: fd.get("notes") || null, follow_up: fd.get("follow_up") || null, follow_up_due: fd.get("follow_up_due") || null,
      }, path);
      ref.current?.reset();
    })}>
      <select name="activity_type" className="input"><option value="meeting">Meeting</option><option value="note">Session note</option><option value="communication">Communication</option><option value="decision">Decision</option><option value="milestone">Milestone</option><option value="change">Change to recommendations</option></select>
      <input name="title" required placeholder="Title" className="input md:col-span-2" />
      <input name="occurred_at" type="datetime-local" className="input" title="Leave blank for now" />
      <textarea name="notes" placeholder="Notes (private to advisors)" rows={3} className="input md:col-span-4" />
      <input name="follow_up" placeholder="Follow-up action (optional)" className="input md:col-span-2" />
      <input name="follow_up_due" type="date" className="input" />
      <button className="btn btn-primary justify-center" disabled={pending}>{pending ? "Saving…" : "Log"}</button>
    </form>
  );
}
