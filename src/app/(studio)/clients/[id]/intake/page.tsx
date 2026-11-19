import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { sectioned, answerText, type IntakeResponse } from "@/lib/intake";
import { markReviewed } from "@/app/actions";
import { Section, Empty, Pill, fmtDateTime } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { IntakeNote } from "./intake-note";

export default async function Intake({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> }) {
  const { id } = await params;
  const { s } = await searchParams;
  const supabase = await createClient();
  const [{ data: subs }, { data: client }] = await Promise.all([
    supabase.from("intake_submissions").select("*").eq("client_id", id).order("submitted_at", { ascending: false }),
    supabase.from("clients").select("name,email").eq("id", id).single(),
  ]);
  if (!subs?.length) return <Section title="Intake"><Empty>No intake yet. Send {client?.name} the form: https://forms.aerara.com/soul-intake</Empty></Section>;

  const idx = Math.max(0, subs.findIndex((x) => x.id === s));
  const sub = subs[idx];
  const prev = subs[idx + 1];
  const prevMap = new Map(((prev?.responses ?? []) as IntakeResponse[]).map((r) => [r.questionId, answerText(r.answer)]));
  const { data: notes } = await supabase.from("intake_notes").select("*").eq("submission_id", sub.id);
  const N = new Map((notes ?? []).map((n) => [n.question_id, n]));
  const responses = sub.responses as IntakeResponse[];
  const missing = responses.filter((r) => !answerText(r.answer).trim()).length;
  const P = `/clients/${id}/intake`;
  const followups = (notes ?? []).filter((n) => n.needs_followup);
  const mail = `mailto:${client?.email ?? ""}?subject=${encodeURIComponent("A few follow-up questions — AERARA")}&body=${encodeURIComponent(
    `Hi ${client?.name?.split(" ")[0] ?? ""},\n\nThank you for your intake. Could you share a little more on:\n\n${followups.map((f) => `- ${responses.find((r) => r.questionId === f.question_id)?.label ?? ""}${f.note ? ` (${f.note})` : ""}`).join("\n")}\n\nIf it’s easier, you can resubmit the form here: https://forms.aerara.com/soul-intake\n\nWarmly,\nTzip`)}`;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="text-sm">
          <p>Submitted {fmtDateTime(sub.submitted_at)} · Tally <code>{sub.tally_submission_id}</code></p>
          <p className="text-ink-soft">{responses.length} answers · {missing} blank{prev ? " · compared with previous submission" : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {subs.length > 1 && <span className="flex gap-1 text-xs">{subs.map((x, i) => <Link key={x.id} href={`${P}?s=${x.id}`} className={`rounded-full px-2 py-1 ${i === idx ? "bg-lavender/60" : "text-ink-soft"}`}>v{subs.length - i}</Link>)}</span>}
          {followups.length > 0 && <a className="btn btn-ghost" href={mail}>Request updates ({followups.length})</a>}
          {sub.reviewed ? <Pill tone="done">Reviewed</Pill> : <ActionButton variant="primary" action={markReviewed.bind(null, sub.id, P)}>Mark reviewed</ActionButton>}
        </div>
      </div>
      <p className="text-xs text-ink-soft">Original answers are preserved exactly as submitted. Your notes and clarified answers are stored separately.</p>

      {sectioned(responses).map((sec) => (
        <Section key={sec.key} title={sec.title} action={sec.sensitive ? <Pill tone="mauve">Private · never shared</Pill> : null} className={sec.key === "soul" ? "border-soul-border" : ""}>
          <dl className="space-y-5">
            {sec.items.map((r) => {
              const a = answerText(r.answer);
              const changed = prev && prevMap.has(r.questionId) && prevMap.get(r.questionId) !== a;
              const n = N.get(r.questionId);
              return (
                <div key={r.questionId} className="grid gap-2 md:grid-cols-5">
                  <div className="md:col-span-3">
                    <dt className="text-sm font-medium">{r.label} {changed && <Pill tone="plum">Changed</Pill>}</dt>
                    <dd className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${a ? "" : "italic text-[#9A4B36]"}`}>{a || "No answer"}</dd>
                    {n?.clarified_answer && <p className="mt-2 rounded-lg bg-system-card px-3 py-2 text-sm"><span className="label mr-2">Clarified</span>{n.clarified_answer}</p>}
                  </div>
                  <div className="md:col-span-2"><IntakeNote submissionId={sub.id} questionId={r.questionId} note={n?.note ?? ""} clarified={n?.clarified_answer ?? ""} followup={!!n?.needs_followup} path={P} /></div>
                </div>
              );
            })}
          </dl>
        </Section>
      ))}
    </div>
  );
}
