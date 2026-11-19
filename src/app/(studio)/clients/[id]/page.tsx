import Link from "next/link";
import { createClient, getAdvisor } from "@/lib/supabase/server";
import { clientStage, STAGES } from "@/lib/workflow";
import { Section, Status, Progress, Empty, fmtDateTime } from "@/components/ui";
import { Editable } from "@/components/editable";
import { DeleteClient } from "./delete-client";

export default async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const advisor = await getAdvisor();
  const [{ data: c }, s, a, r, t, { data: meeting }, { data: docs }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("intake_submissions").select("client_id,reviewed").eq("client_id", id),
    supabase.from("assessments").select("id,client_id,status").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("recommendations").select("client_id,status").eq("client_id", id),
    supabase.from("tasks").select("id,client_id,status,title,owner_type,due_date").eq("client_id", id),
    supabase.from("activities").select("title,occurred_at").eq("client_id", id).eq("activity_type", "meeting").gte("occurred_at", new Date().toISOString()).order("occurred_at").limit(1).maybeSingle(),
    supabase.from("documents").select("id,title,status").eq("client_id", id).order("updated_at", { ascending: false }).limit(4),
  ]);
  const st = clientStage(id, { submissions: s.data ?? [], assessments: a.data ?? [], recommendations: r.data ?? [], tasks: t.data ?? [] });
  const P = `/clients/${id}`;
  const E = (field: string, type?: "textarea" | "select", options?: string[]) =>
    <Editable table="clients" id={id} field={field} value={(c as Record<string, unknown>)[field]} path={P} type={type} options={options} rows={3} />;
  const openTasks = (t.data ?? []).filter((x) => x.status !== "completed").slice(0, 5);

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        <Section title="Where things stand">
          <div className="mb-3 flex gap-1.5">{STAGES.map((x, i) => <div key={x} className="flex-1"><div className={`h-1 rounded-full ${i <= st.stageIndex ? "bg-mauve" : "bg-[#EEE5E0]"}`} /><p className={`mt-1.5 text-[11px] ${i === st.stageIndex ? "text-plum font-medium" : "text-ink-soft"}`}>{x}</p></div>)}</div>
          {st.tasksTotal > 0 && <div className="mt-4"><Progress value={st.progress} /><p className="mt-1 text-xs text-ink-soft">{st.tasksDone} of {st.tasksTotal} roadmap items complete</p></div>}
          <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
            <div><p className="label">Next meeting</p><p className="px-2 py-1.5">{meeting ? `${fmtDateTime(meeting.occurred_at)} · ${meeting.title}` : <Link href={`${P}/activity`} className="text-mauve hover:underline">Schedule one</Link>}</p></div>
            <div><p className="label">Next action</p>{E("next_action")}</div>
            <div><p className="label">Engagement</p>{E("engagement_name")}</div>
            <div><p className="label">Status</p>{E("engagement_status", "select", ["new", "onboarding", "active", "paused", "completed", "archived"])}</div>
          </div>
        </Section>
        <Section title="Business">
          <div className="space-y-3 text-sm">
            {([["business_description", "Business description"], ["business_stage", "Business stage"], ["vision", "Vision"], ["goals", "Goals"], ["challenges", "Key challenges"]] as const).map(([f, l]) => (
              <div key={f}><p className="label">{l}</p>{E(f, "textarea")}</div>
            ))}
          </div>
        </Section>
      </div>
      <div className="space-y-8">
        <Section title="Contact">
          <div className="space-y-1 text-sm">
            {([["name", "Name"], ["business_name", "Business"], ["email", "Email"], ["phone", "Phone"], ["website", "Website"], ["location", "Location"]] as const).map(([f, l]) => (
              <div key={f} className="flex items-center gap-2"><span className="w-20 shrink-0 text-ink-soft">{l}</span>{E(f)}</div>
            ))}
          </div>
        </Section>
        <Section title="Quick access">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><Link href={`${P}/assessment`} className="hover:underline">Assessment</Link><Status value={a.data?.[0]?.status ?? null} /></li>
            <li><Link href={`${P}/recommendations`} className="hover:underline">Recommendations ({r.data?.length ?? 0})</Link></li>
            {(docs ?? []).map((d) => <li key={d.id} className="flex justify-between"><Link href={`${P}/documents/${d.id}`} className="hover:underline">{d.title}</Link><Status value={d.status} /></li>)}
          </ul>
        </Section>
        <Section title="Open tasks">
          {!openTasks.length ? <Empty>No open tasks.</Empty> : (
            <ul className="space-y-2 text-sm">{openTasks.map((x) => <li key={x.id} className="flex justify-between gap-2"><span>{x.title}<span className="block text-xs text-ink-soft">{x.owner_type === "client" ? "Client" : "Advisor"}</span></span><Status value={x.status} /></li>)}</ul>
          )}
        </Section>
        <Section title="Data">
          <div className="flex flex-col items-start gap-2 text-sm">
            <a href={`/api/clients/${id}/export`} className="text-mauve hover:underline">Export all client data (JSON)</a>
            {advisor?.role === "owner" && <DeleteClient id={id} name={c.name} />}
          </div>
        </Section>
      </div>
    </div>
  );
}
