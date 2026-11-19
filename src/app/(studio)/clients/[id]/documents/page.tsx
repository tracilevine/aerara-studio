import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DOC_TYPES } from "@/lib/documents";
import { Section, Status, Pill, Empty, fmtDate } from "@/components/ui";
import { NewDocument } from "./new-document";

export default async function Documents({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: docs } = await supabase.from("documents").select("id,title,doc_type,audience,status,updated_at").eq("client_id", id).order("updated_at", { ascending: false });
  return (
    <div className="space-y-6">
      <Section title="Generate a document">
        <p className="mb-4 text-sm text-ink-soft">Built from this client’s current records. Client versions leave out private notes, birth details, unapproved recommendations and first-meeting questions. Edit freely before approving.</p>
        <NewDocument clientId={id} types={DOC_TYPES} />
      </Section>
      <Section title="Documents">
        {!docs?.length ? <Empty>No documents yet.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-3">
                <Link href={`/clients/${id}/documents/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                <div className="flex items-center gap-2"><Pill tone={d.audience === "client" ? "mauve" : "neutral"}>{d.audience === "client" ? "Client-facing" : "Internal"}</Pill><Status value={d.status} /><span className="w-24 text-right text-xs text-ink-soft">{fmtDate(d.updated_at)}</span></div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
