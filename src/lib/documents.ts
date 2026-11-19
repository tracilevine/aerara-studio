import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTION_TITLES, type AssessmentContent } from "./assessment";

export type DocType =
  | "assessment" | "blueprint" | "audit" | "technology" | "recommendations"
  | "roadmap" | "proposal" | "meeting_summary" | "progress_report" | "contract";

export const DOC_TYPES: { type: DocType; label: string }[] = [
  { type: "assessment", label: "Intake Assessment" },
  { type: "blueprint", label: "Soul & System Blueprint" },
  { type: "audit", label: "Business Foundations Audit" },
  { type: "technology", label: "Technology Assessment" },
  { type: "recommendations", label: "Recommendations" },
  { type: "roadmap", label: "Implementation Plan" },
  { type: "proposal", label: "Proposal" },
  { type: "meeting_summary", label: "Meeting Summary" },
  { type: "progress_report", label: "Progress Report" },
  { type: "contract", label: "Contract (template)" },
];

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
const line = (label: string, v?: string | number | null) => (v === null || v === undefined || v === "" ? "" : `**${label}:** ${v}\n`);
const PHASE: Record<string, string> = { "30": "First 30 days — Stabilize", "60": "Days 31–60 — Build", "90": "Days 61–90 — Optimize", later: "Later" };

export const BLUEPRINT_FIELDS: { group: string; key: string; label: string }[] = [
  { group: "Personal Alignment", key: "values", label: "Values" },
  { group: "Personal Alignment", key: "motivations", label: "Motivations" },
  { group: "Personal Alignment", key: "working_style", label: "Preferred working style" },
  { group: "Personal Alignment", key: "strengths", label: "Strengths" },
  { group: "Personal Alignment", key: "energy_drains", label: "Energy drains" },
  { group: "Personal Alignment", key: "delegation", label: "Delegation preferences" },
  { group: "Personal Alignment", key: "support_needs", label: "Welcomes support with" },
  { group: "Business Alignment", key: "mission", label: "Mission" },
  { group: "Business Alignment", key: "vision", label: "Vision" },
  { group: "Business Alignment", key: "business_model", label: "Business model" },
  { group: "Business Alignment", key: "offerings", label: "Offerings" },
  { group: "Business Alignment", key: "ideal_clients", label: "Ideal clients" },
  { group: "Business Alignment", key: "growth_goals", label: "Growth goals" },
  { group: "Business Alignment", key: "capacity", label: "Capacity" },
  { group: "Optional Soul Blueprint", key: "symbolic_themes", label: "Symbolic leadership themes" },
  { group: "Optional Soul Blueprint", key: "kabbalah", label: "Kabbalistic reflections" },
  { group: "Optional Soul Blueprint", key: "human_design", label: "Human Design reflections" },
  { group: "Strategic Insights", key: "opportunities", label: "Opportunities" },
  { group: "Strategic Insights", key: "friction", label: "Potential friction points" },
  { group: "Strategic Insights", key: "alignment", label: "Goals vs. current operations" },
  { group: "Strategic Insights", key: "observations", label: "Advisor observations" },
  { group: "Strategic Insights", key: "next_steps", label: "Recommended next steps" },
];
export const SOURCES = ["Client statement", "Verified fact", "Symbolic interpretation", "Advisory hypothesis", "Recommendation"];
const INTERNAL_ONLY_BLUEPRINT = new Set(["observations"]);

export async function buildDocument(db: SupabaseClient, clientId: string, type: DocType, audience: "internal" | "client") {
  const client = (await db.from("clients").select("*").eq("id", clientId).single()).data!;
  const priv = (await db.from("client_private").select("consent_spiritual,chart").eq("client_id", clientId).maybeSingle()).data;
  const forClient = audience === "client";
  const label = DOC_TYPES.find((d) => d.type === type)!.label;
  const title = `${label}${forClient ? "" : " (internal)"}`;
  let md = "";

  if (type === "assessment") {
    let query = db.from("assessments").select("content").eq("client_id", clientId);
    if (forClient) query = query.eq("status", "approved");
    const { data: a, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error("Could not load the assessment.");
    if (!a?.content && forClient) throw new Error("Approve an assessment before creating a client-facing copy.");
    if (!a?.content) md = "_No assessment yet. Generate one from the Assessment tab._";
    else {
      const c = a.content as AssessmentContent;
      for (const [k, t] of SECTION_TITLES) {
        if (k === "soul" && (!c.sections.soul || !priv?.consent_spiritual)) continue;
        if (forClient && k === "questions") continue; // advisor prep only
        md += `## ${t.replace(/^\d\.\s/, "")}\n\n${c.sections[k] ?? ""}\n\n`;
      }
      if (!forClient && c.open_questions?.length) md += `## Open questions\n\n${c.open_questions.map((q) => `- ${q}`).join("\n")}\n`;
    }
  }

  if (type === "blueprint") {
    const bp = (client.blueprint ?? {}) as Record<string, { text: string; source: string }>;
    let group = "";
    for (const f of BLUEPRINT_FIELDS) {
      if (forClient && INTERNAL_ONLY_BLUEPRINT.has(f.key)) continue;
      if (f.group === "Optional Soul Blueprint" && !priv?.consent_spiritual) continue;
      const v = bp[f.key];
      if (!v?.text) continue;
      if (f.group !== group) { md += `## ${f.group}\n\n`; group = f.group; }
      md += `### ${f.label}\n_${v.source}_\n\n${v.text}\n\n`;
    }
    if (priv?.consent_spiritual && priv.chart?.placements) {
      md += `## Verified chart placements\n\n_Calculated with a tropical ephemeris from the client's recorded birth time. Reflective only._\n\n`;
      for (const p of priv.chart.placements) md += `- **${p.body}:** ${p.sign}${p.nearCusp ? " (near a sign boundary)" : ""}\n`;
      md += "\n";
    }
    if (!md) md = "_The blueprint is empty. Fill it in on the Blueprint tab._";
  }

  if (type === "audit") {
    const { data } = await db.from("audit_items").select("*").eq("client_id", clientId).order("sort_order");
    for (const i of data ?? []) {
      md += `## ${i.category}\n\n`;
      if (!i.assessed) { md += "_Not assessed._\n\n"; continue; }
      md += line("Current state", i.current_state) + line("Evidence", i.evidence) + line("Client perspective", i.client_perspective);
      if (!forClient) md += line("Advisor observations", i.advisor_observations);
      md += line("Gaps", i.gaps) + line("Maturity", i.maturity ? `${i.maturity} / 5` : null) +
        line("Recommendations", i.recommendations) + line("Priority", i.priority ? cap(i.priority) : null) + "\n";
    }
    if (!md) md = "_No audit started yet._";
  }

  if (type === "technology") {
    const { data } = await db.from("client_tools").select("*").eq("client_id", clientId).order("sort_order");
    const total = (data ?? []).reduce((s, t) => s + (t.billing_frequency === "monthly" ? Number(t.cost ?? 0) : t.billing_frequency === "annual" ? Number(t.cost ?? 0) / 12 : 0), 0);
    md += `## Current stack\n\n`;
    for (const t of data ?? []) {
      md += `### ${t.name}${t.category ? ` · ${t.category}` : ""}\n` + line("Purpose", t.purpose) +
        line("Cost", t.cost != null ? `$${t.cost} (${t.billing_frequency ?? "unknown"})` : "Unknown") +
        line("Depends on", t.dependencies) + line("Pain points", t.pain_points) +
        line("Recommendation", t.recommendation ? cap(t.recommendation) : null) + (forClient ? "" : line("Notes", t.notes)) + "\n";
    }
    md += `## Known recurring cost\n\nApproximately **$${total.toFixed(2)}/month** from tools with a recorded cost. Tools with unknown cost are excluded.\n`;
  }

  if (type === "recommendations") {
    let q = db.from("recommendations").select("*").eq("client_id", clientId).order("sort_order");
    if (forClient) q = q.in("status", ["approved", "done"]);
    const { data } = await q;
    for (const r of data ?? []) {
      md += `## ${r.title}\n\n` + line("Area", r.category) + line("What we noticed", r.issue) + line("Evidence", r.evidence) +
        line("Proposed solution", r.solution) + line("Expected benefit", r.benefit) + line("Priority", cap(r.priority)) +
        line("Effort", cap(r.effort)) + line("Estimated cost", r.estimated_cost) + line("Depends on", r.dependencies) +
        (forClient ? "" : line("Status", cap(r.status)) + line("Advisor notes", r.advisor_notes)) + "\n";
    }
    if (!md) md = forClient ? "_No approved recommendations yet._" : "_No recommendations yet._";
  }

  if (type === "roadmap" || type === "progress_report") {
    const { data } = await db.from("tasks").select("*").eq("client_id", clientId).order("phase").order("sort_order");
    const tasks = data ?? [];
    const done = tasks.filter((t) => t.status === "completed").length;
    if (type === "progress_report") {
      md += `## Summary\n\n**${done} of ${tasks.length}** roadmap items complete (${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%).\n\n`;
      md += `## Recently completed\n\n${tasks.filter((t) => t.status === "completed").map((t) => `- ${t.title}`).join("\n") || "_None yet._"}\n\n`;
      md += `## In progress\n\n${tasks.filter((t) => t.status === "in_progress").map((t) => `- ${t.title}`).join("\n") || "_None._"}\n\n`;
      md += `## Waiting on you\n\n${tasks.filter((t) => t.owner_type === "client" && t.status !== "completed").map((t) => `- ${t.title}${t.due_date ? ` (by ${t.due_date})` : ""}`).join("\n") || "_Nothing right now._"}\n\n`;
      md += `## Next focus\n\n_Add the priorities for the coming weeks._\n`;
    } else {
      for (const ph of ["30", "60", "90", "later"]) {
        const items = tasks.filter((t) => t.phase === ph);
        if (!items.length) continue;
        md += `## ${PHASE[ph]}\n\n`;
        for (const t of items) {
          md += `### ${t.is_milestone ? "◆ " : ""}${t.title}\n` + line("Outcome", t.description) +
            line("Owner", t.owner_type === "client" ? "You" : t.owner_type === "advisor" ? "AERARA" : t.owner_name) +
            line("Due", t.due_date) + line("Priority", t.priority ? cap(t.priority) : null) + line("Effort", t.effort) +
            line("Estimated cost", t.estimated_cost) + line("Depends on", t.depends_on) + line("Success looks like", t.success_criteria) + "\n";
        }
      }
      if (!md) md = "_No roadmap items yet._";
    }
  }

  if (type === "meeting_summary") {
    const { data: m } = await db.from("activities").select("*").eq("client_id", clientId).eq("activity_type", "meeting")
      .lte("occurred_at", new Date().toISOString()).order("occurred_at", { ascending: false }).limit(1).maybeSingle();
    md += m
      ? `## ${m.title}\n\n_${new Date(m.occurred_at).toLocaleDateString("en-US", { dateStyle: "long" })}_\n\n## What we covered\n\n${forClient ? "_Summarize the session for the client here._" : m.notes ?? ""}\n\n## Next steps\n\n${m.follow_up ?? "_Add next steps._"}\n`
      : "## What we covered\n\n_No meeting logged yet. Log one on the Activity tab, or write the summary here._\n\n## Next steps\n\n";
  }

  if (type === "proposal") {
    md = `## Where you are\n\n${client.business_stage ?? ""}\n\n## What you want to build\n\n${client.vision ?? ""}\n\n## Proposed engagement\n\n_Describe scope, sessions, deliverables._\n\n## Investment\n\n_Add fees and payment terms._\n\n## Next step\n\n_How to begin._\n`;
  }

  if (type === "contract") {
    md = `> Template only. Have a qualified attorney review before use.\n\n## Parties\n\nAERARA and ${client.name}${client.business_name ? ` (${client.business_name})` : ""}.\n\n## Scope of services\n\n## Fees and payment\n\n## Term and cancellation\n\n## Confidentiality\n\n## Signatures\n`;
  }

  return { title, content: md.trim() + "\n" };
}
