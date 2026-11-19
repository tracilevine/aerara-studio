import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Q, get, spiritualConsent, type IntakeResponse } from "./intake";

export type NormalizedSubmission = {
  submissionId: string; submittedAt: string | null; completed: boolean; responses: IntakeResponse[];
};

/**
 * Save one intake. Idempotent on the Tally submission ID.
 * Matches an existing client by email; otherwise creates one.
 */
export async function ingestSubmission(
  db: SupabaseClient, sub: NormalizedSubmission, formId: string,
  source: "tally_webhook" | "tally_api" | "manual_import",
): Promise<{ status: "duplicate" | "created" | "skipped"; clientId?: string; submissionRowId?: string; reason?: string }> {
  if (!sub.submissionId) return { status: "skipped", reason: "Missing submission ID" };
  if (!sub.completed) return { status: "skipped", reason: "Partial submission" };

  const { data: existing } = await db
    .from("intake_submissions").select("id,client_id").eq("tally_submission_id", sub.submissionId).maybeSingle();
  if (existing) return { status: "duplicate", clientId: existing.client_id, submissionRowId: existing.id };

  const r = sub.responses;
  const email = get(r, Q.email).toLowerCase() || null;
  const name = get(r, Q.name) || "Unnamed client";

  let clientId: string | undefined;
  if (email) {
    const { data } = await db.from("clients").select("id").ilike("email", email).maybeSingle();
    clientId = data?.id;
  }
  if (!clientId) {
    const { data, error } = await db.from("clients").insert({
      name,
      business_name: get(r, Q.business) || null,
      email,
      website: get(r, Q.website) || null,
      business_description: get(r, Q.story) || null,
      business_stage: get(r, Q.season) || null,
      vision: get(r, Q.vision) || null,
      challenges: get(r, Q.challenge) || null,
      engagement_status: "new",
    }).select("id").single();
    if (error || !data) throw new Error(`Could not create client: ${error?.message}`);
    clientId = data.id;
  }

  const { data: subRow, error: subErr } = await db.from("intake_submissions").insert({
    client_id: clientId, tally_submission_id: sub.submissionId, tally_form_id: formId,
    source, submitted_at: sub.submittedAt, responses: r,
  }).select("id").single();
  if (subErr) {
    // Unique violation = a concurrent delivery already saved it.
    if (subErr.code === "23505") return { status: "duplicate", clientId };
    throw new Error(`Could not save submission: ${subErr.message}`);
  }

  // Consent + private birth details are stored separately and only with explicit opt-in.
  const consent = spiritualConsent(r);
  await db.from("client_private").upsert({
    client_id: clientId,
    consent_spiritual: consent,
    consent_source: `Tally submission ${sub.submissionId}`,
    consent_at: consent ? sub.submittedAt ?? new Date().toISOString() : null,
    birth_date: consent ? get(r, Q.birthDate) || null : null,
    birth_time: consent ? get(r, Q.birthTime) || null : null,
    birth_place: consent ? get(r, Q.birthPlace) || null : null,
  }, { onConflict: "client_id" });

  await db.from("activities").insert({
    client_id: clientId, activity_type: "intake", title: "New intake received",
    notes: `Tally submission ${sub.submissionId} via ${source.replace("_", " ")}.`, is_private: true,
  });

  return { status: "created", clientId, submissionRowId: subRow.id };
}
