import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { complete, modelName, parseJson } from "./ai";
import { SENSITIVE_IDS, answerText, type IntakeResponse } from "./intake";
import type { Placement } from "./chart";

/** The structured report the engine produces. Each section's text is light markdown. */
export type AssessmentContent = {
  sections: {
    snapshot: string;
    wheelhouse: string;
    brand: string;
    technology: string;
    soul: string | null;
    strategy: string;
    questions: string;
  };
  wheelhouse_lists: { own: string[]; support: string[]; delegate: string[] };
  open_questions: string[];
  audit: {
    category: string; current_state: string; evidence: string; client_perspective: string;
    gaps: string; maturity: number | null; recommendations: string; priority: "high" | "medium" | "low";
  }[];
  tools: {
    category: string; name: string; purpose: string; cost: string; pain_points: string;
    recommendation: "keep" | "improve" | "consolidate" | "replace" | "remove" | "evaluate";
  }[];
  recommendations: {
    title: string; category: string; issue: string; evidence: string; solution: string; benefit: string;
    priority: "high" | "medium" | "low"; effort: "low" | "medium" | "high"; estimated_cost: string; dependencies: string;
  }[];
  roadmap: {
    phase: "30" | "60" | "90"; title: string; outcome: string; priority: "high" | "medium" | "low";
    owner_type: "advisor" | "client"; effort: string; estimated_cost: string; depends_on: string; success_criteria: string;
  }[];
  questions: string[];
};

export const SECTION_TITLES: [keyof AssessmentContent["sections"], string][] = [
  ["snapshot", "1. Business Snapshot & Vision"],
  ["wheelhouse", "2. Wheelhouse & Delegation"],
  ["brand", "3. Brand Positioning"],
  ["technology", "4. Technology & Operations"],
  ["soul", "5. Astrological & Soul Blueprint"],
  ["strategy", "6. 30/60/90-Day Strategy"],
  ["questions", "7. First-Meeting Questions"],
];

export const AUDIT_CATEGORIES = [
  "Purpose and vision",
  "Business model and offers",
  "Brand and positioning",
  "Marketing and visibility",
  "Customer journey",
  "Technology and operations",
  "Financial sustainability",
  "Delegation and founder capacity",
];

const SYSTEM = `You are the analysis engine inside AERARA System Advisory Studio, a private workspace for a business advisor who serves wellness practitioners, healers, facilitators and purpose-driven entrepreneurs.

Write for the ADVISOR, not the client. Your output is a DRAFT the advisor will review and edit.

Hard rules:
- Use only what the intake says. Never invent facts, numbers, tools, prices, clients or results. If something is missing, say "Not provided" and add it to open_questions.
- Label claims: write "Client states:" for respondent statements, "Advisory hypothesis:" for your inferences, and "Recommendation:" for actions.
- Flag inconsistencies between answers (e.g. a field that duplicates another, a budget that conflicts with a goal) without assuming which is right.
- Do not invent scores or ratings. audit.maturity must be null unless the intake gives clear evidence; use 1-5 only then.
- Prefer existing tools and low-cost options. Respect the client's stated budget. Explain tradeoffs for any replacement. Do not state current prices as fact; write "verify current pricing".
- Respect stated values, religious practice and boundaries (e.g. Shabbos, holidays, modesty) in scheduling and recommendations.
- Spiritual frameworks are optional reflective lenses, never evidence of aptitude or predictors of success.
- If spiritual_opt_in is false, sections.soul must be null.
- If spiritual_opt_in is true: use ONLY the verified placements provided. Never compute, guess or add signs, houses, aspects or Human Design type/authority/profile/centers. Anything not provided is "Unverified". Give the Midheaven special attention as a symbolic reflection on public contribution and vocation. Compare symbolism to the client's actual wheelhouse answers. For Kabbalah, use accurate terms (Chesed, Gevurah, Tiferet, Netzach, Hod, Yesod, Malchut) and distinguish traditional teaching from modern advisory application. Never write birth date, time or place in the output.
- 30/60/90: First 30 = Stabilize, 31-60 = Build, 61-90 = Optimize. Fit the client's stated time and budget.
- First-meeting questions: 5-8, specific to this intake, not generic coaching prompts.

Markdown allowed in section text: "### " subheadings, "- " bullets, **bold**. No tables.

Return ONLY one JSON object with exactly these keys:
{
 "sections": {"snapshot": str, "wheelhouse": str, "brand": str, "technology": str, "soul": str|null, "strategy": str, "questions": str},
 "wheelhouse_lists": {"own": [str], "support": [str], "delegate": [str]},
 "open_questions": [str],
 "audit": [{"category": one of ${JSON.stringify(AUDIT_CATEGORIES)}, "current_state": str, "evidence": str, "client_perspective": str, "gaps": str, "maturity": int|null, "recommendations": str, "priority": "high"|"medium"|"low"}],
 "tools": [{"category": str, "name": str, "purpose": str, "cost": str, "pain_points": str, "recommendation": "keep"|"improve"|"consolidate"|"replace"|"remove"|"evaluate"}],
 "recommendations": [{"title": str, "category": str, "issue": str, "evidence": str, "solution": str, "benefit": str, "priority": "high"|"medium"|"low", "effort": "low"|"medium"|"high", "estimated_cost": str, "dependencies": str}],
 "roadmap": [{"phase": "30"|"60"|"90", "title": str, "outcome": str, "priority": "high"|"medium"|"low", "owner_type": "advisor"|"client", "effort": str, "estimated_cost": str, "depends_on": str, "success_criteria": str}],
 "questions": [str]
}
Include all 8 audit categories (use "Not assessed — insufficient information" where needed). 6-10 recommendations. 8-15 roadmap items.`;

export function buildUserPrompt(opts: {
  clientName: string; businessName: string | null; responses: IntakeResponse[];
  optIn: boolean; placements: Placement[] | null;
}) {
  const answers = opts.responses
    .filter((r) => !SENSITIVE_IDS.has(r.questionId)) // birth details never go to the model
    .map((r) => `Q: ${r.label}\nA: ${answerText(r.answer) || "(blank)"}`)
    .join("\n\n");
  const chart = !opts.optIn
    ? "spiritual_opt_in: false"
    : `spiritual_opt_in: true\nverified_placements: ${
        opts.placements?.length
          ? JSON.stringify(opts.placements.map((p) => ({ body: p.body, sign: p.sign, degree: p.degree, near_sign_boundary: p.nearCusp })))
          : "NONE VERIFIED — mark every placement Unverified and keep the section to reflective questions and Kabbalah themes the client named."
      }`;
  return `Client: ${opts.clientName}\nBusiness: ${opts.businessName ?? "Not provided"}\n${chart}\n\nINTAKE RESPONSES\n\n${answers}`;
}

/** Creates an assessment row, calls the model, stores the draft. Never throws: failures are recorded on the row. */
export async function generateAssessment(db: SupabaseClient, clientId: string, submissionId: string | null) {
  const { data: client } = await db.from("clients").select("name,business_name").eq("id", clientId).single();
  const { data: priv } = await db.from("client_private").select("consent_spiritual,chart").eq("client_id", clientId).maybeSingle();
  let responses: IntakeResponse[] = [];
  if (submissionId) {
    const { data: sub } = await db.from("intake_submissions").select("responses").eq("id", submissionId).single();
    responses = (sub?.responses ?? []) as IntakeResponse[];
  }

  const { data: row, error } = await db
    .from("assessments")
    .insert({ client_id: clientId, submission_id: submissionId, status: "generating", model: modelName(), generated_by: "ai" })
    .select("id")
    .single();
  if (error || !row) return { ok: false as const, error: error?.message ?? "Could not create assessment" };

  try {
    const text = await complete(
      SYSTEM,
      buildUserPrompt({
        clientName: client?.name ?? "Client",
        businessName: client?.business_name ?? null,
        responses,
        optIn: !!priv?.consent_spiritual,
        placements: (priv?.chart?.placements as Placement[]) ?? null,
      }),
    );
    const content = parseJson<AssessmentContent>(text);
    if (!priv?.consent_spiritual) content.sections.soul = null;
    await db.from("assessments").update({ status: "awaiting_review", ai_content: content, content }).eq("id", row.id);
    await db.from("activities").insert({
      client_id: clientId, activity_type: "system", title: "AI assessment draft ready for review", is_private: true,
    });
    return { ok: true as const, id: row.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("assessments").update({ status: "failed", error: msg }).eq("id", row.id);
    return { ok: false as const, error: msg, id: row.id };
  }
}
