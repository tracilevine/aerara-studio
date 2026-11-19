import { createClient, getAdvisor } from "@/lib/supabase/server";
import { Section, fmtDate } from "@/components/ui";
import { Editable } from "@/components/editable";
import { AddRow } from "@/components/add-row";

export const dynamic = "force-dynamic";

export default async function Library({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  await getAdvisor();
  let query = supabase.from("resources").select("*").order("category").order("name");
  const s = q.replace(/[%,()]/g, "");
  if (s) query = query.or(`name.ilike.%${s}%,category.ilike.%${s}%,description.ilike.%${s}%,use_cases.ilike.%${s}%`);
  const { data } = await query;
  const P = "/library";
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex items-end justify-between">
        <div><h1 className="font-serif text-4xl">Resource Library</h1><p className="mt-2 text-sm text-ink-soft">Pricing changes. Re-check and update the verified date before recommending.</p></div>
        <form className="w-72"><input name="q" defaultValue={q} placeholder="Search tools or use cases" className="input" /></form>
      </header>
      {(data ?? []).map((r) => (
        <Section key={r.id} title={r.name} action={<span className="label">{r.category}</span>}>
          <div className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
            {([["description", "Description"], ["use_cases", "Relevant use cases"], ["advantages", "Advantages"], ["limitations", "Limitations"], ["integrations", "Integrations"], ["pricing_notes", "Pricing notes"], ["advisor_notes", "Advisor notes"]] as const).map(([f, l]) => (
              <div key={f}><p className="label mt-2">{l}</p><Editable table="resources" id={r.id} field={f} value={r[f]} type="textarea" rows={2} path={P} /></div>
            ))}
            <div>
              <p className="label mt-2">Pricing last verified</p>
              <Editable table="resources" id={r.id} field="pricing_last_verified" value={r.pricing_last_verified} type="date" path={P} />
              {!r.pricing_last_verified && <p className="px-2 text-xs text-[#9A4B36]">Not verified</p>}
              {r.pricing_last_verified && <p className="px-2 text-xs text-ink-soft">Verified {fmtDate(r.pricing_last_verified)}</p>}
            </div>
            <div><p className="label mt-2">Website</p><Editable table="resources" id={r.id} field="website" value={r.website} path={P} /></div>
            <div><p className="label mt-2">Affiliate link <span className="normal-case tracking-normal text-ink-soft">(disclose to clients)</span></p><Editable table="resources" id={r.id} field="affiliate_url" value={r.affiliate_url} path={P} /></div>
          </div>
        </Section>
      ))}
      <Section title="Add a tool"><AddRow table="resources" fixed={{}} field="name" placeholder="Tool name" path={P} /></Section>
    </div>
  );
}
