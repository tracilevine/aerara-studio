import { createClient } from "@/lib/supabase/server";
import { createManualAssessment, approveAssessment, applyAssessment, restoreVersion } from "@/app/actions";
import { SECTION_TITLES, type AssessmentContent } from "@/lib/assessment";
import { Section, Status, Empty, Pill, fmtDateTime } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { SectionEditor } from "./section-editor";

export default async function Assessment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: list }, { data: priv }] = await Promise.all([
    supabase.from("assessments").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("client_private").select("consent_spiritual").eq("client_id", id).maybeSingle(),
  ]);
  const a = list?.[0];
  const P = `/clients/${id}/assessment`;
  const create = (
    <ActionButton variant={a?.content ? "ghost" : "primary"} action={createManualAssessment.bind(null, id)}
      confirm={a?.content ? "Start a blank assessment? The current assessment stays in history." : undefined}>
      Start manual assessment
    </ActionButton>
  );
  if (!a) return (
    <Section title="Assessment" action={create}>
      <Empty>No assessment yet.</Empty>
    </Section>
  );

  const c = a.content as AssessmentContent | null;
  const { data: versions } = await supabase.from("assessment_versions").select("id,created_at").eq("assessment_id", a.id).order("created_at", { ascending: false }).limit(10);
  const applied = (r: unknown) => `Added ${(r as { added: number }).added}`;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3 text-sm">
          <Status value={a.status} />
          <span className="text-ink-soft">{a.generated_by === "manual" ? "Manual assessment" : "Imported assessment"} · {fmtDateTime(a.created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {a.status === "awaiting_review" && <ActionButton variant="primary" action={approveAssessment.bind(null, a.id, P)}>Approve assessment</ActionButton>}
          {create}
        </div>
      </div>

      {c && <>
        <p className="text-xs text-ink-soft">Draft for advisor review. Labels in the text distinguish client statements, advisory hypotheses and recommendations. Editing an approved assessment returns it to review.</p>
        {SECTION_TITLES.map(([k, title]) => {
          if (k === "soul" && !priv?.consent_spiritual) return (
            <Section key={k} title={title}><Empty>Client has not opted in. This section is unavailable.</Empty></Section>
          );
          return (
            <Section key={k} title={title} className={k === "soul" ? "border-soul-border" : ""}>
              <SectionEditor assessmentId={a.id} sectionKey={k} text={c.sections[k] ?? ""} path={P} />
              {k === "wheelhouse" && c.wheelhouse_lists && Object.values(c.wheelhouse_lists).some((items) => items.length > 0) && (
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {([["own", "Own and Lead"], ["support", "Support or Simplify"], ["delegate", "Delegate or Automate"]] as const).map(([key, label]) => (
                    <div key={key} className="rounded-xl bg-system-card/60 p-4"><p className="label mb-2">{label}</p><ul className="list-disc space-y-1 pl-4 text-sm">{c.wheelhouse_lists[key].map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  ))}
                </div>
              )}
              {k === "questions" && <div className="mt-4"><p className="label mb-1">Question list</p><SectionEditor assessmentId={a.id} sectionKey="questions_list" text={(c.questions ?? []).map((q, i) => `${i + 1}. ${q}`).join("\n")} path={P} plain /></div>}
            </Section>
          );
        })}
        {!!c.open_questions?.length && (
          <Section title="Open questions & inconsistencies"><ul className="list-disc space-y-1 pl-5 text-sm">{c.open_questions.map((q, i) => <li key={i}>{q}</li>)}</ul></Section>
        )}
        {a.generated_by !== "manual" && <Section title="Move into the workspace">
          <p className="mb-4 text-sm text-ink-soft">Copies draft findings into the editable tabs. Existing entries are never overwritten; duplicates are skipped.</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton action={applyAssessment.bind(null, a.id, "blueprint")} done={applied}>Blueprint</ActionButton>
            <ActionButton action={applyAssessment.bind(null, a.id, "audit")} done={applied}>Foundations audit ({c.audit?.length ?? 0})</ActionButton>
            <ActionButton action={applyAssessment.bind(null, a.id, "tools")} done={applied}>Tools ({c.tools?.length ?? 0})</ActionButton>
            <ActionButton action={applyAssessment.bind(null, a.id, "recommendations")} done={applied}>Recommendations ({c.recommendations?.length ?? 0})</ActionButton>
            <ActionButton action={applyAssessment.bind(null, a.id, "roadmap")} done={applied}>Roadmap ({c.roadmap?.length ?? 0})</ActionButton>
          </div>
        </Section>}
      </>}

      {(!!versions?.length || (list?.length ?? 0) > 1) && (
        <Section title="History">
          <ul className="space-y-2 text-sm">
            {(versions ?? []).map((v) => <li key={v.id} className="flex items-center justify-between"><span>Edit saved {fmtDateTime(v.created_at)}</span><ActionButton action={restoreVersion.bind(null, a.id, v.id, P)} confirm="Restore this version?">Restore</ActionButton></li>)}
            {(list ?? []).slice(1).map((x) => <li key={x.id} className="flex items-center justify-between text-ink-soft"><span>Earlier draft · {fmtDateTime(x.created_at)}</span><Pill>{x.status.replace("_", " ")}</Pill></li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}
