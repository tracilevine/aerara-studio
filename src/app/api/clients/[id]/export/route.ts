import { NextResponse } from "next/server";
import { createClient, getAdvisor } from "@/lib/supabase/server";

/** Full export of one client's records (RLS-enforced). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdvisor())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = await createClient();
  const tables = ["client_private", "intake_submissions", "assessments", "audit_items", "client_tools", "recommendations", "tasks", "documents", "email_drafts", "activities"];
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  out.client = (await supabase.from("clients").select("*").eq("id", id).single()).data;
  for (const t of tables) out[t] = (await supabase.from(t).select("*").eq("client_id", id)).data;
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="client-${id}.json"` },
  });
}
