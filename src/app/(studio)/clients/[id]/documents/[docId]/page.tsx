import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { approveDocument, deleteDocument, draftEmailForDocument } from "@/app/actions";
import { Status, Pill, fmtDateTime } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { DocEditor } from "./doc-editor";

export default async function Doc({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase.from("documents").select("*").eq("id", docId).eq("client_id", id).maybeSingle();
  if (!d) notFound();
  const P = `/clients/${id}/documents/${docId}`;
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/clients/${id}/documents`} className="text-mauve hover:underline">← Documents</Link>
          <Pill tone={d.audience === "client" ? "mauve" : "neutral"}>{d.audience === "client" ? "Client-facing" : "Internal"}</Pill>
          <Status value={d.status} />{d.approved_at && <span className="text-xs text-ink-soft">approved {fmtDateTime(d.approved_at)}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {d.status === "draft" && <ActionButton variant="primary" action={approveDocument.bind(null, d.id, P)}>Approve</ActionButton>}
          <a href={`/print/${d.id}`} target="_blank" className="btn btn-ghost">Preview & export PDF</a>
          {d.status === "approved" && d.audience === "client" && <ActionButton action={draftEmailForDocument.bind(null, d.id)}>Queue email to client</ActionButton>}
          <ActionButton action={deleteDocument.bind(null, d.id, id)} confirm="Delete this document?">Delete</ActionButton>
        </div>
      </div>
      <DocEditor id={d.id} title={d.title} content={d.content} path={P} />
    </div>
  );
}
