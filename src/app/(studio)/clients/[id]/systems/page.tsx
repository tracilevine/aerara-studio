import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteRow, moveRow } from "@/app/actions";
import { Section, Empty } from "@/components/ui";
import { Editable } from "@/components/editable";
import { AddRow } from "@/components/add-row";
import { ActionButton } from "@/components/action-button";

const CATEGORIES = ["Website", "Domain", "Email", "Scheduling & booking", "Payments", "Forms & intake", "CRM", "Events", "Marketing", "Automations", "Products & inventory", "Shipping & fulfillment", "Accounting & finance", "Client portal", "Other"];

export default async function Systems({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: tools } = await supabase.from("client_tools").select("*").eq("client_id", id).order("sort_order");
  const P = `/clients/${id}/systems`;
  const monthly = (tools ?? []).reduce((s, t) => s + (t.cost == null ? 0 : t.billing_frequency === "monthly" ? Number(t.cost) : t.billing_frequency === "annual" ? Number(t.cost) / 12 : 0), 0);
  const unknown = (tools ?? []).filter((t) => t.cost == null).length;
  const covered = new Set((tools ?? []).map((t) => t.category));
  const gaps = CATEGORIES.slice(0, -1).filter((c) => !covered.has(c));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5"><p className="label">Known recurring cost</p><p className="mt-1 font-serif text-3xl">${monthly.toFixed(0)}<span className="text-base text-ink-soft">/mo</span></p>{unknown > 0 && <p className="text-xs text-ink-soft">{unknown} tool{unknown > 1 ? "s" : ""} with unknown cost</p>}</div>
        <div className="card p-5 md:col-span-2"><p className="label">Categories with no tool recorded</p><p className="mt-2 text-sm text-ink-soft">{gaps.join(" · ") || "All covered"}</p></div>
      </div>
      <Section title="Technology inventory" action={<Link href="/library" className="text-sm text-mauve hover:underline">Resource library</Link>}>
        {!tools?.length ? <Empty>No tools recorded yet.</Empty> : (
          <div className="space-y-4">
            {tools.map((t) => (
              <div key={t.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-48 flex-1 font-medium"><Editable table="client_tools" id={t.id} field="name" value={t.name} path={P} /></div>
                  <span className="w-48"><Editable table="client_tools" id={t.id} field="category" value={t.category} type="select" options={CATEGORIES} path={P} placeholder="Category" /></span>
                  <span className="w-40"><Editable table="client_tools" id={t.id} field="recommendation" value={t.recommendation} type="select" options={["keep", "improve", "consolidate", "replace", "remove", "evaluate"]} path={P} placeholder="Recommendation" /></span>
                  <ActionButton action={moveRow.bind(null, "client_tools", t.id, "up", P)} className="px-2">↑</ActionButton>
                  <ActionButton action={deleteRow.bind(null, "client_tools", t.id, P)} confirm="Remove this tool?" className="px-2">✕</ActionButton>
                </div>
                <div className="mt-2 grid gap-x-4 gap-y-1 text-sm md:grid-cols-4">
                  <div><p className="label">Cost ($)</p><Editable table="client_tools" id={t.id} field="cost" value={t.cost} type="number" path={P} /></div>
                  <div><p className="label">Billing</p><Editable table="client_tools" id={t.id} field="billing_frequency" value={t.billing_frequency} type="select" options={["monthly", "annual", "one-time", "usage", "free", "unknown"]} path={P} /></div>
                  <div><p className="label">Effectiveness</p><Editable table="client_tools" id={t.id} field="effectiveness" value={t.effectiveness} type="select" options={["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: `${v}/5` }))} path={P} /></div>
                  <div><p className="label">Integration dependencies</p><Editable table="client_tools" id={t.id} field="dependencies" value={t.dependencies} path={P} /></div>
                  <div className="md:col-span-2"><p className="label">Purpose</p><Editable table="client_tools" id={t.id} field="purpose" value={t.purpose} type="textarea" rows={2} path={P} /></div>
                  <div className="md:col-span-2"><p className="label">Pain points</p><Editable table="client_tools" id={t.id} field="pain_points" value={t.pain_points} type="textarea" rows={2} path={P} /></div>
                  <div className="md:col-span-4"><p className="label">Notes</p><Editable table="client_tools" id={t.id} field="notes" value={t.notes} path={P} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
        <AddRow table="client_tools" fixed={{ client_id: id, billing_frequency: "unknown" }} field="name" placeholder="Add a tool (e.g. Squarespace)" path={P}
          extra={{ name: "category", options: CATEGORIES.map((c) => ({ value: c, label: c })) }} />
      </Section>
    </div>
  );
}
