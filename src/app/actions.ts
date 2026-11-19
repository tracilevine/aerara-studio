"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getAdvisor } from "@/lib/supabase/server";
import { generateAssessment, AUDIT_CATEGORIES, type AssessmentContent } from "@/lib/assessment";
import { computeChart } from "@/lib/chart";
import { buildDocument, type DocType } from "@/lib/documents";

// ───────── guards ─────────
async function db() {
  const advisor = await getAdvisor();
  if (!advisor) throw new Error("Not authorized");
  return { supabase: await createClient(), advisor };
}

/** Columns the generic inline editor may write. Anything else is rejected. */
const EDITABLE: Record<string, string[]> = {
  clients: ["name", "business_name", "email", "phone", "website", "location", "business_description", "business_stage",
    "vision", "goals", "challenges", "engagement_status", "engagement_name", "next_meeting", "next_action"],
  audit_items: ["assessed", "current_state", "evidence", "client_perspective", "advisor_observations", "gaps", "maturity", "recommendations", "priority"],
  client_tools: ["category", "name", "purpose", "cost", "billing_frequency", "dependencies", "pain_points", "effectiveness", "recommendation", "notes"],
  resources: ["name", "category", "description", "pricing_notes", "pricing_last_verified", "use_cases", "advantages", "limitations", "integrations", "affiliate_url", "website", "advisor_notes"],
  recommendations: ["title", "category", "issue", "evidence", "solution", "benefit", "priority", "effort", "estimated_cost", "dependencies", "advisor_notes", "status"],
  tasks: ["title", "description", "phase", "is_milestone", "owner_type", "owner_name", "due_date", "priority", "effort", "estimated_cost", "depends_on", "success_criteria", "status"],
  documents: ["title", "content", "audience"],
  email_drafts: ["to_email", "subject", "body"],
  activities: ["activity_type", "occurred_at", "title", "notes", "follow_up", "follow_up_due", "follow_up_done", "is_private"],
};

const CREATABLE = new Set(["client_tools", "resources", "recommendations", "tasks", "activities", "email_drafts"]);
const SORTABLE = new Set(["tasks", "recommendations", "client_tools"]);

function clean(v: unknown) {
  if (typeof v === "string") { const t = v.trim(); return t === "" ? null : t; }
  return v;
}

export async function saveField(table: string, id: string, field: string, value: unknown, path?: string) {
  if (!EDITABLE[table]?.includes(field)) throw new Error(`Field ${table}.${field} is not editable`);
  const { supabase } = await db();
  const patch: Record<string, unknown> = { [field]: clean(value) };
  if (table === "tasks" && field === "status") patch.completed_at = value === "completed" ? new Date().toISOString() : null;
  if (table === "documents" && field === "content") { patch.status = "draft"; patch.approved_at = null; } // edits re-open approval
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  if (path) revalidatePath(path);
}

export async function createRow(table: string, values: Record<string, unknown>, path?: string) {
  if (!CREATABLE.has(table)) throw new Error(`Cannot create rows in ${table}`);
  const { supabase } = await db();
  if (SORTABLE.has(table) && values.client_id) {
    const { data } = await supabase.from(table).select("sort_order").eq("client_id", values.client_id as string)
      .order("sort_order", { ascending: false }).limit(1);
    values.sort_order = (data?.[0]?.sort_order ?? 0) + 1;
  }
  const { error } = await supabase.from(table).insert(values);
  if (error) throw new Error(error.message);
  if (path) revalidatePath(path);
}

export async function deleteRow(table: string, id: string, path?: string) {
  if (!CREATABLE.has(table) && table !== "documents") throw new Error(`Cannot delete from ${table}`);
  const { supabase } = await db();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (path) revalidatePath(path);
}

/** Swap sort_order with the neighbour above/below within the same client (and phase, for tasks). */
export async function moveRow(table: string, id: string, dir: "up" | "down", path?: string) {
  if (!SORTABLE.has(table)) throw new Error("Not sortable");
  const { supabase } = await db();
  const { data: row } = await supabase.from(table).select("*").eq("id", id).single();
  if (!row) return;
  let q = supabase.from(table).select("id,sort_order").eq("client_id", row.client_id);
  if (table === "tasks") q = q.eq("phase", row.phase);
  q = dir === "up" ? q.lt("sort_order", row.sort_order).order("sort_order", { ascending: false })
                   : q.gt("sort_order", row.sort_order).order("sort_order", { ascending: true });
  const { data: n } = await q.limit(1);
  const other = n?.[0];
  if (!other) return;
  await supabase.from(table).update({ sort_order: other.sort_order }).eq("id", row.id);
  await supabase.from(table).update({ sort_order: row.sort_order }).eq("id", other.id);
  if (path) revalidatePath(path);
}

// ───────── auth ─────────
export async function signIn(_: unknown, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")), password: String(form.get("password")),
  });
  if (error) return { error: error.message };
  const advisor = await getAdvisor();
  if (!advisor) {
    await supabase.auth.signOut();
    return { error: "This account is not registered as an advisor." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ───────── clients ─────────
export async function addClient(form: FormData) {
  const { supabase } = await db();
  const { data, error } = await supabase.from("clients").insert({
    name: String(form.get("name") || "").trim(),
    business_name: clean(form.get("business_name")),
    email: (clean(form.get("email")) as string | null)?.toLowerCase() ?? null,
    engagement_status: "onboarding",
  }).select("id").single();
  if (error) throw new Error(error.message);
  await supabase.from("client_private").insert({ client_id: data.id });
  redirect(`/clients/${data.id}`);
}

export async function deleteClient(clientId: string, confirmName: string) {
  const { supabase, advisor } = await db();
  if (advisor.role !== "owner") throw new Error("Only the owner can delete clients.");
  const { data } = await supabase.from("clients").select("name").eq("id", clientId).single();
  if (!data || data.name !== confirmName) throw new Error("Name does not match.");
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw new Error(error.message);
  redirect("/clients");
}

// ───────── intake ─────────
export async function markReviewed(submissionId: string, path: string) {
  const { supabase } = await db();
  await supabase.from("intake_submissions").update({ reviewed: true, reviewed_at: new Date().toISOString() }).eq("id", submissionId);
  revalidatePath(path);
}

export async function saveIntakeNote(submissionId: string, questionId: string, field: "note" | "clarified_answer" | "needs_followup", value: string | boolean, path: string) {
  const { supabase } = await db();
  const { error } = await supabase.from("intake_notes").upsert(
    { submission_id: submissionId, question_id: questionId, [field]: typeof value === "string" ? clean(value) : value },
    { onConflict: "submission_id,question_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(path);
}

// ───────── assessment ─────────
export async function runAssessment(clientId: string) {
  const { supabase } = await db();
  const { data: sub } = await supabase.from("intake_submissions").select("id").eq("client_id", clientId)
    .order("submitted_at", { ascending: false }).limit(1).maybeSingle();
  const r = await generateAssessment(supabase, clientId, sub?.id ?? null);
  revalidatePath(`/clients/${clientId}`, "layout");
  return r;
}

export async function saveAssessmentSection(id: string, key: string, text: string, path: string) {
  const { supabase, advisor } = await db();
  const { data } = await supabase.from("assessments").select("content,status").eq("id", id).single();
  if (!data) throw new Error("Assessment not found");
  const content = structuredClone(data.content) as AssessmentContent;
  if (key === "questions_list") content.questions = text.split("\n").map((s) => s.replace(/^[-\d.\s]+/, "").trim()).filter(Boolean);
  else (content.sections as Record<string, string | null>)[key] = text;
  await supabase.from("assessment_versions").insert({ assessment_id: id, content: data.content, saved_by: advisor.user_id });
  await supabase.from("assessments").update({
    content, status: data.status === "approved" ? "awaiting_review" : data.status, approved_at: null,
  }).eq("id", id);
  revalidatePath(path);
}

export async function restoreVersion(assessmentId: string, versionId: string, path: string) {
  const { supabase } = await db();
  const { data: v } = await supabase.from("assessment_versions").select("content").eq("id", versionId).single();
  if (!v) return;
  await supabase.from("assessments").update({ content: v.content, status: "awaiting_review", approved_at: null }).eq("id", assessmentId);
  revalidatePath(path);
}

export async function approveAssessment(id: string, path: string) {
  const { supabase } = await db();
  const { data } = await supabase.from("assessments").update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id).select("client_id").single();
  if (data) await supabase.from("activities").insert({ client_id: data.client_id, activity_type: "decision", title: "Assessment approved", is_private: true });
  revalidatePath(path);
}

/** Copy draft findings into the editable workspace tabs. Never overwrites existing advisor work. */
export async function applyAssessment(id: string, part: "audit" | "tools" | "recommendations" | "roadmap" | "blueprint") {
  const { supabase } = await db();
  const { data: a } = await supabase.from("assessments").select("client_id,content").eq("id", id).single();
  if (!a) throw new Error("Assessment not found");
  const c = a.content as AssessmentContent;
  const clientId = a.client_id as string;
  let added = 0;

  if (part === "audit") {
    await ensureAudit(clientId);
    for (const item of c.audit ?? []) {
      const { data: row } = await supabase.from("audit_items").select("id,assessed").eq("client_id", clientId).eq("category", item.category).maybeSingle();
      if (!row || row.assessed) continue;
      const notAssessed = /not assessed/i.test(item.current_state);
      await supabase.from("audit_items").update({
        assessed: !notAssessed, current_state: item.current_state, evidence: item.evidence,
        client_perspective: item.client_perspective, gaps: item.gaps, maturity: item.maturity ?? null,
        recommendations: item.recommendations, priority: item.priority,
      }).eq("id", row.id);
      added++;
    }
  }
  if (part === "tools") {
    const { data: existing } = await supabase.from("client_tools").select("name").eq("client_id", clientId);
    const have = new Set((existing ?? []).map((t) => t.name.toLowerCase()));
    const rows = (c.tools ?? []).filter((t) => !have.has(t.name.toLowerCase())).map((t, i) => ({
      client_id: clientId, category: t.category, name: t.name, purpose: t.purpose, pain_points: t.pain_points,
      notes: t.cost ? `Cost per intake: ${t.cost}` : null, recommendation: t.recommendation, billing_frequency: "unknown", sort_order: i,
    }));
    if (rows.length) await supabase.from("client_tools").insert(rows);
    added = rows.length;
  }
  if (part === "recommendations") {
    const { data: existing } = await supabase.from("recommendations").select("title").eq("client_id", clientId);
    const have = new Set((existing ?? []).map((t) => t.title.toLowerCase()));
    const rows = (c.recommendations ?? []).filter((r) => !have.has(r.title.toLowerCase()))
      .map((r, i) => ({ ...r, client_id: clientId, assessment_id: id, status: "proposed", sort_order: i }));
    if (rows.length) await supabase.from("recommendations").insert(rows);
    added = rows.length;
  }
  if (part === "roadmap") {
    const { data: existing } = await supabase.from("tasks").select("title").eq("client_id", clientId);
    const have = new Set((existing ?? []).map((t) => t.title.toLowerCase()));
    const rows = (c.roadmap ?? []).filter((r) => !have.has(r.title.toLowerCase())).map((r, i) => ({
      client_id: clientId, title: r.title, description: r.outcome, phase: r.phase, priority: r.priority,
      owner_type: r.owner_type, effort: r.effort, estimated_cost: r.estimated_cost, depends_on: r.depends_on,
      success_criteria: r.success_criteria, sort_order: i,
    }));
    if (rows.length) await supabase.from("tasks").insert(rows);
    added = rows.length;
  }
  if (part === "blueprint") {
    const { data: cl } = await supabase.from("clients").select("blueprint").eq("id", clientId).single();
    const bp = { ...(cl?.blueprint ?? {}) } as Record<string, { text: string; source: string }>;
    const set = (k: string, text: string | undefined, source: string) => {
      if (text && !bp[k]?.text) { bp[k] = { text, source }; added++; }
    };
    set("strengths", c.wheelhouse_lists?.own?.join("\n"), "Client statement");
    set("delegation", c.wheelhouse_lists?.delegate?.join("\n"), "Client statement");
    set("support_needs", c.wheelhouse_lists?.support?.join("\n"), "Client statement");
    if (c.sections.soul) set("symbolic_themes", c.sections.soul, "Symbolic interpretation");
    await supabase.from("clients").update({ blueprint: bp }).eq("id", clientId);
  }
  revalidatePath(`/clients/${clientId}`, "layout");
  return { added };
}

// ───────── foundations ─────────
async function ensureAudit(clientId: string) {
  const { supabase } = await db();
  await supabase.from("audit_items").upsert(
    AUDIT_CATEGORIES.map((category, i) => ({ client_id: clientId, category, sort_order: i })),
    { onConflict: "client_id,category", ignoreDuplicates: true },
  );
}
export async function startAudit(clientId: string) {
  await ensureAudit(clientId);
  revalidatePath(`/clients/${clientId}/foundations`);
}

// ───────── blueprint & private ─────────
export async function saveBlueprintField(clientId: string, key: string, text: string, source: string) {
  const { supabase } = await db();
  const { data } = await supabase.from("clients").select("blueprint").eq("id", clientId).single();
  const bp = { ...(data?.blueprint ?? {}), [key]: { text, source } };
  await supabase.from("clients").update({ blueprint: bp }).eq("id", clientId);
  revalidatePath(`/clients/${clientId}/blueprint`);
}

export async function savePrivate(clientId: string, form: FormData) {
  const { supabase } = await db();
  const num = (k: string) => { const v = form.get(k); return v === null || v === "" ? null : Number(v); };
  const consent = form.get("consent_spiritual") === "on";
  await supabase.from("client_private").upsert({
    client_id: clientId,
    consent_spiritual: consent,
    consent_source: consent ? String(form.get("consent_source") || "Recorded by advisor") : null,
    consent_at: consent ? new Date().toISOString() : null,
    birth_date: clean(form.get("birth_date")), birth_time: clean(form.get("birth_time")),
    birth_place: clean(form.get("birth_place")), latitude: num("latitude"), longitude: num("longitude"),
    time_zone: clean(form.get("time_zone")),
  }, { onConflict: "client_id" });
  revalidatePath(`/clients/${clientId}/blueprint`);
}

export async function verifyChart(clientId: string) {
  const { supabase } = await db();
  const { data: p } = await supabase.from("client_private").select("*").eq("client_id", clientId).single();
  if (!p?.consent_spiritual) return { error: "Client has not opted in." };
  if (!p.birth_date || !p.birth_time || p.latitude == null || p.longitude == null || !p.time_zone)
    return { error: "Birth date, exact local time, latitude, longitude and time zone are all required." };
  const chart = computeChart({
    birthDate: p.birth_date, birthTime: String(p.birth_time).slice(0, 5), timeZone: p.time_zone,
    latitude: p.latitude, longitude: p.longitude,
  });
  await supabase.from("client_private").update({ chart, chart_verified_at: new Date().toISOString() }).eq("client_id", clientId);
  revalidatePath(`/clients/${clientId}/blueprint`);
  return { ok: true };
}

// ───────── recommendations → roadmap ─────────
export async function recommendationToTask(recId: string) {
  const { supabase } = await db();
  const { data: r } = await supabase.from("recommendations").select("*").eq("id", recId).single();
  if (!r) throw new Error("Not found");
  if (r.status !== "approved") throw new Error("Approve the recommendation first.");
  const { data: dup } = await supabase.from("tasks").select("id").eq("recommendation_id", recId).maybeSingle();
  if (!dup) {
    const phase = r.priority === "high" ? "30" : r.priority === "medium" ? "60" : "90";
    await createRow("tasks", {
      client_id: r.client_id, recommendation_id: r.id, title: r.title, description: r.solution, phase,
      priority: r.priority, effort: r.effort, estimated_cost: r.estimated_cost, depends_on: r.dependencies,
      success_criteria: r.benefit,
    });
  }
  revalidatePath(`/clients/${r.client_id}`, "layout");
}

// ───────── documents & email ─────────
export async function generateDocument(clientId: string, type: DocType, audience: "internal" | "client") {
  const { supabase } = await db();
  const { title, content } = await buildDocument(supabase, clientId, type, audience);
  const { data, error } = await supabase.from("documents")
    .insert({ client_id: clientId, doc_type: type, title, audience, content }).select("id").single();
  if (error) throw new Error(error.message);
  redirect(`/clients/${clientId}/documents/${data.id}`);
}

export async function approveDocument(id: string, path: string) {
  const { supabase } = await db();
  const { data } = await supabase.from("documents").update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id).select("client_id,title").single();
  if (data) await supabase.from("activities").insert({ client_id: data.client_id, activity_type: "milestone", title: `Approved: ${data.title}`, is_private: true });
  revalidatePath(path);
}

export async function draftEmailForDocument(docId: string) {
  const { supabase } = await db();
  const { data: d } = await supabase.from("documents").select("id,client_id,title,status,audience").eq("id", docId).single();
  if (!d) throw new Error("Not found");
  if (d.status !== "approved" || d.audience !== "client") throw new Error("Only approved client-facing documents can be queued for email.");
  const { data: c } = await supabase.from("clients").select("name,email").eq("id", d.client_id).single();
  const first = (c?.name ?? "").split(" ")[0] || "there";
  await supabase.from("email_drafts").insert({
    client_id: d.client_id, document_id: d.id, to_email: c?.email,
    subject: `${d.title} — AERARA`,
    body: `Hi ${first},\n\nAttached is your ${d.title}. Take your time with it, and bring any questions to our next session.\n\nWarmly,\nTzip\nAERARA For the System`,
  });
  revalidatePath("/");
  redirect("/emails");
}

export async function setEmailStatus(id: string, status: "approved" | "sent" | "discarded" | "needs_review") {
  const { supabase } = await db();
  const { data } = await supabase.from("email_drafts")
    .update({ status, sent_at: status === "sent" ? new Date().toISOString() : null }).eq("id", id).select("client_id,subject").single();
  if (data && status === "sent")
    await supabase.from("activities").insert({ client_id: data.client_id, activity_type: "communication", title: `Email sent: ${data.subject}`, is_private: true });
  revalidatePath("/emails");
  revalidatePath("/");
}

export async function deleteDocument(id: string, clientId: string) {
  const { supabase } = await db();
  await supabase.from("documents").delete().eq("id", id);
  redirect(`/clients/${clientId}/documents`);
}

/** Add a list in one write so an error never saves only some of its items. */
export async function addClientTodos(clientId: string, form: FormData) {
  const { supabase } = await db();
  const titles = String(form.get("titles") ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!titles.length) return { error: "Enter at least one to-do." };
  if (titles.length > 50 || titles.some((title) => title.length > 200)) {
    return { error: "Add up to 50 items at once, with up to 200 characters per item." };
  }

  const { data: last, error: readError } = await supabase.from("tasks").select("sort_order")
    .eq("client_id", clientId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (readError) return { error: "Couldn’t load the client’s tasks." };

  const start = (last?.sort_order ?? 0) + 1;
  const { error } = await supabase.from("tasks").insert(titles.map((title, index) => ({
    client_id: clientId, title, phase: "later", sort_order: start + index,
  })));
  if (error) return { error: "Couldn’t save the to-dos." };
  revalidatePath(`/clients/${clientId}`, "layout");
  revalidatePath("/");
  return { added: titles.length };
}

export async function setClientTodoCompleted(clientId: string, taskId: string, completed: boolean) {
  const { supabase } = await db();
  let query = supabase.from("tasks").update({
    status: completed ? "completed" : "not_started",
    completed_at: completed ? new Date().toISOString() : null,
  }).eq("client_id", clientId).eq("id", taskId);
  query = completed ? query.neq("status", "completed") : query.eq("status", "completed");
  const { error } = await query;
  if (error) return { error: "Couldn’t update the to-do." };
  revalidatePath(`/clients/${clientId}`, "layout");
  revalidatePath("/");
}
