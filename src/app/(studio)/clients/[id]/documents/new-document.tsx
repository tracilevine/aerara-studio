"use client";
import { useState, useTransition } from "react";
import { generateDocument } from "@/app/actions";
import type { DocType } from "@/lib/documents";

export function NewDocument({ clientId, types }: { clientId: string; types: { type: DocType; label: string }[] }) {
  const [type, setType] = useState<DocType>("assessment");
  const [audience, setAudience] = useState<"internal" | "client">("client");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value as DocType)}>{types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select>
      <select className="input w-auto" value={audience} onChange={(e) => setAudience(e.target.value as "internal" | "client")}><option value="client">Client-facing</option><option value="internal">Internal</option></select>
      <button className="btn btn-primary" disabled={pending} onClick={() => start(() => generateDocument(clientId, type, audience))}>{pending ? "Building…" : "Create"}</button>
    </div>
  );
}
