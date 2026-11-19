import { createClient } from "@/lib/supabase/server";
import { deleteRow, moveRow } from "@/app/actions";
import { Section, Empty, Progress } from "@/components/ui";
import { Editable } from "@/components/editable";
import { AddRow } from "@/components/add-row";
import { ActionButton } from "@/components/action-button";

const PHASES = [["30", "First 30 days", "Stabilize"], ["60", "Days 31–60", "Build"], ["90", "Days 61–90", "Optimize"], ["later", "Later", "Backlog"]] as const;

export default async function Roadmap({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: tasks } = await supabase.from("tasks").select("*").eq("client_id", id).order("sort_order");
  const P = `/clients/${id}/roadmap`;
  const all = tasks ?? [];
  const done = all.filter((t) => t.status === "completed").length;
  return (
    <div className="space-y-6">
      <div className="card p-5"><div className="mb-2 flex justify-between text-sm"><span>{done} of {all.length} complete</span><span className="text-ink-soft">{all.filter((t) => t.owner_type === "client" && t.status !== "completed").length} waiting on client</span></div><Progress value={all.length ? (done / all.length) * 100 : 0} /></div>
      {PHASES.map(([ph, label, theme]) => {
        const items = all.filter((t) => t.phase === ph);
        const pd = items.filter((t) => t.status === "completed").length;
        return (
          <Section key={ph} title={`${label} · ${theme}`} action={<span className="text-xs text-ink-soft">{pd}/{items.length}</span>}>
            {!items.length ? <Empty>No items.</Empty> : (
              <div className="space-y-2">
                {items.map((t) => (
                  <details key={t.id} className={`rounded-xl border border-line ${t.status === "completed" ? "opacity-60" : ""}`}>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3">
                      <span className="w-32"><Editable table="tasks" id={t.id} field="status" value={t.status} type="select" options={["not_started", "in_progress", "waiting", "completed"]} path={P} /></span>
                      <span className="min-w-48 flex-1 font-medium">{t.is_milestone && "◆ "}{t.title}</span>
                      <span className="text-xs text-ink-soft">{t.owner_type === "client" ? "Client" : t.owner_type === "advisor" ? "Advisor" : t.owner_name || "Other"}{t.due_date ? ` · due ${t.due_date}` : ""}</span>
                      <ActionButton action={moveRow.bind(null, "tasks", t.id, "up", P)} className="px-2">↑</ActionButton>
                      <ActionButton action={moveRow.bind(null, "tasks", t.id, "down", P)} className="px-2">↓</ActionButton>
                    </summary>
                    <div className="grid gap-x-4 gap-y-1 border-t border-line p-3 text-sm md:grid-cols-4">
                      <div className="md:col-span-2"><p className="label">Title</p><Editable table="tasks" id={t.id} field="title" value={t.title} path={P} /></div>
                      <div><p className="label">Phase</p><Editable table="tasks" id={t.id} field="phase" value={t.phase} type="select" options={[{ value: "30", label: "0–30" }, { value: "60", label: "31–60" }, { value: "90", label: "61–90" }, { value: "later", label: "Later" }]} path={P} /></div>
                      <div><p className="label">Due</p><Editable table="tasks" id={t.id} field="due_date" value={t.due_date} type="date" path={P} /></div>
                      <div><p className="label">Owner</p><Editable table="tasks" id={t.id} field="owner_type" value={t.owner_type} type="select" options={["advisor", "client", "other"]} path={P} /></div>
                      <div><p className="label">Owner name</p><Editable table="tasks" id={t.id} field="owner_name" value={t.owner_name} path={P} /></div>
                      <div><p className="label">Priority</p><Editable table="tasks" id={t.id} field="priority" value={t.priority} type="select" options={["high", "medium", "low"]} path={P} /></div>
                      <div><p className="label">Milestone</p><Editable table="tasks" id={t.id} field="is_milestone" value={t.is_milestone} type="checkbox" path={P} /></div>
                      <div><p className="label">Effort</p><Editable table="tasks" id={t.id} field="effort" value={t.effort} path={P} /></div>
                      <div><p className="label">Estimated cost</p><Editable table="tasks" id={t.id} field="estimated_cost" value={t.estimated_cost} path={P} /></div>
                      <div className="md:col-span-2"><p className="label">Depends on</p><Editable table="tasks" id={t.id} field="depends_on" value={t.depends_on} path={P} /></div>
                      <div className="md:col-span-2"><p className="label">Intended outcome</p><Editable table="tasks" id={t.id} field="description" value={t.description} type="textarea" rows={2} path={P} /></div>
                      <div className="md:col-span-2"><p className="label">Success criteria</p><Editable table="tasks" id={t.id} field="success_criteria" value={t.success_criteria} type="textarea" rows={2} path={P} /></div>
                      <div className="md:col-span-4 text-right"><ActionButton action={deleteRow.bind(null, "tasks", t.id, P)} confirm="Remove this task?">Remove</ActionButton></div>
                    </div>
                  </details>
                ))}
              </div>
            )}
            <AddRow table="tasks" fixed={{ client_id: id, phase: ph }} placeholder="Add a task" path={P}
              extra={{ name: "owner_type", options: [{ value: "advisor", label: "Advisor" }, { value: "client", label: "Client" }, { value: "other", label: "Other" }] }} />
          </Section>
        );
      })}
    </div>
  );
}
