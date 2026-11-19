import { NextResponse, after } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromWebhook } from "@/lib/intake";
import { ingestSubmission } from "@/lib/ingest";
import { generateAssessment } from "@/lib/assessment";
import { aiConfigured } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Tally → Studio. Verifies the signature, saves the intake once, then drafts an assessment in the background. */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.TALLY_SIGNING_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook signing secret not configured" }, { status: 500 });

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("base64");
  const got = req.headers.get("tally-signature") ?? "";
  const ok = got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let payload: { eventType?: string; data?: Parameters<typeof fromWebhook>[0] };
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (payload.eventType !== "FORM_RESPONSE" || !payload.data) return NextResponse.json({ ignored: true });

  const allowed = (process.env.TALLY_FORM_IDS ?? "vXDAE8").split(",").map((s) => s.trim());
  if (!allowed.includes(payload.data.formId)) return NextResponse.json({ ignored: "form not allowed" });

  const db = createAdminClient();
  try {
    const result = await ingestSubmission(db, fromWebhook(payload.data), payload.data.formId, "tally_webhook");
    if (result.status === "created" && aiConfigured() && result.clientId) {
      const { clientId, submissionRowId } = result;
      after(async () => { await generateAssessment(db, clientId, submissionRowId ?? null); });
    }
    return NextResponse.json(result);
  } catch (e) {
    // Non-2xx makes Tally retry; duplicates are safe because ingestion is idempotent.
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ingestion failed" }, { status: 500 });
  }
}
