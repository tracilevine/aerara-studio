import { createClient } from "@/lib/supabase/server";
import { deleteRow } from "@/app/actions";
import { Section, Empty, Pill, human, fmtDateTime } from "@/components/ui";
import { Editable } from "@/components/editable";
import { ActionButton } from "@/components/action-button";
import { NewActivity } from "./new-activity";

export default async function Activity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: acts } = await supabase.from("activities").select("*").eq("client_id", id).order("occurred_at", { ascending: false });
  const P = `/clients/${id}/activity`;
  const now = new Date().toISOString();
  const upcoming = (acts ?? []).filter((a) => a.occurred_at > now).reverse();
  const past = (acts ?? []).filter((a) => a.occurred_at <= now);
  const Item = ({ a }: { a: NonNullable<typeof acts>[number] }) => (
    <details className="rounded-xl border border-line">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-3 text-sm">
        <span className="w-44 shrink-0 text-ink-soft">{fmtDateTime(a.occurred_at)}</span>
        <Pill tone={a.activity_type === "meeting" ? "plum" : a.activity_type === "decision" ? "clay" : "neutral"}>{human(a.activity_type)}</Pill>
        <span className="flex-1 font-medium">{a.title}</span>
        {a.follow_up && !a.follow_up_done && <Pill tone="clay">Follow-up open</Pill>}
        {a.is_private && <span className="text-xs text-ink-soft">Private</span>}
      </summary>
      <div className="grid gap-x-4 gap-y-1 border-t border-line p-3 text-sm md:grid-cols-4">
        <div className="md:col-span-2"><p className="label">Title</p><Editable table="activities" id={a.id} field="title" value={a.title} path={P} /></div>
        <div><p className="label">When</p><Editable table="activities" id={a.id} field="occurred_at" value={a.occurred_at} type="datetime" path={P} /></div>
        <div><p className="label">Type</p><Editable table="activities" id={a.id} field="activity_type" value={a.activity_type} type="select" options={["meeting", "note", "communication", "decision", "milestone", "change"]} path={P} /></div>
        <div className="md:col-span-4"><p className="label">Notes</p><Editable table="activities" id={a.id} field="notes" value={a.notes} type="textarea" rows={4} path={P} /></div>
        <div className="md:col-span-2"><p className="label">Follow-up action</p><Editable table="activities" id={a.id} field="follow_up" value={a.follow_up} path={P} /></div>
        <div><p className="label">Follow-up due</p><Editable table="activities" id={a.id} field="follow_up_due" value={a.follow_up_due} type="date" path={P} /></div>
        <div className="flex gap-6"><div><p className="label">Done</p><Editable table="activities" id={a.id} field="follow_up_done" value={a.follow_up_done} type="checkbox" path={P} /></div><div><p className="label">Private</p><Editable table="activities" id={a.id} field="is_private" value={a.is_private} type="checkbox" path={P} /></div></div>
        <div className="md:col-span-4 text-right"><ActionButton action={deleteRow.bind(null, "activities", a.id, P)} confirm="Delete this entry?">Delete</ActionButton></div>
      </div>
    </details>
  );
  return (
    <div className="space-y-6">
      <Section title="Log activity"><NewActivity clientId={id} path={P} /></Section>
      {upcoming.length > 0 && <Section title="Upcoming"><div className="space-y-2">{upcoming.map((a) => <Item key={a.id} a={a} />)}</div></Section>}
      <Section title="History">{!past.length ? <Empty>Nothing logged yet.</Empty> : <div className="space-y-2">{past.map((a) => <Item key={a.id} a={a} />)}</div>}</Section>
    </div>
  );
}
