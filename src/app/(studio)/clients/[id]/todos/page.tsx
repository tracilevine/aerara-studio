import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Empty, Section, Status, fmtDate } from "@/components/ui";
import { AddTodos, TodoCheckbox } from "./todo-controls";

export default async function Todos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: tasks, error } = await supabase.from("tasks")
    .select("id,title,status,due_date,owner_type,owner_name").eq("client_id", id)
    .order("sort_order").order("id");

  const items = tasks ?? [];
  const completed = items.filter((task) => task.status === "completed").length;

  return (
    <div className="space-y-6">
      <Section title="To-dos" action={<Link className="text-sm underline" href={`/clients/${id}/roadmap`}>Edit tasks in Roadmap</Link>}>
        <AddTodos clientId={id} />
      </Section>
      <Section title="Checklist" action={<span className="text-sm text-ink-soft">{completed} of {items.length} complete</span>}>
        {error ? <p role="alert">Couldn’t load this client’s checklist.</p> : !items.length ? <Empty>No to-dos yet.</Empty> : (
          <ul className="divide-y divide-line">
            {[...items.filter((task) => task.status !== "completed"), ...items.filter((task) => task.status === "completed")].map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <TodoCheckbox clientId={id} id={task.id} title={task.title} completed={task.status === "completed"} />
                <div className="flex items-center gap-2 text-xs text-ink-soft">
                  {task.owner_name || (task.owner_type === "client" ? "Client" : task.owner_type === "advisor" ? "Advisor" : "Other")}
                  {task.due_date && <span>Due {fmtDate(task.due_date + "T12:00:00")}</span>}
                  {task.status !== "not_started" && task.status !== "completed" && <Status value={task.status} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
