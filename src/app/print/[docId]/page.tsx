import { notFound, redirect } from "next/navigation";
import { createClient, getAdvisor } from "@/lib/supabase/server";
import { Markdown } from "@/components/markdown";
import { PrintButton } from "./print-button";

/** Branded, print-ready document. Export = the browser’s Save as PDF ($0, no PDF service). */
export default async function PrintDoc({ params }: { params: Promise<{ docId: string }> }) {
  if (!(await getAdvisor())) redirect("/login");
  const { docId } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase.from("documents").select("*").eq("id", docId).maybeSingle();
  if (!d) notFound();
  const { data: c } = await supabase.from("clients").select("name,business_name").eq("id", d.client_id).single();
  const date = new Date(d.approved_at ?? d.updated_at).toLocaleDateString("en-US", { dateStyle: "long" });
  return (
    <div className="bg-[#EFE8E2] print:bg-white">
      <style>{`
        @page { size: letter; margin: 0.85in 0.9in 0.9in; @bottom-center { content: counter(page); font: 10px Georgia, serif; color: #A77489; } }
        @page :first { margin: 0; @bottom-center { content: none; } }
        @media print { .no-print { display: none !important; } .sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; } }
      `}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-line bg-ivory px-6 py-3 text-sm">
        <span>{d.status === "approved" ? "Approved" : "Draft — approve before sharing"} · use “Save as PDF” in the print dialog</span>
        <PrintButton />
      </div>
      <article className="sheet mx-auto my-8 w-[8.5in] bg-ivory shadow-sm print:my-0">
        <section className="brand-gradient relative flex h-[11in] flex-col justify-between p-[0.9in]" style={{ breakAfter: "page" }}>
          {/* Temporary text wordmark. Replace with the official mountain logo: <img src="/aerara-logo.svg" /> */}
          <div><p className="font-serif text-3xl tracking-[0.32em]">AERARA</p><p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-mauve">For the System</p></div>
          <div>
            <p className="label">{d.audience === "client" ? "Prepared for" : "Internal · advisor only"}</p>
            <p className="mt-2 font-serif text-2xl">{c?.name}{c?.business_name ? ` · ${c.business_name}` : ""}</p>
            <h1 className="mt-10 font-serif text-6xl leading-tight">{d.title}</h1>
            <div className="mt-6 h-px w-24 bg-clay" />
            <p className="mt-6 text-sm text-ink-soft">{date}</p>
          </div>
          <p className="text-xs text-ink-soft">{d.audience === "client" ? "Confidential — prepared for the named client." : "Contains private advisor notes. Do not share."}</p>
          {d.status !== "approved" && <p className="absolute right-[0.9in] top-[0.9in] rounded-full border border-clay px-3 py-1 text-xs uppercase tracking-widest text-clay-dark">Draft</p>}
        </section>
        <section className="px-[0.9in] py-[0.8in] print:p-0">
          <Markdown text={d.content} className="text-[14.5px]" />
          <div className="mt-16 border-t border-line pt-4 text-center text-[10px] uppercase tracking-[0.28em] text-mauve">AERARA · aerara.com</div>
        </section>
      </article>
    </div>
  );
}
