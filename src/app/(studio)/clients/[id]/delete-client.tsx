"use client";
import { useState, useTransition } from "react";
import { deleteClient } from "@/app/actions";

export function DeleteClient({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  if (!open) return <button className="text-xs text-[#9A4B36] hover:underline" onClick={() => setOpen(true)}>Delete client and all records…</button>;
  return (
    <div className="w-full space-y-2">
      <p className="text-xs text-[#9A4B36]">This permanently deletes every intake, assessment, note and document. Type <b>{name}</b> to confirm.</p>
      <input className="input" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn btn-ghost text-[#9A4B36]" disabled={v !== name || pending}
        onClick={() => start(async () => { try { await deleteClient(id, v); } catch (e) { if (!(e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) setErr((e as Error).message); else throw e; } })}>
        {pending ? "Deleting…" : "Delete permanently"}
      </button>
      {err && <p className="text-xs text-[#9A4B36]">{err}</p>}
    </div>
  );
}
