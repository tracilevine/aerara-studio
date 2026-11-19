import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Pill, Status } from "@/components/ui";
import { Tabs } from "./tabs";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("clients").select("id,client_number,name,business_name,engagement_status,is_demo").eq("id", id).maybeSingle();
  if (!c) notFound();
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="label">Client {String(c.client_number).padStart(3, "0")}</p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-serif text-4xl">{c.name}</h1>
          <Status value={c.engagement_status} />
          {c.is_demo && <Pill tone="alert">Demonstration data</Pill>}
        </div>
        {c.business_name && <p className="mt-1 text-ink-soft">{c.business_name}</p>}
      </header>
      <Tabs id={id} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
