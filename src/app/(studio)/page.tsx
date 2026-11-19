import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { clientStage, STAGES } from "@/lib/workflow";
import { Section, Status, Empty, Progress, Pill, fmtDate, fmtDateTime } from "@/components/ui";
import { upcomingEvents, matchClient, calendarConfigured } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export default async function Today() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [clients, subs, assessments, recs, tasks, meetings, followups, emails, recent, clarify] = await Promise.all([
    supabase.from("clients").select("id,name,email,business_name,engagement_status,next_action").neq("engagement_status", "archived").order("name"),
    supabase.from("intake_submissions").select("id,client_id,reviewed,submitted_at"),
    supabase.from("assessments").select("id,client_id,status,created_at"),
    supabase.from("recommendations").select("client_id,status"),
    supabase.from("tasks").select("id,client_id,title,status,owner_type,owner_name,due_date,phase,priority"),
    supabase.from("activities").select("id,client_id,title,occurred_at").eq("activity_type", "meeting").gte("occurred_at", nowIso).order("occurred_at").limit(10),
    supabase.from("activities").select("id,client_id,follow_up,follow_up_due").eq("follow_up_done", false).not("follow_up", "is", null).order("follow_up_due", { nullsFirst: false }),
    supabase.from("email_drafts").select("id,client_id,subject,status,created_at").in("status", ["needs_review", "approved"]).order("created_at"),
    supabase.from("activities").select("id,client_id,title,activity_type,occurred_at").order("occurred_at", { ascending: false }).limit(8),
    supabase.from("intake_notes").select("id,question_id,note,submission_id,intake_submissions(client_id)").eq("needs_followup", true),
  ]);

  const C = new Map((clients.data ?? []).map((c) => [c.id, c]));
  const name = (id: string) => C.get(id)?.name ?? "—";
  const rows = {
    submissions: subs.data ?? [], assessments: assessments.data ?? [],
    recommendations: recs.data ?? [], tasks: tasks.data ?? [],
  };
  const cal = await upcomingEvents();
  type Meeting = { key: string; title: string; at: string; clientId: string | null; link: string | null; source: "calendar" | "studio" };
  const allMeetings: Meeting[] = [
    ...cal.events.map((e) => ({ key: e.uid, title: e.title, at: e.start, clientId: matchClient(e, clients.data ?? [])?.id ?? null, link: e.link, source: "calendar" as const })),
    ...(meetings.data ?? []).map((m) => ({ key: m.id, title: m.title, at: m.occurred_at, clientId: m.client_id, link: null, source: "studio" as const })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const nextMeeting = new Map<string, string>();
  for (const m of allMeetings) if (m.clientId && !nextMeeting.has(m.clientId)) nextMeeting.set(m.clientId, m.at);

  const open = (t: { status: string }) => t.status !== "completed";
  const byDue = (a: { due_date: string | null }, b: { due_date: string | null }) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  const myTodos = (tasks.data ?? []).filter((t) => t.owner_type === "advisor" && open(t)).sort(byDue).slice(0, 10);
  const fromClients = (tasks.data ?? []).filter((t) => t.owner_type === "client" && open(t)).sort(byDue);
  const newIntakes = (subs.data ?? []).filter((s) => !s.reviewed);
  const toReview = (assessments.data ?? []).filter((a) => ["awaiting_review", "failed", "generating"].includes(a.status));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="label">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" })}</p>
        <h1 className="mt-2 font-serif text-4xl">Today</h1>
      </header>

      {(newIntakes.length > 0 || toReview.length > 0 || emails.data?.length) ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Attention href="/intakes" count={newIntakes.length} label="new intakes to review" />
          <Attention href="/intakes" count={toReview.length} label="assessments awaiting review" />
          <Attention href="/emails" count={emails.data?.length ?? 0} label="emails to review and confirm" />
        </div>
      ) : null}

      <Section title="Clients" action={<Link href="/clients" className="text-sm text-mauve hover:underline">All clients</Link>}>
        {!clients.data?.length ? <Empty>No clients yet. New Tally intakes appear here automatically.</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-soft"><th className="pb-2 font-normal">Client</th><th className="pb-2 font-normal">Where they are</th><th className="pb-2 font-normal w-40">Progress</th><th className="pb-2 font-normal">Next meeting</th><th className="pb-2 font-normal">Next action</th></tr></thead>
            <tbody>
              {clients.data.map((c) => {
                const s = clientStage(c.id, rows);
                return (
                  <tr key={c.id} className="border-t border-line align-top">
                    <td className="py-3 pr-4"><Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link><div className="text-ink-soft">{c.business_name}</div></td>
                    <td className="py-3 pr-4"><div>{s.stage}</div><div className="mt-1 flex gap-1">{STAGES.map((_, i) => <span key={i} className={`h-1 w-4 rounded-full ${i <= s.stageIndex ? "bg-mauve" : "bg-[#EEE5E0]"}`} />)}</div></td>
                    <td className="py-3 pr-4">{s.tasksTotal ? <><Progress value={s.progress} /><span className="text-xs text-ink-soft">{s.tasksDone}/{s.tasksTotal} tasks</span></> : <span className="text-ink-soft">—</span>}</td>
                    <td className="py-3 pr-4">{nextMeeting.get(c.id) ? fmtDateTime(nextMeeting.get(c.id)) : <span className="text-ink-soft">None scheduled</span>}</td>
                    <td className="py-3 text-ink-soft">{c.next_action ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="My to-dos">
          {!myTodos.length && !followups.data?.length ? <Empty>Nothing open.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {myTodos.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div><Link href={`/clients/${t.client_id}/roadmap`} className="hover:underline">{t.title}</Link><div className="text-xs text-ink-soft">{name(t.client_id)}</div></div>
                  <div className="shrink-0 text-right text-xs">{t.due_date && <div className={t.due_date < today ? "text-[#9A4B36]" : "text-ink-soft"}>{fmtDate(t.due_date)}</div>}<Status value={t.status} /></div>
                </li>
              ))}
              {(followups.data ?? []).map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div><Link href={`/clients/${f.client_id}/activity`} className="hover:underline">{f.follow_up}</Link><div className="text-xs text-ink-soft">Follow-up · {name(f.client_id)}</div></div>
                  {f.follow_up_due && <span className={`text-xs ${f.follow_up_due < today ? "text-[#9A4B36]" : "text-ink-soft"}`}>{fmtDate(f.follow_up_due)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Waiting on clients">
          {!fromClients.length && !clarify.data?.length ? <Empty>Nothing outstanding from clients.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {fromClients.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div><Link href={`/clients/${t.client_id}/roadmap`} className="hover:underline">{t.title}</Link><div className="text-xs text-ink-soft">{name(t.client_id)}</div></div>
                  <div className="shrink-0 text-right text-xs">{t.due_date && <div className="text-ink-soft">{fmtDate(t.due_date)}</div>}<Status value={t.status} /></div>
                </li>
              ))}
              {(clarify.data ?? []).map((n) => {
                const cid = (n.intake_submissions as unknown as { client_id: string } | null)?.client_id ?? "";
                return (
                  <li key={n.id} className="py-2.5">
                    <Link href={`/clients/${cid}/intake`} className="hover:underline">Clarify intake answer{n.note ? `: ${n.note}` : ""}</Link>
                    <div className="text-xs text-ink-soft">{name(cid)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Upcoming meetings" action={<span className="text-xs text-ink-soft">{calendarConfigured() ? (cal.error ? `Google Calendar: ${cal.error}` : "Google Calendar connected") : "Google Calendar not connected"}</span>}>
          {!allMeetings.length ? <Empty>No meetings in the next three weeks.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {allMeetings.slice(0, 10).map((m) => (
                <li key={m.key} className="flex justify-between gap-3 py-2.5">
                  <div>
                    {m.clientId ? <Link href={`/clients/${m.clientId}`} className="hover:underline">{m.title}</Link> : <span>{m.title}</span>}
                    <div className="text-xs text-ink-soft">{m.clientId ? name(m.clientId) : "Not matched to a client"}{m.link && <> · <a href={m.link} target="_blank" className="text-mauve hover:underline">Join</a></>}</div>
                  </div>
                  <span className="shrink-0 text-xs text-ink-soft">{fmtDateTime(m.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Emails to review" action={<Link href="/emails" className="text-sm text-mauve hover:underline">Open queue</Link>}>
          {!emails.data?.length ? <Empty>No emails waiting.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {emails.data.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 py-2.5">
                  <div><Link href="/emails" className="hover:underline">{e.subject}</Link><div className="text-xs text-ink-soft">{name(e.client_id)}</div></div>
                  <Pill tone={e.status === "approved" ? "done" : "clay"}>{e.status === "approved" ? "Ready to send" : "Needs review"}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Recent activity">
        {!recent.data?.length ? <Empty>No activity yet.</Empty> : (
          <ul className="space-y-2 text-sm">
            {recent.data.map((a) => (
              <li key={a.id} className="flex gap-4"><span className="w-28 shrink-0 text-ink-soft">{fmtDate(a.occurred_at, { month: "short", day: "numeric" })}</span><span>{a.title} <span className="text-ink-soft">· {name(a.client_id)}</span></span></li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Attention({ href, count, label }: { href: string; count: number; label: string }) {
  return (
    <Link href={href} className={`card flex items-baseline gap-3 p-5 transition hover:bg-white ${count ? "" : "opacity-60"}`}>
      <span className="font-serif text-4xl">{count}</span><span className="text-sm text-ink-soft">{label}</span>
    </Link>
  );
}
