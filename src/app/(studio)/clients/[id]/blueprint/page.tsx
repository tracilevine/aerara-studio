import { createClient } from "@/lib/supabase/server";
import { BLUEPRINT_FIELDS, SOURCES } from "@/lib/documents";
import { savePrivate, verifyChart } from "@/app/actions";
import { Section, Pill, fmtDateTime } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { BlueprintField } from "./blueprint-field";
import type { Placement } from "@/lib/chart";

export default async function Blueprint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: c }, { data: p }] = await Promise.all([
    supabase.from("clients").select("blueprint").eq("id", id).single(),
    supabase.from("client_private").select("*").eq("client_id", id).maybeSingle(),
  ]);
  const bp = (c?.blueprint ?? {}) as Record<string, { text: string; source: string }>;
  const groups = [...new Set(BLUEPRINT_FIELDS.map((f) => f.group))];
  const consent = !!p?.consent_spiritual;
  const placements = (p?.chart?.placements ?? []) as Placement[];

  return (
    <div className="space-y-8">
      <p className="text-xs text-ink-soft">Every entry carries a label: {SOURCES.join(" · ")}. Labels carry into documents.</p>
      {groups.map((g) => {
        const soul = g === "Optional Soul Blueprint";
        if (soul && !consent) return (
          <Section key={g} title={g} className="border-soul-border"><p className="text-sm text-ink-soft">Not shown: the client has not opted in to spiritual frameworks. Record consent below if they do.</p></Section>
        );
        return (
          <Section key={g} title={g} className={soul ? "border-soul-border" : ""}>
            {soul && <p className="mb-4 text-xs text-ink-soft">Reflective lenses only. Never evidence of aptitude or a predictor of success.</p>}
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {BLUEPRINT_FIELDS.filter((f) => f.group === g).map((f) => (
                <BlueprintField key={f.key} clientId={id} fieldKey={f.key} label={f.label} text={bp[f.key]?.text ?? ""} source={bp[f.key]?.source ?? ""} sources={SOURCES} />
              ))}
            </div>
          </Section>
        );
      })}

      <Section title="Birth chart & consent" action={<Pill tone="mauve">Private · never in client documents</Pill>} className="border-soul-border">
        <form action={savePrivate.bind(null, id)} className="grid gap-3 text-sm md:grid-cols-3">
          <label className="flex items-center gap-2 md:col-span-3"><input type="checkbox" name="consent_spiritual" defaultChecked={consent} className="accent-[#59445D]" /> Client explicitly opted in to astrology / Kabbalah / Human Design</label>
          <input name="consent_source" defaultValue={p?.consent_source ?? ""} placeholder="Consent source (e.g. Tally submission ID)" className="input md:col-span-3" />
          <label>Birth date<input name="birth_date" type="date" defaultValue={p?.birth_date ?? ""} className="input mt-1" /></label>
          <label>Exact local birth time<input name="birth_time" type="time" defaultValue={p?.birth_time?.slice(0, 5) ?? ""} className="input mt-1" /></label>
          <label>Birth place<input name="birth_place" defaultValue={p?.birth_place ?? ""} className="input mt-1" /></label>
          <label>Latitude (N +)<input name="latitude" type="number" step="0.0001" defaultValue={p?.latitude ?? ""} className="input mt-1" /></label>
          <label>Longitude (E +, W −)<input name="longitude" type="number" step="0.0001" defaultValue={p?.longitude ?? ""} className="input mt-1" /></label>
          <label>Time zone (IANA)<input name="time_zone" defaultValue={p?.time_zone ?? ""} placeholder="America/New_York" className="input mt-1" /></label>
          <div className="md:col-span-3"><button className="btn btn-ghost">Save private details</button></div>
        </form>
        <p className="mt-3 text-xs text-ink-soft">Historical time zones and daylight saving are applied from the time zone database. Confirm coordinates for the birth location (city center is an approximation).</p>
        <div className="mt-5 border-t border-line pt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm">{p?.chart_verified_at ? `Calculated ${fmtDateTime(p.chart_verified_at)} · UTC ${p.chart.utc.slice(0, 16).replace("T", " ")} (offset ${p.chart.utcOffsetMinutes / 60}h)` : "Not calculated. All placements are Unverified."}</p>
            {consent && <ActionButton variant="primary" action={verifyChart.bind(null, id)} done={() => "Calculated"}>Calculate placements</ActionButton>}
          </div>
          {placements.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead><tr className="text-left text-ink-soft"><th className="font-normal">Placement</th><th className="font-normal">Sign</th><th className="font-normal">Degree</th><th className="font-normal">Status</th></tr></thead>
              <tbody>{placements.map((x) => (
                <tr key={x.body} className="border-t border-line"><td className="py-2">{x.body}</td><td>{x.sign}</td><td>{x.degree.toFixed(2)}°</td>
                  <td><Pill tone="done">{x.status}</Pill> {x.nearCusp && <Pill tone="clay">Near sign boundary</Pill>}</td></tr>
              ))}</tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-ink-soft">Houses, aspects and Human Design are not calculated here and stay Unverified unless confirmed with a dedicated chart tool.</p>
        </div>
      </Section>
    </div>
  );
}
