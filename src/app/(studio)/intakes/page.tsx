import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Section, Status, Empty, fmtDateTime } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Intakes() {
  const supabase = await createClient();
  const [{ data: subs }, { data: assessments }, { data: clients }] = await Promise.all([
    supabase.from("intake_submissions").select("id,client_id,tally_submission_id,source,submitted_at,reviewed").order("submitted_at", { ascending: false }),
    supabase.from("assessments").select("id,client_id,status,error,created_at").eq("status", "awaiting_review").order("created_at", { ascending: false }),
    supabase.from("clients").select("id,name,business_name"),
  ]);
  const C = new Map((clients ?? []).map((c) => [c.id, c]));
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="font-serif text-4xl">Intakes</h1>

      <Section title="Assessments awaiting review">
        {!assessments?.length ? <Empty>Nothing to review.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {assessments.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div><Link className="font-medium hover:underline" href={`/clients/${a.client_id}/assessment`}>{C.get(a.client_id)?.name}</Link>
                  {a.error && <div className="text-xs text-[#9A4B36]">{a.error}</div>}</div>
                <div className="flex items-center gap-3"><span className="text-xs text-ink-soft">{fmtDateTime(a.created_at)}</span><Status value={a.status} /></div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="All submissions">
        {!subs?.length ? <Empty>No intakes yet.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div><Link className="font-medium hover:underline" href={`/clients/${s.client_id}/intake`}>{C.get(s.client_id)?.name ?? "Unmatched"}</Link>
                  <div className="text-xs text-ink-soft">{C.get(s.client_id)?.business_name} · Tally {s.tally_submission_id} · {s.source.replace("_", " ")}</div></div>
                <div className="flex items-center gap-3"><span className="text-xs text-ink-soft">{fmtDateTime(s.submitted_at)}</span>{s.reviewed ? <Status value="completed" /> : <Status value="new" />}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

    </div>
  );
}
