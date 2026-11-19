import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setEmailStatus } from "@/app/actions";
import { Section, Empty, Pill, fmtDateTime } from "@/components/ui";
import { Editable } from "@/components/editable";
import { ActionButton } from "@/components/action-button";

export const dynamic = "force-dynamic";

const gmail = (to: string, su: string, body: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(body)}`;

export default async function Emails() {
  const supabase = await createClient();
  const [{ data: emails }, { data: clients }] = await Promise.all([
    supabase.from("email_drafts").select("*").neq("status", "discarded").order("created_at", { ascending: false }),
    supabase.from("clients").select("id,name"),
  ]);
  const C = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const pending = (emails ?? []).filter((e) => e.status !== "sent");
  const sent = (emails ?? []).filter((e) => e.status === "sent");
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="font-serif text-4xl">Emails</h1>
        <p className="mt-2 text-sm text-ink-soft">Nothing is sent automatically. Review, approve, then open in Gmail, attach the PDF, and send. Mark it sent here afterward.</p>
      </header>
      <Section title="To review and confirm">
        {!pending.length ? <Empty>Nothing waiting. Queue an email from an approved client document.</Empty> : pending.map((e) => (
          <div key={e.id} className="border-t border-line py-5 first:border-0 first:pt-0">
            <div className="mb-2 flex items-center justify-between">
              <Link href={`/clients/${e.client_id}/documents`} className="text-sm text-ink-soft hover:underline">{C.get(e.client_id)}</Link>
              <Pill tone={e.status === "approved" ? "done" : "clay"}>{e.status === "approved" ? "Approved — ready to send" : "Needs review"}</Pill>
            </div>
            <div className="grid gap-1 text-sm">
              <label className="flex items-center gap-2"><span className="w-16 text-ink-soft">To</span><Editable table="email_drafts" id={e.id} field="to_email" value={e.to_email} path="/emails" /></label>
              <label className="flex items-center gap-2"><span className="w-16 text-ink-soft">Subject</span><Editable table="email_drafts" id={e.id} field="subject" value={e.subject} path="/emails" /></label>
              <Editable table="email_drafts" id={e.id} field="body" value={e.body} type="textarea" rows={7} path="/emails" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {e.status === "needs_review" && <ActionButton variant="primary" action={setEmailStatus.bind(null, e.id, "approved")}>Approve</ActionButton>}
              {e.status === "approved" && <>
                <a className="btn btn-primary" target="_blank" href={gmail(e.to_email ?? "", e.subject, e.body)}>Open in Gmail</a>
                {e.document_id && <a className="btn btn-ghost" target="_blank" href={`/print/${e.document_id}`}>Open PDF to attach</a>}
                <ActionButton action={setEmailStatus.bind(null, e.id, "sent")}>Mark as sent</ActionButton>
              </>}
              <ActionButton action={setEmailStatus.bind(null, e.id, "discarded")} confirm="Discard this email?">Discard</ActionButton>
            </div>
          </div>
        ))}
      </Section>
      {!!sent.length && (
        <Section title="Sent">
          <ul className="divide-y divide-line text-sm">{sent.map((e) => <li key={e.id} className="flex justify-between py-2"><span>{e.subject} <span className="text-ink-soft">· {C.get(e.client_id)}</span></span><span className="text-xs text-ink-soft">{fmtDateTime(e.sent_at)}</span></li>)}</ul>
        </Section>
      )}
    </div>
  );
}
