import { createClient } from "@/lib/supabase/server";
import { deleteRow, moveRow, recommendationToTask } from "@/app/actions";
import { Section, Empty, Status, Pill } from "@/components/ui";
import { Editable } from "@/components/editable";
import { AddRow } from "@/components/add-row";
import { ActionButton } from "@/components/action-button";

const TEXT = [["issue", "Identified issue"], ["evidence", "Supporting evidence"], ["solution", "Proposed solution"], ["benefit", "Expected benefit"], ["dependencies", "Dependencies"], ["advisor_notes", "Advisor notes (internal)"]] as const;

export default async function Recommendations({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: recs }, { data: tasks }] = await Promise.all([
    supabase.from("recommendations").select("*").eq("client_id", id).order("sort_order"),
    supabase.from("tasks").select("recommendation_id").eq("client_id", id).not("recommendation_id", "is", null),
  ]);
  const onRoadmap = new Set((tasks ?? []).map((t) => t.recommendation_id));
  const P = `/clients/${id}/recommendations`;
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">Approve a recommendation to move it onto the roadmap. Only approved items appear in client-facing documents.</p>
      {!recs?.length && <Section title="Recommendations"><Empty>None yet. Pull them from the Assessment tab or add one below.</Empty></Section>}
      {(recs ?? []).map((r) => (
        <Section key={r.id} title={r.title} action={
          <div className="flex flex-wrap items-center gap-2">
            <Status value={r.priority} />
            <span className="w-32"><Editable table="recommendations" id={r.id} field="status" value={r.status} type="select" options={["proposed", "approved", "declined", "done"]} path={P} /></span>
            {r.status === "approved" && (onRoadmap.has(r.id) ? <Pill tone="done">On roadmap</Pill> : <ActionButton variant="primary" action={recommendationToTask.bind(null, r.id)}>Add to roadmap</ActionButton>)}
            <ActionButton action={moveRow.bind(null, "recommendations", r.id, "up", P)} className="px-2">↑</ActionButton>
            <ActionButton action={deleteRow.bind(null, "recommendations", r.id, P)} confirm="Delete this recommendation?" className="px-2">✕</ActionButton>
          </div>}>
          <div className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-4">
            <div className="md:col-span-2"><p className="label">Title</p><Editable table="recommendations" id={r.id} field="title" value={r.title} path={P} /></div>
            <div><p className="label">Category</p><Editable table="recommendations" id={r.id} field="category" value={r.category} path={P} /></div>
            <div><p className="label">Estimated cost</p><Editable table="recommendations" id={r.id} field="estimated_cost" value={r.estimated_cost} path={P} /></div>
            <div><p className="label">Priority</p><Editable table="recommendations" id={r.id} field="priority" value={r.priority} type="select" options={["high", "medium", "low"]} path={P} /></div>
            <div><p className="label">Effort</p><Editable table="recommendations" id={r.id} field="effort" value={r.effort} type="select" options={["low", "medium", "high"]} path={P} /></div>
            {TEXT.map(([f, l]) => <div key={f} className="md:col-span-2"><p className="label">{l}</p><Editable table="recommendations" id={r.id} field={f} value={r[f]} type="textarea" rows={2} path={P} /></div>)}
          </div>
        </Section>
      ))}
      <Section title="Add recommendation"><AddRow table="recommendations" fixed={{ client_id: id, status: "proposed", priority: "medium" }} placeholder="Recommendation title" path={P} /></Section>
    </div>
  );
}
