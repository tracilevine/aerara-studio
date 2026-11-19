import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addClient } from "@/app/actions";
import { clientStage } from "@/lib/workflow";
import { Section, Status, Progress, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("clients").select("id,client_number,name,business_name,email,engagement_status,is_demo").order("client_number");
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,business_name.ilike.%${q.replace(/[%,()]/g, "")}%,email.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const [{ data: clients }, s, a, r, t] = await Promise.all([
    query,
    supabase.from("intake_submissions").select("client_id,reviewed"),
    supabase.from("assessments").select("client_id,status"),
    supabase.from("recommendations").select("client_id,status"),
    supabase.from("tasks").select("client_id,status"),
  ]);
  const rows = { submissions: s.data ?? [], assessments: a.data ?? [], recommendations: r.data ?? [], tasks: t.data ?? [] };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex items-end justify-between">
        <h1 className="font-serif text-4xl">Clients</h1>
        <form className="w-72"><input name="q" defaultValue={q} placeholder="Search name, business, email" className="input" /></form>
      </header>
      <Section title="Directory">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ink-soft"><th className="pb-2 font-normal">#</th><th className="pb-2 font-normal">Client</th><th className="pb-2 font-normal">Stage</th><th className="pb-2 font-normal w-40">Progress</th><th className="pb-2 font-normal">Engagement</th></tr></thead>
          <tbody>
            {(clients ?? []).map((c) => {
              const st = clientStage(c.id, rows);
              return (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-3 pr-3 text-ink-soft">{String(c.client_number).padStart(3, "0")}</td>
                  <td className="py-3 pr-4"><Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link> {c.is_demo && <Pill tone="alert">Demo</Pill>}<div className="text-ink-soft">{c.business_name} {c.email && `· ${c.email}`}</div></td>
                  <td className="py-3 pr-4">{st.stage}</td>
                  <td className="py-3 pr-4">{st.tasksTotal ? <Progress value={st.progress} /> : <span className="text-ink-soft">—</span>}</td>
                  <td className="py-3"><Status value={c.engagement_status} /></td>
                </tr>
              );
            })}
            {!clients?.length && <tr><td colSpan={5} className="py-6 text-ink-soft">No clients match.</td></tr>}
          </tbody>
        </table>
      </Section>
      <Section title="Add client">
        <p className="mb-4 text-sm text-ink-soft">Intakes create clients automatically. Use this for someone who hasn’t filled out the form yet.</p>
        <form action={addClient} className="grid gap-3 md:grid-cols-4">
          <input name="name" required placeholder="Full name" className="input" />
          <input name="business_name" placeholder="Business" className="input" />
          <input name="email" type="email" placeholder="Email" className="input" />
          <button className="btn btn-primary justify-center">Add client</button>
        </form>
      </Section>
    </div>
  );
}
