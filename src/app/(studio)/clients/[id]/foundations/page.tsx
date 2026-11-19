import { createClient } from "@/lib/supabase/server";
import { startAudit } from "@/app/actions";
import { Section, Pill } from "@/components/ui";
import { Editable } from "@/components/editable";
import { ActionButton } from "@/components/action-button";

const FIELDS = [
  ["current_state", "Current state"], ["evidence", "Evidence"], ["client_perspective", "Client perspective"],
  ["advisor_observations", "Advisor observations (internal)"], ["gaps", "Identified gaps"], ["recommendations", "Recommendations"],
] as const;

export default async function Foundations({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: items } = await supabase.from("audit_items").select("*").eq("client_id", id).order("sort_order");
  const P = `/clients/${id}/foundations`;
  if (!items?.length) return (
    <Section title="Business Foundations Audit" action={<ActionButton variant="primary" action={startAudit.bind(null, id)}>Start audit</ActionButton>}>
      <p className="text-sm text-ink-soft">Eight categories, each marked Not Assessed until there’s evidence. You can also pull findings in from the Assessment tab.</p>
    </Section>
  );
  const assessed = items.filter((i) => i.assessed).length;
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">{assessed} of {items.length} categories assessed. Maturity is optional: leave it blank unless the evidence supports a rating.</p>
      {items.map((i) => (
        <Section key={i.id} title={i.category} action={
          <div className="flex items-center gap-3 text-sm">
            {!i.assessed && <Pill>Not assessed</Pill>}
            <label className="flex items-center gap-1 text-ink-soft">Assessed <Editable table="audit_items" id={i.id} field="assessed" value={i.assessed} type="checkbox" path={P} /></label>
            <span className="w-28"><Editable table="audit_items" id={i.id} field="maturity" value={i.maturity} type="select" placeholder="Maturity —" options={["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: `Maturity ${v}/5` }))} path={P} /></span>
            <span className="w-28"><Editable table="audit_items" id={i.id} field="priority" value={i.priority} type="select" placeholder="Priority —" options={["high", "medium", "low"]} path={P} /></span>
          </div>}>
          <div className={`grid gap-x-6 gap-y-2 md:grid-cols-2 ${i.assessed ? "" : "opacity-70"}`}>
            {FIELDS.map(([f, l]) => (
              <div key={f}><p className="label">{l}</p><Editable table="audit_items" id={i.id} field={f} value={i[f]} type="textarea" rows={3} path={P} className="text-sm" /></div>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}
